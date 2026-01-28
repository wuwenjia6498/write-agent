"""
工作流引擎
实现9步SOP的AI逻辑，支持数据库持久化和向量检索
"""

from typing import Dict, Any, Optional, List
import json
from pathlib import Path
from .ai_service import ai_service
from .db_service import db_service

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
        """
        加载屏蔽词库
        支持 Markdown 表格格式和 JSON 格式
        """
        # 优先使用 Markdown 格式
        md_file = self.configs_dir / "global" / "blocked_words.md"
        json_file = self.configs_dir / "global" / "blocked_words.json"
        
        if md_file.exists():
            return self._parse_blocked_words_markdown(md_file)
        elif json_file.exists():
            with open(json_file, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            return {"categories": {}}
    
    def _parse_blocked_words_markdown(self, filepath: Path) -> Dict[str, Any]:
        """
        解析 Markdown 格式的屏蔽词库
        从表格中提取：禁用短语、原因、替换建议
        """
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        result = {
            "blocked_words_config": {
                "version": "2.0",
                "description": "Markdown 格式屏蔽词库",
                "format": "markdown"
            },
            "categories": {}
        }
        
        # 按二级标题分割
        import re
        sections = re.split(r'\n## ', content)
        
        for section in sections[1:]:  # 跳过第一个（标题前的内容）
            lines = section.strip().split('\n')
            if not lines:
                continue
            
            category_name = lines[0].strip()
            
            # 跳过"审校检查清单"等非表格区域
            if '检查清单' in category_name:
                continue
            
            patterns = []
            in_table = False
            
            for line in lines[1:]:
                line = line.strip()
                
                # 跳过表头和分隔线
                if line.startswith('| 禁用短语') or line.startswith('|---'):
                    in_table = True
                    continue
                
                # 解析表格行
                if in_table and line.startswith('|') and line.endswith('|'):
                    cells = [cell.strip() for cell in line.split('|')[1:-1]]
                    if len(cells) >= 3:
                        patterns.append({
                            "phrase": cells[0],
                            "reason": cells[1],
                            "replacement": cells[2]
                        })
            
            if patterns:
                # 生成 category key
                category_key = category_name.replace('（', '_').replace('）', '').replace(' ', '_')
                result["categories"][category_key] = {
                    "name": category_name,
                    "patterns": patterns
                }
        
        return result
    
    async def execute_step_1(self, brief: str, channel_id: str) -> Dict[str, Any]:
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
    
    async def execute_step_2(self, brief_analysis: str, channel_id: str) -> Dict[str, Any]:
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
    
    async def execute_step_3(self, brief_analysis: str, channel_id: str) -> Dict[str, Any]:
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
    
    async def execute_step_4(self, selected_topic: str) -> Dict[str, Any]:
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
    
    async def execute_step_5(
        self, 
        selected_topic: str, 
        channel_id: str,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Step 5: 风格与素材检索 (RAG 核心)
        
        核心功能：
        1. 从数据库检索与选题相关的真实素材
        2. 严格按 channel_id 过滤，防止跨频道污染
        3. 将检索到的素材作为 context 传给下一步
        """
        channel_config = self.load_channel_config(channel_id)
        
        think_aloud = "[Step 5] 开始风格与素材检索...\n"
        
        # ====================================================================
        # 1. 从数据库检索真实素材
        # ====================================================================
        think_aloud += "\n[RAG] 正在从素材库检索相关素材...\n"
        think_aloud += f"  - 频道过滤: {channel_id}\n"
        
        # 获取频道的数据库 ID
        channel_data = db_service.get_channel_by_slug(channel_id)
        
        retrieved_materials = []
        if channel_data:
            # 从数据库检索素材（当前使用关键词匹配，后续可升级为向量检索）
            # 从选题中提取关键词
            keywords = self._extract_keywords(selected_topic)
            think_aloud += f"  - 检索关键词: {', '.join(keywords)}\n"
            
            # 执行检索（带频道隔离）
            retrieved_materials = db_service.search_materials_by_keywords(
                channel_id=channel_data["id"],
                keywords=keywords,
                limit=5
            )
            
            think_aloud += f"  - 检索到 {len(retrieved_materials)} 条相关素材\n"
        
        # 如果没有检索到，获取频道的通用素材
        if not retrieved_materials and channel_data:
            think_aloud += "  - 未找到精确匹配，获取频道通用素材...\n"
            retrieved_materials = db_service.get_materials_by_channel(
                channel_id=channel_data["id"],
                limit=5
            )
        
        # ====================================================================
        # 2. 格式化检索到的素材
        # ====================================================================
        materials_context = ""
        if retrieved_materials:
            materials_context = "\n\n## 从素材库检索到的真实素材\n"
            materials_context += "（以下素材来自15年积累的真实经历，请在创作中自然融入）\n\n"
            
            for i, mat in enumerate(retrieved_materials, 1):
                materials_context += f"### 素材{i} [{mat['material_type']}]\n"
                materials_context += f"{mat['content']}\n"
                if mat.get('source'):
                    materials_context += f"*来源: {mat['source']}*\n"
                materials_context += "\n"
            
            think_aloud += f"\n[RAG] 已注入 {len(retrieved_materials)} 条真实素材到 Prompt\n"
        else:
            think_aloud += "\n[WARN] 素材库中暂无相关素材，请在创作时注入真实经历\n"
        
        # ====================================================================
        # 3. 生成风格分析
        # ====================================================================
        system_prompt = f"""你是素材管理专家。根据选题，分析风格要求并整合检索到的素材。

频道：{channel_config['channel_name']}
素材标签：{', '.join(channel_config['material_tags'])}

{materials_context}

输出格式：
## 风格参考要点
- 开头方式：xxx
- 语言特点：xxx
- 段落节奏：xxx

## 已检索到的可用素材
（列出上面每条素材的使用建议）

## 素材使用建议
1. 在xxx位置可以融入素材1的xxx
2. ...

## 品牌特色元素
{json.dumps(channel_config.get('brand_metaphors', {}), ensure_ascii=False, indent=2) if channel_config.get('brand_metaphors') else '无'}
"""
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"为以下选题制定风格和素材使用方案：\n\n{selected_topic}",
            temperature=0.5
        )
        
        # 将素材 context 附加到输出中，供 Step 7 使用
        final_output = result + "\n\n---\n" + materials_context
        
        # 持久化 Think Aloud
        if task_id:
            db_service.add_think_aloud_log(task_id, 5, think_aloud)
        
        return {
            "output": final_output,
            "think_aloud": think_aloud,
            "retrieved_materials": retrieved_materials  # 供前端展示
        }
    
    def _extract_keywords(self, text: str) -> List[str]:
        """从文本中提取关键词（简单实现）"""
        # 移除常见停用词，提取关键词
        stop_words = {'的', '是', '在', '和', '了', '与', '对', '为', '以', '等', 
                      '这', '那', '就', '也', '都', '要', '能', '会', '可以', '应该',
                      '一个', '我们', '他们', '什么', '怎么', '如何', '为什么'}
        
        # 简单分词（按标点和空格）
        import re
        words = re.split(r'[，。、！？：；""''（）\s]+', text)
        
        # 过滤停用词和短词
        keywords = [
            w.strip() for w in words 
            if w.strip() and len(w.strip()) >= 2 and w.strip() not in stop_words
        ]
        
        # 取前10个关键词
        return keywords[:10]
    
    async def execute_step_6(self) -> Dict[str, Any]:
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
        channel_id: str,
        word_count: int = 1500  # 默认字数限制
    ) -> Dict[str, Any]:
        """
        Step 7: 初稿创作
        """
        channel_config = self.load_channel_config(channel_id)
        
        # 构建System Prompt - 增强字数控制
        system_prompt = f"""{channel_config['system_prompt']['role']}

## ⚠️ 重要：字数要求（必须严格遵守）
- 目标字数：{word_count}字
- 字数范围：{int(word_count * 0.9)}字 ~ {word_count}字
- 严禁超过目标字数！宁可少写也不要超字数
- 写作前先规划好各部分篇幅，确保总字数在范围内

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
6. 【重要】严格控制字数，不得超过{word_count}字
"""
        
        think_aloud = f"✍️ 开始创作初稿...\n\n频道：{channel_config['channel_name']}\n调性：{channel_config['brand_personality']}\n字数要求：{word_count}字\n\n正在融入品牌风格和真实素材..."
        
        user_message = f"""请创作文章初稿。

## 选题
{selected_topic}

## 风格指南
{style_guide}

## 可用素材
{materials}

## ⚠️ 字数要求
- 文章总字数必须控制在 {int(word_count * 0.9)} ~ {word_count} 字之间
- 创作完成后请检查字数，如超过字数限制请自行精简

请开始创作，直接输出文章内容（不要超过{word_count}字）。
"""
        
        # 根据字数动态调整 max_tokens（中文约 1.5 字符/token）
        estimated_tokens = min(int(word_count * 1.5), 4000)
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.7,
            max_tokens=estimated_tokens
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_8(self, draft: str, channel_id: str, word_count: int = 1500) -> Dict[str, Any]:
        """
        Step 8: 三遍审校机制
        """
        channel_config = self.load_channel_config(channel_id)
        blocked_words_config = self.load_blocked_words()
        
        # 计算当前草稿字数
        current_word_count = len(draft)
        is_over_limit = current_word_count > word_count
        
        # 构建屏蔽词列表
        blocked_phrases = []
        for category in blocked_words_config['categories'].values():
            for pattern in category['patterns']:
                blocked_phrases.append(f"- {pattern['phrase']} → {pattern['replacement']} （原因：{pattern['reason']}）")
        
        # 根据是否超字数调整审校要求
        word_count_instruction = ""
        if is_over_limit:
            word_count_instruction = f"""
## ⚠️ 字数超限警告
- 当前字数：{current_word_count}字
- 目标字数：{word_count}字
- 超出字数：{current_word_count - word_count}字
- 【必须执行】在审校过程中精简内容，删除冗余表达，确保最终版本不超过{word_count}字
"""
        else:
            word_count_instruction = f"""
## 字数检查
- 当前字数：{current_word_count}字
- 目标字数：{word_count}字
- 字数符合要求，请保持在{word_count}字以内
"""
        
        system_prompt = f"""你是专业的内容审校专家。请对文章进行三遍审校。
{word_count_instruction}

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

## 三审：细节打磨 + 字数控制
- 句子长度（拆分超过40字的长句）
- 段落长度（每段不超过200字）
- 标点符号
- 自然语调
- 情感共鸣
- 【重要】确保总字数不超过{word_count}字

输出格式：
## 审校报告

### 发现的问题
1. [内容] xxx
2. [风格] xxx
3. [细节] xxx
4. [字数] 当前xxx字，{"需要精简" if is_over_limit else "符合要求"}

### 修改建议
...

### 修改后版本
（输出完整的修改后文章，确保不超过{word_count}字）
"""
        
        think_aloud = f"🔍 开始三遍审校...\n\n当前字数：{current_word_count}字（目标：{word_count}字）\n\n第一遍：内容审校\n第二遍：风格审校（去AI味）\n第三遍：细节打磨 + 字数控制"
        
        # 动态调整 max_tokens
        estimated_tokens = min(int(word_count * 2), 6000)  # 预留审校报告空间
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"请对以下文章进行三遍审校（注意字数限制{word_count}字）：\n\n{draft}",
            temperature=0.3,
            max_tokens=estimated_tokens
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud
        }
    
    async def execute_step_9(self, final_article: str) -> Dict[str, Any]:
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

