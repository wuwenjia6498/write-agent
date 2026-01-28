"""
AI服务模块
负责与Claude API交互，实现内容生成
"""

from typing import AsyncIterator, Optional
from anthropic import AsyncAnthropic
import os
import json
from dotenv import load_dotenv
from pathlib import Path

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
    
    async def generate_content(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """
        生成内容
        
        Args:
            system_prompt: 系统提示词
            user_message: 用户消息
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            生成的内容
        """
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
            
            return response.content[0].text
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

