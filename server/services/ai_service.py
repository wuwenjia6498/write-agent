"""
AI服务模块
负责与Claude API交互，实现内容生成
"""

from typing import AsyncIterator, Optional
from anthropic import AsyncAnthropic
import os
import json
import logging
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

class AIService:
    """AI服务类"""
    
    def __init__(self):
        """初始化AI服务"""
        # 强制重新加载 .env 文件，覆盖系统环境变量
        env_file = Path(__file__).parent.parent / ".env"
        load_dotenv(env_file, override=True)
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        base_url = os.getenv("ANTHROPIC_BASE_URL")
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        
        print(f"INFO: 加载配置:")
        print(f"  - API Key: {api_key[:20] if api_key else 'None'}...")
        print(f"  - Base URL: {base_url}")
        print(f"  - Model: {model}")
        
        if not api_key:
            print("WARNING: ANTHROPIC_API_KEY not set, AI functions will be disabled")
            self.client = None
        else:
            # 支持自定义API Base URL（用于第三方平台如AIHUBMIX）
            if base_url:
                self.client = AsyncAnthropic(
                    api_key=api_key,
                    base_url=base_url
                )
                print(f"INFO: Using custom API base URL: {base_url}")
            else:
                self.client = AsyncAnthropic(api_key=api_key)
        
        # 支持自定义模型名称
        self.model = model
    
    def _looks_truncated(self, text: str) -> bool:
        """
        启发式判断文本是否被截断（不依赖 stop_reason）。
        
        策略：取末尾非空白内容，如果不是中文终结标点或 Markdown 结构闭合符，
        则认为大概率被截断。对短文本（<80字）不做判定以避免误伤。
        """
        if not text or len(text.strip()) < 80:
            return False
        
        stripped = text.rstrip()
        if not stripped:
            return False
        
        last_char = stripped[-1]
        ending_punctuations = set('。！？…」】）》~\n')
        if last_char in ending_punctuations:
            return False
        
        # Markdown 代码块 / 引用块结尾也视为完整
        last_line = stripped.split('\n')[-1].strip()
        if last_line.startswith('```') or last_line.startswith('---'):
            return False
        
        return True
    
    async def generate_content(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """
        生成内容（带双重截断检测与自动续写）
        
        截断检测策略（二选一即触发续写）：
        1. API 返回 stop_reason == "max_tokens"
        2. 启发式检测：文本末尾无终结标点（兼容代理层不传 stop_reason 的情况）
        
        最多续写 MAX_CONTINUATIONS 次以防无限循环。
        """
        MAX_CONTINUATIONS = 3
        
        if not self.client:
            return "[WARNING] AI服务未配置ANTHROPIC_API_KEY，无法生成内容。请参考SETUP.md配置环境变量。"
        
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": user_message
                }]
            )
            
            full_text = response.content[0].text
            
            # 提取 token 使用量用于诊断
            usage = getattr(response, 'usage', None)
            input_tokens = getattr(usage, 'input_tokens', '?') if usage else '?'
            output_tokens = getattr(usage, 'output_tokens', '?') if usage else '?'
            
            logger.warning(
                f"[AI Response] stop_reason={response.stop_reason}, "
                f"output_tokens={output_tokens}, input_tokens={input_tokens}, "
                f"max_tokens={max_tokens}, text_len={len(full_text)}"
            )
            
            # 双重截断检测：API 信号 或 启发式判断
            continuations = 0
            while continuations < MAX_CONTINUATIONS:
                api_truncated = (response.stop_reason == "max_tokens")
                
                # 启发式仅在 output_tokens 接近 max_tokens（>85%）时才启用
                # 避免模型正常结束但末尾无标点（如列表格式）时误触发
                cur_usage = getattr(response, 'usage', None)
                cur_out = getattr(cur_usage, 'output_tokens', 0) if cur_usage else 0
                token_ratio = cur_out / max_tokens if max_tokens > 0 else 0
                heuristic_truncated = (
                    token_ratio > 0.85 and self._looks_truncated(full_text)
                )
                
                if not api_truncated and not heuristic_truncated:
                    break
                
                continuations += 1
                trigger = "stop_reason=max_tokens" if api_truncated else f"heuristic(token_ratio={token_ratio:.0%})"
                logger.warning(
                    f"检测到截断({trigger}), 第{continuations}次续写, "
                    f"已有 {len(full_text)} 字..."
                )
                
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_message},
                        {"role": "assistant", "content": full_text},
                        {"role": "user", "content": "你的回答被截断了，请从断点处继续输出剩余内容，不要重复已输出的部分。"}
                    ]
                )
                
                continuation_text = response.content[0].text
                full_text += continuation_text
                
                c_usage = getattr(response, 'usage', None)
                c_out = getattr(c_usage, 'output_tokens', '?') if c_usage else '?'
                logger.warning(
                    f"续写完成: stop_reason={response.stop_reason}, "
                    f"+{len(continuation_text)}字 (output_tokens={c_out}), "
                    f"累计 {len(full_text)} 字"
                )
            
            if continuations >= MAX_CONTINUATIONS and self._looks_truncated(full_text):
                logger.warning(
                    f"已达最大续写次数({MAX_CONTINUATIONS}), "
                    f"输出可能仍不完整(共 {len(full_text)} 字)"
                )
            
            return full_text
        except Exception as e:
            return f"[ERROR] AI生成失败: {str(e)}"
    
    async def generate_content_stream(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> AsyncIterator[str]:
        """
        流式生成内容（用于Think Aloud）
        
        Args:
            system_prompt: 系统提示词
            user_message: 用户消息
            temperature: 温度参数
            max_tokens: 最大token数
            
        Yields:
            生成的内容片段
        """
        if not self.client:
            yield "[WARNING] AI服务未配置ANTHROPIC_API_KEY"
            return
        
        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": user_message
                }]
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            yield f"[ERROR] AI流式生成失败: {str(e)}"

# 全局AI服务实例
ai_service = AIService()

