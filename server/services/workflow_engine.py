"""
工作流引擎
实现9步SOP的AI逻辑，支持数据库持久化和向量检索
"""

from typing import Dict, Any, Optional, List
import json
from pathlib import Path
from .ai_service import ai_service
from .db_service import db_service
from .material_processor import process_materials, classify_materials
from .search_service import search_service
from .knowledge_service import knowledge_service

class WorkflowEngine:
    """工作流执行引擎"""
    
    def __init__(self):
        """初始化工作流引擎"""
        self.configs_dir = Path(__file__).parent.parent / "configs"
    
    def load_channel_config(self, channel_id: str) -> Dict[str, Any]:
        """
        加载频道配置（单一数据源策略）
        
        读取优先级：
        1. JSON 配置文件（configs/channels/{channel_id}.json）- 主数据源
        2. 数据库 channels 表 - 仅作为 fallback
        
        设计原则：
        - JSON 文件是配置的"真相来源"（Source of Truth）
        - 数据库中的 channel_rules、blocked_phrases 仅用于管理界面展示
        - 工作流执行始终以 JSON 配置为准
        
        Returns:
            Dict[str, Any]: 频道配置字典
        
        Raises:
            FileNotFoundError: 如果 JSON 文件和数据库都找不到配置
        """
        config_file = self.configs_dir / "channels" / f"{channel_id}.json"
        
        # 优先级 1: 从 JSON 配置文件加载
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                config["_source"] = "json"  # 标记数据来源，便于调试
                return config
        
        # 优先级 2: Fallback 到数据库
        from .db_service import db_service
        channel_data = db_service.get_channel_by_slug(channel_id)
        
        if channel_data:
            # 将数据库格式转换为 JSON 配置格式
            config = self._convert_db_to_config_format(channel_data)
            config["_source"] = "database"
            print(f"⚠️ 警告: 频道 '{channel_id}' 从数据库加载配置，建议创建 JSON 配置文件")
            return config
        
        raise FileNotFoundError(f"频道配置未找到: {channel_id}（JSON 文件和数据库均不存在）")
    
    def _convert_db_to_config_format(self, channel_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        将数据库频道数据转换为 JSON 配置格式
        用于 fallback 场景
        """
        return {
            "channel_id": channel_data.get("slug", ""),
            "channel_name": channel_data.get("name", ""),
            "description": channel_data.get("description", ""),
            "target_audience": channel_data.get("target_audience", ""),
            "brand_personality": channel_data.get("brand_personality", ""),
            "system_prompt": channel_data.get("system_prompt", {
                "role": "你是专业的内容创作专家。",
                "writing_style": [],
                "tone_guidelines": {}
            }),
            "channel_specific_rules": channel_data.get("channel_rules", {
                "must_do": [],
                "must_not_do": []
            }),
            "blocked_phrases": channel_data.get("blocked_phrases", []),
            "material_tags": channel_data.get("material_tags", []),
            "style_samples": channel_data.get("style_samples", []),
            "style_profile": channel_data.get("style_profile", None)
        }
    
    def _build_channel_rules_prompt(self, channel_config: Dict[str, Any]) -> str:
        """
        组装【频道专属内容铁律】prompt 片段。
        
        根据 channel_config 中的 must_do / must_not_do 规则动态生成，
        任一字段为空则自动跳过对应段落，两者均为空返回空字符串。
        """
        rules = channel_config.get('channel_specific_rules', {})
        must_do = rules.get('must_do', [])
        must_not_do = rules.get('must_not_do', [])

        if not must_do and not must_not_do:
            return ""

        parts = ["## 【频道专属内容铁律】"]

        if must_do:
            parts.append("你在创作/审校时，必须严格遵守以下原则：")
            for rule in must_do:
                parts.append(f"- ✅ {rule}")
            parts.append("")

        if must_not_do:
            parts.append("你绝对禁止出现以下情况：")
            for rule in must_not_do:
                parts.append(f"- ❌ {rule}")
            parts.append("")

        return "\n".join(parts)

    def sync_channel_config_to_json(self, channel_id: str) -> bool:
        """
        将数据库中的频道配置同步到 JSON 文件
        
        用途：管理界面更新数据库后，调用此方法同步到 JSON
        
        Args:
            channel_id: 频道 ID（slug）
            
        Returns:
            bool: 是否同步成功
        """
        from .db_service import db_service
        
        channel_data = db_service.get_channel_by_slug(channel_id)
        if not channel_data:
            print(f"❌ 同步失败: 数据库中找不到频道 '{channel_id}'")
            return False
        
        config = self._convert_db_to_config_format(channel_data)
        config.pop("_source", None)  # 移除来源标记
        
        config_file = self.configs_dir / "channels" / f"{channel_id}.json"
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print(f"✅ 配置已同步: {config_file}")
            return True
        except Exception as e:
            print(f"❌ 同步失败: {e}")
            return False
    
    def get_config_source(self, channel_id: str) -> str:
        """
        获取频道配置的数据来源
        
        Returns:
            str: "json" | "database" | "not_found"
        """
        config_file = self.configs_dir / "channels" / f"{channel_id}.json"
        if config_file.exists():
            return "json"
        
        from .db_service import db_service
        if db_service.get_channel_by_slug(channel_id):
            return "database"
        
        return "not_found"
    
    def load_writing_constraints(self) -> Dict[str, Any]:
        """
        加载全局写作约束配置
        包含：禁用书目、字数限制、句段长度等全局写作约束
        """
        config_file = self.configs_dir / "global" / "writing_constraints.json"
        if config_file.exists():
            with open(config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            # 兜底默认值
            return {
                "banned_books": {
                    "list": [],
                    "replacement_hint": "请选择小众但优质的作品"
                },
                "word_count": {"default": 1500, "tolerance": 0.1},
                "sentence": {"max_length": 40},
                "paragraph": {"max_length": 200}
            }
    
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
        
        流程：
        1. 使用 Tavily API 进行真实网络搜索（如果可用）
        2. 将搜索结果作为上下文传给 AI
        3. AI 基于真实搜索结果生成调研报告
        4. 提炼核心要点摘要
        """
        think_aloud = "🔍 正在进行深度调研...\n"
        
        # 从 brief_analysis 中提取主题关键词
        topic_keywords = self._extract_topic_from_brief(brief_analysis)
        think_aloud += f"  - 识别调研主题: {topic_keywords}\n"
        
        # ====================================================================
        # 阶段零-A：内部知识库 RAG 检索（优先于外部搜索）
        # ====================================================================
        internal_knowledge = ""
        internal_sources = []  # 内部来源（Tavily 兼容格式）
        channel_scope = channel_id if channel_id in ("deep_reading", "picture_books") else ""
        
        if channel_scope and knowledge_service.is_available():
            think_aloud += "  - 📚 正在检索内部知识库...\n"
            
            # 分步调用：获取原始 chunks 以提取来源文件名
            rag_chunks = knowledge_service.search_docs(topic_keywords, channel_scope, limit=5)
            rag_books = []
            if channel_scope == "deep_reading":
                rag_books = knowledge_service.search_books(topic_keywords, limit=3)
            
            internal_knowledge = knowledge_service.format_knowledge_for_prompt(rag_chunks, rag_books)
            
            if rag_chunks or rag_books:
                # 提取唯一来源文件名，格式化为 Tavily 兼容的 source 字典
                seen_filenames = set()
                for chunk in rag_chunks:
                    fname = chunk.get("source_filename", "")
                    if fname and fname not in seen_filenames:
                        seen_filenames.add(fname)
                        snippet = chunk.get("content", "")[:100] + "..."
                        internal_sources.append({
                            "title": fname,
                            "url": "internal_database",
                            "content": snippet
                        })
                for book in rag_books:
                    book_title = f"《{book.get('title', '')}》"
                    if book_title not in seen_filenames:
                        seen_filenames.add(book_title)
                        internal_sources.append({
                            "title": f"课标推荐 - {book_title}",
                            "url": "internal_database",
                            "content": book.get("content_intro", "")[:100] + "..."
                        })
                
                think_aloud += f"  - ✓ 内部知识库命中 {len(rag_chunks)} 条文档 + {len(rag_books)} 本书目，提取 {len(internal_sources)} 个来源\n"
            else:
                think_aloud += "  - ⚠ 内部知识库无匹配结果\n"
        elif not channel_scope:
            think_aloud += "  - ℹ 当前频道无内部知识库覆盖，跳过 RAG 检索\n"
        else:
            think_aloud += "  - ⚠ RAG 检索服务未就绪（OPENAI_API_KEY 未配置）\n"
        
        # ====================================================================
        # 阶段零-B：Query Rewriting + 真实网络搜索
        # ====================================================================
        search_context = ""
        knowledge_sources = []
        
        if search_service.is_available():
            # Query Rewriting：将用户主题转化为精准搜索关键词
            search_query = topic_keywords  # Fallback 默认值
            try:
                think_aloud += "  - 🔄 正在优化搜索关键词...\n"
                rewrite_result = await ai_service.generate_content(
                    system_prompt="""你是一位儿童阅读教育领域的学术研究员，正在为一篇教育类文章构建精准的学术数据库检索词。

【你的唯一任务】
从用户描述中提取 1–2 组纯粹的【教育学实体 / 心理学名词 / 具体的阅读方法与策略】，用于在 Google Scholar 或教育学数据库中检索真实研究资料。

【绝对禁止出现以下动作指令词】
需求分析、怎么写、公众号、排版、字数、生成、总结、分析、文章、写作技巧、SEO、关键词优化

【检索词的正确形态示例】
- "二年级 漫画书 纯文字过渡 阅读策略"
- "儿童阅读理解 元认知 朗读训练"
- "小学生注意力 整本书阅读 专注力培养"

【输出规则】
仅输出关键词本身，以逗号分隔，不加任何解释或标点。""",
                    user_message=f"请根据以下创作主题，提取适合学术检索的儿童教育关键词：\n\n{topic_keywords}",
                    temperature=0.2,
                    max_tokens=100
                )
                rewritten = rewrite_result.strip()
                if rewritten and len(rewritten) < 200:
                    search_query = rewritten
                    think_aloud += f"  - ✓ 关键词优化: {search_query}\n"
                else:
                    think_aloud += f"  - ⚠ 关键词优化结果异常，使用原始主题\n"
            except Exception as e:
                think_aloud += f"  - ⚠ 关键词优化失败({e})，使用原始主题\n"
            
            think_aloud += "  - 🌐 正在进行网络搜索...\n"
            
            search_result = await search_service.search_for_research(
                topic=search_query,
                context=brief_analysis
            )
            
            if search_result["result_count"] > 0:
                search_context = search_result["context"]
                knowledge_sources = search_result["sources"]
                think_aloud += f"  - ✓ 搜索完成，获取 {search_result['result_count']} 条真实来源\n"
            else:
                think_aloud += "  - ⚠ 搜索无结果，将使用 AI 知识库生成\n"
        else:
            think_aloud += "  - ⚠ 搜索服务未配置（TAVILY_API_KEY），使用 AI 知识库\n"
        
        # 将内部来源插入 knowledge_sources 最前面（优先展示于外部搜索结果之前）
        if internal_sources:
            knowledge_sources = internal_sources + knowledge_sources
        
        # ====================================================================
        # 阶段一：生成详尽调研资料
        # ====================================================================
        if search_context:
            # 有搜索结果，基于真实来源生成
            research_prompt = """你是一位资深的内容调研专家。请根据以下【真实搜索结果】，整理出结构化的调研报告。

## 重要要求
1. **必须基于搜索结果**：只使用搜索结果中的信息，不要编造
2. **标注来源**：在正文中引用参考资料时，请**统一且仅使用** `[来源X]` 的格式进行标注（X对应底部来源列表的序号）。无论该资料是内部知识库还是外部网络结果，都只使用数字序号引用。**严禁**在正文中使用诸如 `[老约翰内部知识库]` 等笼统的文本标签
3. **充分利用补充资料**：如果提供了【补充参考资料】，将其与搜索结果同等对待，统一编号引用
4. **结构清晰**：按主题分类整理

## 输出格式（Markdown）

### 一、核心概念与定义
- xxx [来源X]

### 二、关键数据与事实
- xxx [来源X]

### 三、专家观点与理论支撑
- xxx [来源X]

### 四、案例与实证
- xxx [来源X]

### 五、常见误区与注意事项
- xxx

### 六、延伸阅读建议
- 参考来源中的相关链接

---
请基于真实搜索结果生成调研报告，确保信息可溯源。"""
            
            user_message = f"""【创作需求】
{brief_analysis}

【真实搜索结果】
{search_context}
{f'''
【补充参考资料】
{internal_knowledge}
''' if internal_knowledge else ''}
请基于以上全部参考资料生成结构化的调研报告。"""
        else:
            # 无搜索结果，使用传统方式
            research_prompt = """你是一位资深的内容调研专家。请根据创作需求，进行全面深入的资料调研。

## 调研要求
1. **信息全面**：覆盖主题的各个关键维度
2. **有据可查**：在正文中引用参考资料时，请**统一且仅使用** `[来源X]` 的格式进行标注（X对应底部来源列表的序号）。无论该资料是内部知识库还是外部网络结果，都只使用数字序号引用。**严禁**在正文中使用诸如 `[老约翰内部知识库]` 等笼统的文本标签
3. **充分利用补充资料**：如果提供了【补充参考资料】，将其与其他参考同等对待，统一编号引用
4. **实用导向**：聚焦对创作有实际价值的信息
5. **结构清晰**：分类整理，便于后续引用

## 输出格式（Markdown）

### 一、核心概念与定义
- xxx

### 二、关键数据与事实
- xxx（来源：xxx）

### 三、专家观点与理论支撑
- xxx

### 四、案例与实证
- xxx

### 五、常见误区与注意事项
- xxx

### 六、延伸阅读建议
- xxx

---
请确保内容详实、有深度，为后续创作提供充足的素材支撑。"""
            
            internal_ref = ""
            if internal_knowledge:
                internal_ref = f"\n\n【补充参考资料】\n{internal_knowledge}"
            user_message = f"请根据以下需求分析进行深度调研：\n\n{brief_analysis}{internal_ref}"
        
        think_aloud += "  - 正在生成详尽调研资料...\n"
        
        knowledge_base = await ai_service.generate_content(
            system_prompt=research_prompt,
            user_message=user_message,
            temperature=0.4,
            max_tokens=4000
        )
        
        think_aloud += f"  - ✓ 调研资料生成完成 ({len(knowledge_base)} 字)\n"
        
        # ====================================================================
        # 阶段二：提炼核心要点摘要（300字以内）
        # ====================================================================
        summary_prompt = """你是一位擅长信息提炼的编辑。请将调研资料提炼为简洁的核心要点。

【严格要求】
- 总字数：200-300字
- 要点数：3-5个核心发现
- 格式：纯文本，禁止使用任何 Markdown 或 HTML 标签
- 引用来源时统一使用 [来源X] 格式（X为序号），严禁使用 [老约翰内部知识库] 等文本标签

【输出格式示例】
核心发现：
1. 第一个要点的一句话概括 [来源1]
2. 第二个要点的一句话概括 [来源3]
3. 第三个要点的一句话概括

参考来源：[来源1] xxx, [来源2] xxx, [来源3] xxx

创作建议：一句话说明这些发现对文章创作的指导意义。

【禁止事项】
- 不要使用 # ## ### 等标题符号
- 不要使用 ** __ 等加粗符号
- 不要使用 <strong> <b> 等 HTML 标签
- 不要使用 [老约翰内部知识库] 等笼统标签引用来源
- 直接输出纯文本即可"""
        
        think_aloud += "  - 正在提炼核心要点摘要...\n"
        
        knowledge_summary = await ai_service.generate_content(
            system_prompt=summary_prompt,
            user_message=f"请将以下调研资料提炼为 300 字以内的核心要点摘要：\n\n{knowledge_base}",
            temperature=0.3,
            max_tokens=500
        )
        
        think_aloud += "  - ✓ 摘要提炼完成\n"
        think_aloud += "\n📚 调研阶段完成，请审阅并确认调研结论。"
        
        return {
            "output": knowledge_base,           # 完整调研资料
            "knowledge_summary": knowledge_summary,  # 核心要点摘要
            "knowledge_sources": knowledge_sources,  # 真实搜索来源
            "internal_knowledge": internal_knowledge,  # RAG 内部知识库参考
            "think_aloud": think_aloud,
            "is_checkpoint": True  # 设为卡点，需用户确认
        }
    
    async def execute_step_3(self, brief_analysis: str, channel_id: str) -> Dict[str, Any]:
        """
        Step 3: 选题讨论（必做卡点）
        """
        channel_config = self.load_channel_config(channel_id)
        writing_constraints = self.load_writing_constraints()
        
        # 从配置文件加载禁用书目
        banned_books = writing_constraints.get('banned_books', {})
        banned_books_list = ''.join(banned_books.get('list', []))
        banned_books_hint = banned_books.get('replacement_hint', '请选择更小众但同样优质的作品')
        
        system_prompt = f"""{channel_config['system_prompt']['role']}

请根据用户需求提供4个选题方向。

每个选题包含：
1. 标题（必须严格遵守下方【标题创作红线】）
2. 核心观点
3. 大纲（3-5个要点）
4. 预估工作量（字数、所需素材）
5. 优劣分析

## 🚨 【标题创作红线（必须严格遵守）】
1. **拒绝贩卖焦虑与刺眼用词**：绝对禁止使用"假大空"、"别逼孩子"、"废了"、"3行半"等引发家长焦虑或带有贬低意味的词汇。
2. **戒断"营销号"套路句式**：
   - 极度克制使用反问句和质问句（不要满屏都是"为什么...？"）。
   - 绝对禁止使用"你以为...其实..."这种陈旧的营销号反转套路。
3. **保持温润、专业的专家视角（提供四种必选句式结构，请均匀分配在4个选题中）**：
   - 结构A（核心概念提炼法）：如《阅读的厚度≠写作的深度：搭建"思维支架"，让孩子真正学会表达》。
   - 结构B（现象+微观比喻法）：如《阅读是"吸收"，写作是"消化"：帮孩子把读过的书，变成真正属于自己的思想》。
   - 结构C（温和解惑法）：如《读了1000本书却写不出作文？其实孩子只是缺少了"深加工"的一步》。
   - 结构D（成长共情法）：如《跨越从阅读到写作的鸿沟，是父母巧妙的"搭把手"》。

## ⚠️ 禁用书目（避免AI味）
举例时禁止使用以下被过度引用的常见书目：
{banned_books_list}
- {banned_books_hint}

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
    
    async def execute_step_4(
        self,
        selected_topic: str,
        internal_knowledge: str = "",
        knowledge_summary: str = "",
    ) -> Dict[str, Any]:
        """
        Step 4: 创建协作文档（v4.5 - 知识库感知，极简用户输入）
        
        核心逻辑：
        1. 先评估已有的【补充参考资料】（知识库 RAG 内容）
        2. 资料中已包含的案例/书名/步骤 → AI 主动承担融入任务
        3. 仅当核心论据极度缺乏时，以【可选补充】形式向用户提问
        4. 用户需填写的内容不超过 2-3 个简短问题，可回复"无"或跳过
        """
        has_knowledge = bool(internal_knowledge and internal_knowledge.strip())
        has_summary = bool(knowledge_summary and knowledge_summary.strip())

        # 动态读取全局禁用书目
        writing_constraints = self.load_writing_constraints()
        banned_books = writing_constraints.get('banned_books', {})
        banned_books_list = '、'.join(banned_books.get('list', []))

        system_prompt = f"""你是一位写作项目的分工规划师，正在为人类运营规划 AI 与人的写作分工。

## 核心原则
你的首要目标是**最大限度降低用户的输入负担**。AI 能自行解决的绝不麻烦用户。

## 【最高红线】
在构思案例和撰写文章时，**绝对禁止**引用以下过度泛滥的童书作为案例：{banned_books_list}。你必须优先使用 Step 2 检索到的知识库中的具体教案书目！如果违反此红线，你的输出将被直接废弃。

## 工作流程
1. **首先评估已有资料**：仔细阅读下方提供的【补充参考资料】和【调研摘要】。
2. **判断素材充足度**：
   - 资料中已包含的真实案例、书籍推荐、教学步骤、课堂反馈 → AI 主动承担融入文章的任务，**不要再向用户索取**。
   - 只有当资料中**极度缺乏**某项核心论据（例如：完全没有具体书名、完全没有目标年级的真实反馈）时，才以【可选补充】形式提问。
3. **用户问题极度精简**：最多 2-3 个简短问题，每个问题一句话。用户可以回复"无"或直接跳过。

## 输出格式（严格遵守）

### ✅ AI 将负责的工作
（根据选题和现有资料，列出 AI 承担的具体写作任务，包括如何使用已有素材）

### 📝 可选补充（非必填，可在输入框中填写或留空跳过）
（仅在资料确实缺乏关键内容时才列出，最多 2-3 个简短问题）
（如果资料已经足够充分，此区域写"资料充分，无需额外补充，可直接点击「下一步」。"）

### ⚠️ 写作纪律
- 所有案例必须来自已有参考资料，严禁凭空编造
- 如果用户未补充内容，AI 将完全基于现有资料完成创作
"""

        # 构建 user_message，注入知识库上下文
        knowledge_block = ""
        if has_knowledge:
            knowledge_block += f"""
## 【补充参考资料】（来自知识库）
{internal_knowledge}

"""
        if has_summary:
            knowledge_block += f"""## 【调研摘要】（来自 Step 2）
{knowledge_summary}

"""

        if not knowledge_block.strip():
            knowledge_block = "\n（暂无补充参考资料，AI 需基于选题方向自行规划）\n\n"

        user_message = f"""请为以下选题创建协作文档。

## 选题
{selected_topic}

{knowledge_block}请根据上述资料的充足程度，输出协作文档。记住：已有资料能覆盖的内容，AI 全部承担；只有极度缺乏时才向用户提问。

**请在下方输入框中补充上述信息。如果无需补充，请直接点击界面的「下一步」按钮，我将开始为您撰写初稿。**"""

        think_aloud = "📝 正在评估现有资料并生成协作文档...\n"
        if has_knowledge:
            think_aloud += f"  - 已注入补充参考资料（{len(internal_knowledge)} 字）\n"
        if has_summary:
            think_aloud += f"  - 已注入调研摘要（{len(knowledge_summary)} 字）\n"
        if not has_knowledge and not has_summary:
            think_aloud += "  - 暂无参考资料，协作文档将以通用模式生成\n"

        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=user_message,
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
        Step 5: 风格建模（v4.5 极简模式）
        
        降维重构：
        - 不再进行 6 维特征分析或智能匹配
        - 仅展示当前频道可用样文数量
        - Step 7 将随机抽取 1-2 篇样文的原文作为排版与语气参考
        """
        channel_config = self.load_channel_config(channel_id)
        
        think_aloud = "[Step 5] 开始风格建模 (极简模式)...\n"
        
        channel_data = db_service.get_channel_by_slug(channel_id)
        
        # 统计频道可用样文
        all_samples = []
        if channel_data:
            all_samples = db_service.get_style_samples_by_channel(channel_data['id'])
        
        if all_samples:
            think_aloud += f"\n[样文库] ✓ 找到 {len(all_samples)} 篇样文\n"
            for i, s in enumerate(all_samples, 1):
                think_aloud += f"  {i}. 《{s['title']}》({s.get('word_count', 0)} 字)\n"
            think_aloud += "\n→ Step 7 创作时将随机抽取 1-2 篇作为排版与语气参考\n"
        else:
            think_aloud += "\n[样文库] ⚠ 该频道暂无样文，Step 7 将仅依赖频道基础调性\n"
        
        think_aloud += "\n[知识库] 所有参考资料（含理论文档与真实案例/微素材）均通过 RAG 知识库在 Step 7 注入。\n"
        
        style_guide = f"""## 本篇创作风格指引

**可用样文**：{len(all_samples)} 篇（Step 7 将随机抽取 1-2 篇作为排版与语气参考）

## 创作要求
1. **严格模仿参考样文的行文节奏、段落长短、语气语调**
2. **知识库驱动**：Step 7 将自动注入 RAG 补充参考资料（含专业理论与真实案例），请自然融合
3. **保持频道调性**：{channel_config.get('brand_personality', '温润、专业、有深度')}
"""
        
        if task_id:
            db_service.add_think_aloud_log(task_id, 5, think_aloud)
        
        return {
            "output": style_guide,
            "think_aloud": think_aloud,
            "retrieved_materials": [],
            "style_profile": None,
            "selected_sample": None,
            "all_samples": [{"id": str(s["id"]), "title": s["title"]} for s in all_samples],
            "has_sample_recommendation": False
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
    
    async def _summarize_material(self, material: Dict[str, Any], topic: str) -> Dict[str, Any]:
        """
        对长文素材生成摘要和关键点（v3.7 新增）
        
        功能：
        1. 提取核心论点和关键观点
        2. 识别可引用的具体案例/数据
        3. 生成简洁的摘要（便于 AI 理解和运用）
        
        Args:
            material: 素材字典，包含 content, material_type, source 等
            topic: 当前创作的选题，用于关联性分析
            
        Returns:
            包含摘要信息的素材字典
        """
        content = material.get('content', '')
        material_type = material.get('material_type', '其他')
        source = material.get('source', '')
        
        # 只对超过 500 字的长文素材生成摘要
        if len(content) < 500:
            material['summary'] = content[:200] + '...' if len(content) > 200 else content
            material['key_points'] = []
            return material
        
        # 构建摘要提取 Prompt
        summary_prompt = f"""请分析以下{material_type}素材，提取与当前选题相关的核心信息。

【当前选题】
{topic}

【素材内容】（{len(content)}字）
{content[:3000]}  # 限制输入长度

【输出要求】
请用以下格式输出（每项不超过50字）：

**核心观点**：（一句话概括该素材的核心论点）

**关键要点**：
1. （要点1）
2. （要点2）
3. （要点3）

**可引用内容**：（如有具体案例、数据、金句，列出1-2条最有价值的）

**与选题关联**：（说明该素材如何服务于当前选题）"""

        try:
            summary_result = await ai_service.generate_content(
                system_prompt="你是一位专业的内容分析师，擅长从长文档中提取核心信息和可引用素材。请简洁、精准地输出。",
                user_message=summary_prompt,
                temperature=0.3,
                max_tokens=800
            )
            
            # 解析摘要结果
            material['ai_summary'] = summary_result
            material['is_summarized'] = True
            
            # 提取关键要点（简单解析）
            key_points = []
            if '关键要点' in summary_result:
                import re
                points = re.findall(r'\d+[.、](.+?)(?=\d+[.、]|可引用|与选题|$)', summary_result, re.DOTALL)
                key_points = [p.strip()[:100] for p in points if p.strip()][:3]
            material['key_points'] = key_points
            
        except Exception as e:
            print(f"[WARN] 素材摘要生成失败: {e}")
            # 回退：使用简单截断
            material['ai_summary'] = None
            material['summary'] = content[:300] + '...'
            material['key_points'] = []
        
        return material
    
    def _extract_topic_from_brief(self, brief_analysis: str) -> str:
        """
        从需求分析中提取主题关键词用于搜索
        
        Args:
            brief_analysis: Step 1 生成的需求分析
            
        Returns:
            适合搜索的主题关键词字符串
        """
        import re
        
        # 尝试从结构化分析中提取主题
        topic_match = re.search(r'主题[：:]\s*(.+?)(?:\n|$)', brief_analysis)
        if topic_match:
            return topic_match.group(1).strip()
        
        # 尝试提取关键词
        keywords_match = re.search(r'关键词[：:]\s*(.+?)(?:\n|$)', brief_analysis)
        if keywords_match:
            return keywords_match.group(1).strip()
        
        # 回退：提取前几个关键词
        keywords = self._extract_keywords(brief_analysis)
        if keywords:
            return ' '.join(keywords[:5])
        
        # 最后回退：返回前50个字符
        return brief_analysis[:50].replace('\n', ' ')
    
    async def execute_step_6(self) -> Dict[str, Any]:
        """
        Step 6: 创作准备（自动流转，无需用户操作）
        整合 RAG 检索事实与标杆样文特征，为 Step 7 初稿创作封装上下文。
        """
        think_aloud = "[系统自动流转] 真实素材与风格特征已封装完毕，直接启动初稿生成。"
        
        result = "创作上下文已自动封装，系统已整合 RAG 检索事实与标杆样文特征，无缝切入初稿创作阶段。"
        
        return {
            "output": result,
            "think_aloud": think_aloud,
            "is_checkpoint": False
        }
    
    async def execute_step_7(
        self,
        selected_topic: str,
        style_guide: str,
        channel_id: str,
        word_count: int = 1500,
        knowledge_summary: str = "",
        internal_knowledge: str = "",
        user_feedback: str = ""
    ) -> Dict[str, Any]:
        """
        Step 7: 初稿创作（v5.0 - 相关性匹配 + 掐头取尾 + XML 隔离 + RAG 知识注入）
        
        v5.0 三项改造：
        - 废弃 random.sample 盲抽，基于选题关键词相关性评分抽取 Top 2 样文
        - 掐头取尾黄金比例截取（前 700 字 + 后 300 字），保留开篇节奏与结尾升华
        - XML 边界隔离格式包裹样文，附严厉防抄袭警告
        """
        import random
        import re
        
        channel_config = self.load_channel_config(channel_id)
        
        # 动态读取全局禁用书目
        writing_constraints = self.load_writing_constraints()
        banned_books = writing_constraints.get('banned_books', {})
        banned_books_list = '、'.join(banned_books.get('list', []))
        
        # ================================================================
        # v5.0: 基于选题相关性的智能样文抽取 + 掐头取尾截取 + XML 边界隔离
        # ================================================================
        channel_data = db_service.get_channel_by_slug(channel_id)
        all_samples = []
        if channel_data:
            all_samples = db_service.get_style_samples_by_channel(channel_data['id'])
        
        sample_section = ""
        picked_samples = []
        if all_samples:
            # --- 改造 1: 轻量级文本相关性评分，替代 random.sample ---
            topic_keywords = set(re.findall(r'[\u4e00-\u9fff]{2,}', selected_topic))
            
            scored_samples = []
            for s in all_samples:
                score = 0
                title = s.get('title') or ''
                content = s.get('content') or ''
                haystack = title + content[:500]
                for kw in topic_keywords:
                    score += haystack.count(kw)
                scored_samples.append((score, s))
            
            scored_samples.sort(key=lambda x: x[0], reverse=True)
            
            pick_count = min(len(all_samples), 2)
            if scored_samples[0][0] > 0:
                picked_samples = [item[1] for item in scored_samples[:pick_count]]
            else:
                picked_samples = random.sample(all_samples, pick_count)
            
            # --- 改造 2: 掐头取尾黄金比例截取 ---
            def smart_truncate(text: str, head: int = 700, tail: int = 300) -> str:
                """超过 head+tail 字时截取首尾，保留开篇节奏与结尾升华"""
                if not text or len(text) <= head + tail:
                    return text
                return (
                    text[:head]
                    + "\n\n......[中间部分已省略，重点学习文章开头和结尾的升华语调]......\n\n"
                    + text[-tail:]
                )
            
            # --- 改造 3: XML 边界隔离格式 ---
            sample_parts = []
            for i, s in enumerate(picked_samples, 1):
                content_preview = smart_truncate(s.get('content') or '')
                sample_parts.append(
                    f'  <sample index="{i}">\n'
                    f'    <title>《{s["title"]}》</title>\n'
                    f'    <content>{content_preview}</content>\n'
                    f'  </sample>'
                )
            
            sample_section = (
                '<style_reference_samples>\n'
                + '\n'.join(sample_parts)
                + '\n</style_reference_samples>\n\n'
                '⚠️ 请仔细分析 <style_reference_samples> 内的行文骨架、节奏和语气。'
                '绝对禁止照抄 <content> 中的任何具体事实、人名或案例。'
                '它们仅作为排版和语气的模具！\n\n'
            )
        
        # ================================================================
        # 构建 System Prompt（v4.5 聚焦样文原文模仿）
        # ================================================================
        system_prompt = f"""{channel_config['system_prompt']['role']}

## 🎯 你的核心任务
请全神贯注于文字的流动感和对参考样文风格的精准复刻。写出有温度、有节奏、有真实感的初稿。无需担心排版细节，稍后会有审校环节处理。

## 📊 创作规格
- 目标字数：{word_count}字（允许范围：{int(word_count * 0.9)} ~ {int(word_count * 1.1)}字）
- 频道调性：
{chr(10).join(['  - ' + style for style in channel_config['system_prompt']['writing_style']])}
"""
        
        # Think Aloud
        has_knowledge = bool(knowledge_summary and knowledge_summary.strip())
        has_internal = bool(internal_knowledge and internal_knowledge.strip())
        
        think_aloud = f"✍️ 开始创作初稿 (v5.0 相关性匹配 + XML 隔离)...\n\n"
        think_aloud += f"📍 频道：{channel_config['channel_name']}\n"
        think_aloud += f"📍 字数要求：{word_count}字\n"
        
        if picked_samples:
            titles = '、'.join([f"《{s['title']}》" for s in picked_samples])
            think_aloud += f"📍 参考样文：{titles}（相关性匹配 Top {len(picked_samples)} 篇）\n"
        else:
            think_aloud += "📍 参考样文：无（将仅依赖频道基础调性）\n"
        
        think_aloud += "\n💡 本步骤聚焦模仿参考样文的行文风格，违禁词检查将在 Step 8 执行"
        
        # ================================================================
        # 构建调研背景板块
        # ================================================================
        knowledge_section = ""
        if has_knowledge:
            knowledge_section = f"""## 调研背景（来自 Step 2 深度调研）
{knowledge_summary}

> ⚠️ 请结合上述调研背景进行创作，确保文章的专业论据与调研结论保持一致。

"""
        
        # ================================================================
        # 注入 RAG 内部知识库参考
        # ================================================================
        rag_section = ""
        if has_internal:
            rag_section = f"""## 【补充参考资料】
> 以下资料来自知识库，既包含老约翰的专业理论、课程详案，也可能包含真实的课堂案例/微素材。
> 请在行文中自然融合：**以专业理论作为文章的骨架与核心观点，以真实案例/微素材作为论据来增加文章的温度与可读性**。

{internal_knowledge}

"""
            think_aloud += f"\n📚 已注入补充参考资料（{len(internal_knowledge)}字，含专业理论与真实案例）"
        
        has_feedback = bool(user_feedback and user_feedback.strip())
        if has_feedback:
            think_aloud += f"\n💬 已注入用户补充信息（{len(user_feedback)}字）"
        
        feedback_section = ""
        if has_feedback:
            feedback_section = f"""## 【用户补充信息】（来自 Step 4）
> 以下是用户在协作文档阶段主动补充的信息，请务必在创作中采纳和融入。

{user_feedback}

"""
        
        # 获取频道专属规则
        channel_rules = self._build_channel_rules_prompt(channel_config)

        user_message = f"""请为以下选题创作文章初稿：

## 选题
{selected_topic}

## 风格指南
{style_guide}

=========================================
【你的创作弹药库（请深度融合以下素材）】
=========================================
{sample_section}{knowledge_section}{rag_section}{feedback_section}
=========================================
【动笔前的最高军规（系统级硬性校验）】
=========================================
请在开始输出正文前，将以下五条军规死死刻在脑子里。系统将对你的输出进行极其严格的词表扫描，任何触碰底线的行为都将导致输出被直接废弃！

1. **【绝对禁止"无中生妈/生友/生戏"】**：严禁在文章的**任何位置**虚构带有具体称呼的个人叙事或对话剧情！
   - ❌ **绝对禁止**使用："我有一个朋友的儿子乐乐"、"最近收到一位妈妈的留言"、"我侄女最近"等虚假人设。
   - ❌ **绝对禁止**编造家长与孩子之间的家庭对话或生活小剧场。
   - ✅ **必须使用群体泛指**：只能用"很多二年级的孩子"、"不少家长会发现"等客观表述。

2. **【强制使用高级开场白】**：请务必从以下三种高级策略中择一开场：
   - **策略 A：反常识引入** — 直接抛出一个颠覆认知的观点。如："很多人觉得看漫画是浪费时间，但在认知科学里，这其实是一场复杂的视觉推理训练。"
   - **策略 B：客观场景白描** — 像纪录片镜头一样描绘**群体性**的真实阅读状态。如："把一本纯文字书放在二年级孩子面前，不到两分钟，他的目光就开始游移。"（**警告：白描必须是客观泛指，绝不允许给场景中的孩子起名字或加戏！**）
   - **策略 C：直击核心概念** — 直接从文章的核心教育理念切入。如："从'看图'跨越到'看字'，是小学低年级阅读中最关键的分水岭。"

3. **【防偷懒防占位红线】**：在需要举例时，必须且只能从上方的【补充参考资料】中挑选真实教案。绝对禁止引用以下全网泛滥的禁用书目：{banned_books_list}。严禁在文中写出违禁书名并加括号备注（如"注：此处为示例"），禁止使用任何形式的违禁书目作为占位符！

4. **【严禁凭空捏造具体案例】**：所有具体的教学案例、故事、数据必须来自上方的参考资料，绝不允许编造。**引出痛点时也在此约束范围内，宁可简化为纯理论论述，也绝不能自己编造一个带有具体姓名的小故事来充数。**

5. **【结构镜像与去 AI 味（最高行文准则）】**：
   - **结构像素级镜像**：你必须精准识别并采用【参考样文】的文本骨架（是扁平罗列还是叙事推进）。除非样文中出现了多层嵌套结构，否则你**绝对禁止**自行发明"方法一 -> 第一步 -> 做法"这种冗杂的说明书式多层嵌套排版。
   - **戒断 AI 式行文套路**：严禁高频使用"什么是xxx？"、"怎么做呢？"、"为什么呢？"等生硬的自问自答作为段落过渡，请使用人类作者自然平滑的叙述逻辑。
   - **拒绝爹味说教**：在分析问题时，必须保持与读者（家长）平视共情的温润基调，绝不允许使用居高临下、指责或过度批判的语气。

{channel_rules}

确认已牢记上述军规及频道铁律，请直接输出纯净的文章初稿：
"""
        
        estimated_tokens = min(int(word_count * 1.5), 4000)
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.7,
            max_tokens=estimated_tokens
        )
        
        return {
            "output": result,
            "think_aloud": think_aloud,
            # 将本次匹配到的样文标题传递给路由层，以便保存到 brief_data
            "selected_samples": [{"id": str(s["id"]), "title": s["title"]} for s in picked_samples]
        }
    
    async def execute_step_8(
        self, 
        draft: str, 
        channel_id: str, 
        word_count: int = 1500,
        style_profile: Dict[str, Any] = None  # 风格画像
    ) -> Dict[str, Any]:
        """
        Step 8: 纪律审校机制（v3.7 - 接管所有禁令检查）
        
        职责：
        1. 第一遍：逻辑把控 - 结构与行文逻辑
        2. 第二遍：知识准确性核对 - 频道底线 + 全局反偷懒双重质检
        3. 第三遍：语气润色 - 去 AI 腔 + 屏蔽词替换
        4. 第四遍：排版与细节审校 - 字数控制 + 长句拆分
        
        反馈机制：发现违禁内容执行局部重写，而非让 Step 7 全局重来
        """
        channel_config = self.load_channel_config(channel_id)
        blocked_words_config = self.load_blocked_words()
        writing_constraints = self.load_writing_constraints()
        
        # 从配置文件加载禁用书目
        banned_books_config = writing_constraints.get('banned_books', {})
        banned_books_list = ''.join(banned_books_config.get('list', []))
        banned_books_hint = banned_books_config.get('replacement_hint', '请选择更小众但同样优质的作品')
        
        # 计算当前草稿字数（允许 ±10% 偏差）
        current_word_count = len(draft)
        max_allowed = int(word_count * 1.1)  # 上限：目标字数的110%
        min_allowed = int(word_count * 0.9)  # 下限：目标字数的90%
        is_over_limit = current_word_count > max_allowed
        
        # ================================================================
        # 构建屏蔽词替换表（规则优先 + AI 兜底）
        # ================================================================
        blocked_phrases_with_replacement = []
        for category in blocked_words_config['categories'].values():
            category_name = category.get('name', '未分类')
            for pattern in category['patterns']:
                blocked_phrases_with_replacement.append(
                    f"| {pattern['phrase']} | {pattern['replacement']} | {pattern['reason']} |"
                )
        
        # 频道严格禁止项
        channel_must_not_do = channel_config['channel_specific_rules'].get('must_not_do', [])
        
        # 根据是否超字数调整审校要求（允许 ±10% 偏差）
        word_count_instruction = ""
        if is_over_limit:
            word_count_instruction = f"""
## ⚠️ 字数超限警告
- 当前字数：{current_word_count}字
- 目标字数：{word_count}字（允许范围：{min_allowed}~{max_allowed}字）
- 超出上限：{current_word_count - max_allowed}字
- 【必须执行】在审校过程中精简内容，删除冗余表达，确保最终版本不超过{max_allowed}字
"""
        else:
            word_count_instruction = f"""
## 字数检查
- 当前字数：{current_word_count}字
- 目标字数：{word_count}字（允许范围：{min_allowed}~{max_allowed}字）
- 字数符合要求 ✓
"""
        
        # ================================================================
        # v3.8: 禁用书目从配置文件加载（writing_constraints.json）
        # ================================================================
        
        channel_rules_prompt = self._build_channel_rules_prompt(channel_config)
        channel_rules_audit_section = ""
        if channel_rules_prompt:
            channel_rules_audit_section = f"""{channel_rules_prompt}
> 请作为严厉的审核员，逐句检查文章是否违反了上述【绝对禁止】的事项，如果发现，必须彻底改写。

"""
        
        system_prompt = f"""你是专业的内容审校专家，负责纪律把关和最终润色。
请对文章进行**四遍专项审校**，发现问题直接**局部重写**修复，无需返回上一步。

{channel_rules_audit_section}{word_count_instruction}

---

## 🔴 第一遍：逻辑把控

检查文章的整体结构与行文逻辑：
- 文章是否有清晰的起承转合？是否存在段落跳跃、论据断裂？
- 每个论点是否有对应的论据支撑？是否出现"观点悬空"（只有结论无例证）？
- 段落之间的过渡是否自然连贯？
- 如发现问题，直接调整段落顺序或补充过渡句，进行局部重写。

---

## 🟡 第二遍：知识准确性核对（双重质检）

请严格核对文章内容及推荐的书目，执行以下双重检查：

### 1. 【频道专属底线】
是否违反了该频道的【严格禁止】规则，或包含了该频道的【屏蔽词汇】。绝不要推荐超出该频道受众认知阶段的书籍。

**频道屏蔽词**（禁止出现）：{', '.join(channel_config['blocked_phrases'])}
**频道严格禁止项**：
{chr(10).join(['- ❌ ' + rule for rule in channel_must_not_do])}

### 2. 【禁用书目清理法则（泛化与抹除）】
检查文章是否违规使用了以下书目：{banned_books_list}

如果在初稿中发现了上述禁用书目，绝不能仅仅简单替换书名为"某经典童书"（这会导致保留原书特有情节，造成逻辑荒谬）。
你必须：直接删除该违禁书名，并**连同删除所有与该书强相关的具体细节（如特定的动物、人名、专属情节）**。将原句平滑重写为一句宏观的阅读现象总结。
例如：将"看完《夏洛的网》后会追问蜘蛛怎么织网"，整体泛化修改为"看完经典的长篇童书后，孩子会开始追问故事背后的更深层逻辑"。务必确保修改后的上下文逻辑绝对顺畅。
请在审校报告中对每处清理进行【标红警告】，说明原文内容和泛化后的替代文本。

---

## 🟢 第三遍：语气润色（去 AI 腔）

### 全局屏蔽词替换表
请逐一检查文章中是否包含以下词汇，如有则**必须替换**：

| 禁用短语 | 替换为 | 原因 |
|---------|-------|------|
{chr(10).join(blocked_phrases_with_replacement[:25])}

**替换原则**：
1. 优先使用上表中的「替换为」建议
2. 如果替换建议不适合当前语境，可自行调整，但需保持口语化、有温度
3. 发现违禁词后，直接在原文位置进行局部重写，保持上下文连贯

---

## 🔵 第四遍：排版与细节审校

- 句子长度：拆分超过 40 字的长句
- 段落长度：每段不超过 200 字，过长段落适当留白分段
- 标点符号：检查使用是否自然
- 自然语调：读起来像人在说话，而非机器输出
- 【重要】请凭借你的内容把控力，通过删减冗余使文章体量尽量贴近目标要求。**绝对禁止**在最终修改后的文章标题或末尾自己捏造并标注"全文共xxx字"、"修改后版本（xxx字）"等字眼！只输出纯净的正文即可。

---

## 📋 输出格式

### 审校报告

#### 第一遍：逻辑把控
- 结构调整：（说明做了哪些段落顺序或过渡句的修改，无问题则注明"结构合理，无需调整"）

#### 第二遍：知识准确性核对
- 黑名单：（未发现 / 已替换 xxx → xxx）
- 事实核查：（均有据可依 / 已修正 xxx）

#### 第三遍：语气润色
| 原文 | 替换为 | 位置 |
|-----|-------|------|
| xxx | xxx | 第x段 |

#### 第四遍：排版与细节审校
- 冗余精简：已删除/精简了 xxx 等冗长表述（若无严重超标则填"体量适中，正常润色"）
- 长句拆分：x 处
- 段落调整：x 处

---

### 修改后版本
（输出完整的修改后文章，确保所有审校问题已修复）
"""
        
        think_aloud = f"🔍 开始纪律审校（v3.7）...\n\n"
        think_aloud += f"📊 当前字数：{current_word_count}字（目标：{word_count}字，允许范围：{min_allowed}~{max_allowed}字）\n\n"
        think_aloud += "📋 四遍专项审校流程：\n"
        think_aloud += "  🔴 第一遍：逻辑把控（结构调整、起承转合优化）\n"
        think_aloud += "  🟡 第二遍：知识准确性核对（黑白名单 + 事实核查）\n"
        think_aloud += "  🟢 第三遍：语气润色（去 AI 腔、屏蔽词替换）\n"
        think_aloud += "  🔵 第四遍：排版与细节审校（字数控制 + 长句拆分）\n\n"
        think_aloud += "💡 反馈机制：发现违禁内容将执行局部重写，无需返回 Step 7"
        
        # 动态调整 max_tokens
        estimated_tokens = min(int(word_count * 2.5), 8000)  # 预留审校报告空间
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"请对以下文章进行四遍审校（字数允许范围：{min_allowed}~{max_allowed}字）：\n\n{draft}",
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

