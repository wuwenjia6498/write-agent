"""
工作流引擎
实现9步SOP的AI逻辑
"""

from typing import Dict, Any, Optional
import json
from pathlib import Path
from .ai_service import ai_service

class WorkflowEngine:
    """工作流执行引擎"""
    
    def __init__(self):
        """初始化工作流引擎"""
        self.configs_dir = Path(__file__).parent.parent / "configs"
    
    def load_channel_config(self, channel_id: str) -> Dict[str, Any]:
        """加载频道配置"""
        config_file = self.configs_dir / "channels" / f"{channel_id}.json"
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def load_blocked_words(self) -> Dict[str, Any]:
        """加载屏蔽词库"""
        config_file = self.configs_dir / "global" / "blocked_words.json"
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    async def execute_step_1(self, brief: str, channel_id: str) -> str:
        """
        Step 1: 理解需求 & 保存Brief
        """
        system_prompt = """你是一个需求分析专家。请仔细分析用户的创作需求，提取关键信息。

输出格式：
1. 主题：xxx
2. 目标读者：xxx
3. 期望字数：xxx
4. 特殊要求：xxx
5. 关键词：xxx
"""
        
        think_aloud = f"📋 正在分析需求...\n用户输入：{brief[:100]}..."
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"请分析以下创作需求：\n\n{brief}",
            temperature=0.3
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_2(self, brief_analysis: str, channel_id: str) -> str:
        """
        Step 2: 信息搜索与知识管理
        """
        system_prompt = """你是一个信息调研专家。根据创作需求，列出需要调研的信息点。

注意：
- 只列出确实需要调研的内容
- 不编造信息
- 标注信息来源的重要性

输出格式：
需要调研的信息：
1. xxx（来源：官方文档/学术论文/权威媒体）
2. xxx
...

如果不需要额外调研，说明原因。
"""
        
        think_aloud = "🔍 正在分析需要调研的信息点..."
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"根据以下需求分析，列出需要调研的信息：\n\n{brief_analysis}",
            temperature=0.3
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_3(self, brief_analysis: str, channel_id: str) -> str:
        """
        Step 3: 选题讨论（必做卡点）
        """
        channel_config = self.load_channel_config(channel_id)
        
        system_prompt = f"""{channel_config['system_prompt']['role']}

请根据用户需求提供3-4个选题方向。

每个选题包含：
1. 标题（吸引人但不标题党）
2. 核心观点
3. 大纲（3-5个要点）
4. 预估工作量（字数、所需素材）
5. 优劣分析

写作风格要求：
{chr(10).join(['- ' + style for style in channel_config['system_prompt']['writing_style']])}
"""
        
        think_aloud = f"💡 正在为'{channel_config['channel_name']}'频道生成选题方案...\n\n思考重点：\n- 符合频道调性\n- 避免空洞套话\n- 有独特视角"
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"基于以下需求分析，提供3-4个选题方向：\n\n{brief_analysis}",
            temperature=0.8,
            max_tokens=6000
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud,
            "is_checkpoint": True  # 卡点，需要用户确认
        }
    
    async def execute_step_4(self, selected_topic: str) -> str:
        """
        Step 4: 创建协作文档
        """
        system_prompt = """你是项目管理专家。根据选定的选题，创建协作清单。

输出格式：
## AI负责的任务
- [ ] 任务1
- [ ] 任务2

## 用户需要提供的内容
- [ ] 真实案例：xxx
- [ ] 个人观点：xxx
- [ ] 数据支持：xxx

## 注意事项
- 不编造数据
- 不使用套话
"""
        
        think_aloud = "📝 正在生成协作清单..."
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"为以下选题创建协作清单：\n\n{selected_topic}",
            temperature=0.3
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_5(self, selected_topic: str, channel_id: str) -> str:
        """
        Step 5: 风格与素材检索
        """
        channel_config = self.load_channel_config(channel_id)
        
        system_prompt = f"""你是素材管理专家。根据选题，列出需要检索的素材类型和关键词。

频道：{channel_config['channel_name']}
素材标签：{', '.join(channel_config['material_tags'])}

输出格式：
## 风格参考要点
- 开头方式：xxx
- 语言特点：xxx
- 段落节奏：xxx

## 需要检索的素材
1. 标签：#xxx，关键词：xxx
2. 标签：#xxx，关键词：xxx

## 品牌特色元素
{json.dumps(channel_config.get('brand_metaphors', {}), ensure_ascii=False, indent=2) if channel_config.get('brand_metaphors') else '无'}
"""
        
        think_aloud = "🎨 正在分析风格要求并检索素材..."
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"为以下选题制定风格和素材检索方案：\n\n{selected_topic}",
            temperature=0.5
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_6(self) -> str:
        """
        Step 6: 挂起等待（数据确认卡点）
        """
        think_aloud = "⏸️ 挂起等待用户确认所有必需素材已就绪..."
        
        result = """## 数据确认清单

请确认以下内容已准备好：
- [ ] 真实案例和经历
- [ ] 个人观点和态度
- [ ] 必要的数据支持
- [ ] 其他关键信息

⚠️ 重要提醒：
- 绝不编造虚假信息
- 宁可等待也不瞎写
- 所有数据必须有来源

确认无误后，点击"继续"进入创作阶段。
"""
        
        return {
            "output": result,
            "think_aloud": think_aloud,
            "is_checkpoint": True  # 卡点，需要用户确认
        }
    
    async def execute_step_7(
        self,
        selected_topic: str,
        style_guide: str,
        materials: str,
        channel_id: str
    ) -> str:
        """
        Step 7: 初稿创作
        """
        channel_config = self.load_channel_config(channel_id)
        
        # 构建System Prompt
        system_prompt = f"""{channel_config['system_prompt']['role']}

## 写作风格要求
{chr(10).join(['- ' + style for style in channel_config['system_prompt']['writing_style']])}

## 语调规范
禁止使用：{', '.join(channel_config['system_prompt']['tone_guidelines']['禁止使用'])}
推荐使用：{', '.join(channel_config['system_prompt']['tone_guidelines']['推荐使用'])}

## 频道规则
必须遵守：
{chr(10).join(['- ' + rule for rule in channel_config['channel_specific_rules']['must_do']])}

严格禁止：
{chr(10).join(['- ' + rule for rule in channel_config['channel_specific_rules']['must_not_do']])}

## 屏蔽词
以下表达绝对禁止使用：
{', '.join(channel_config['blocked_phrases'])}

## 创作要求
1. 融入真实观察和案例
2. 有个人态度和温度
3. 避免空洞套话
4. 段落节奏适中（每段150-200字）
5. 句子长度控制（避免超过40字的长句）
"""
        
        think_aloud = f"✍️ 开始创作初稿...\n\n频道：{channel_config['channel_name']}\n调性：{channel_config['brand_personality']}\n\n正在融入品牌风格和真实素材..."
        
        user_message = f"""请创作文章初稿。

## 选题
{selected_topic}

## 风格指南
{style_guide}

## 可用素材
{materials}

请开始创作，直接输出文章内容。
"""
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.7,
            max_tokens=8000
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_8(self, draft: str, channel_id: str) -> str:
        """
        Step 8: 三遍审校机制
        """
        channel_config = self.load_channel_config(channel_id)
        blocked_words_config = self.load_blocked_words()
        
        # 构建屏蔽词列表
        blocked_phrases = []
        for category in blocked_words_config['categories'].values():
            for pattern in category['patterns']:
                blocked_phrases.append(f"- {pattern['phrase']} → {pattern['replacement']} （原因：{pattern['reason']}）")
        
        system_prompt = f"""你是专业的内容审校专家。请对文章进行三遍审校。

## 一审：内容审校
- 事实准确性
- 逻辑清晰度
- 论证充分性
- 是否有编造内容

## 二审：风格审校（去AI味）
频道要求：{channel_config['brand_personality']}

全局屏蔽词（必须检查）：
{chr(10).join(blocked_phrases[:20])}  

频道屏蔽词：
{', '.join(channel_config['blocked_phrases'])}

## 三审：细节打磨
- 句子长度（拆分超过40字的长句）
- 段落长度（每段不超过200字）
- 标点符号
- 自然语调
- 情感共鸣

输出格式：
## 审校报告

### 发现的问题
1. [内容] xxx
2. [风格] xxx
3. [细节] xxx

### 修改建议
...

### 修改后版本
（输出完整的修改后文章）
"""
        
        think_aloud = "🔍 开始三遍审校...\n\n第一遍：内容审校\n第二遍：风格审校（去AI味）\n第三遍：细节打磨"
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"请对以下文章进行三遍审校：\n\n{draft}",
            temperature=0.3,
            max_tokens=10000
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_9(self, final_article: str) -> str:
        """
        Step 9: 文章配图
        """
        system_prompt = """你是配图方案专家。根据文章内容，提供配图建议。

输出格式：
## 配图方案

### 图1：标题/位置
- 描述：xxx
- 风格：插画/照片/图表
- AI绘图提示词：xxx

### 图2：标题/位置
...

## Markdown代码
```markdown
![图1描述](图片路径)

文章内容...

![图2描述](图片路径)
```

注意：
- 配图要与内容相关
- 5-8张为宜
- 提供清晰的AI绘图提示词
"""
        
        think_aloud = "🖼️ 正在生成配图方案..."
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"为以下文章提供配图方案：\n\n{final_article[:2000]}...",
            temperature=0.5
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }

# 全局工作流引擎实例
workflow_engine = WorkflowEngine()

