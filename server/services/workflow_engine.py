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
        # 阶段零：真实网络搜索（如果 Tavily API 可用）
        # ====================================================================
        search_context = ""
        knowledge_sources = []
        
        if search_service.is_available():
            think_aloud += "  - 🌐 正在进行网络搜索...\n"
            
            search_result = await search_service.search_for_research(
                topic=topic_keywords,
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
        
        # ====================================================================
        # 阶段一：生成详尽调研资料
        # ====================================================================
        if search_context:
            # 有搜索结果，基于真实来源生成
            research_prompt = """你是一位资深的内容调研专家。请根据以下【真实搜索结果】，整理出结构化的调研报告。

## 重要要求
1. **必须基于搜索结果**：只使用搜索结果中的信息，不要编造
2. **标注来源**：在关键信息后标注来源编号，如 [来源1]
3. **结构清晰**：按主题分类整理

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

请基于以上搜索结果，生成结构化的调研报告。"""
        else:
            # 无搜索结果，使用传统方式
            research_prompt = """你是一位资深的内容调研专家。请根据创作需求，进行全面深入的资料调研。

## 调研要求
1. **信息全面**：覆盖主题的各个关键维度
2. **有据可查**：标注信息来源类型（学术研究/官方数据/专家观点/案例实证）
3. **实用导向**：聚焦对创作有实际价值的信息
4. **结构清晰**：分类整理，便于后续引用

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
            
            user_message = f"请根据以下需求分析进行深度调研：\n\n{brief_analysis}"
        
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

【输出格式示例】
核心发现：
1. 第一个要点的一句话概括
2. 第二个要点的一句话概括
3. 第三个要点的一句话概括

创作建议：一句话说明这些发现对文章创作的指导意义。

【禁止事项】
- 不要使用 # ## ### 等标题符号
- 不要使用 ** __ 等加粗符号
- 不要使用 <strong> <b> 等 HTML 标签
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
            "think_aloud": think_aloud,
            "is_checkpoint": True  # 设为卡点，需用户确认
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

## ⚠️ 禁用书目（避免AI味）
举例时禁止使用以下被过度引用的常见书目：
《夏洛的网》《小王子》《窗边的小豆豆》《爱心树》《猜猜我有多爱你》《逃家小兔》《好饿的毛毛虫》《大卫不可以》
- 如需书籍举例，请选择更小众但同样优质的作品

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
        Step 5: 风格建模与素材检索 (v3.5 - 样文矩阵模式)
        
        核心变化：
        1. 切换为"样文矩阵"模式，每篇样文独立保持 6 维特征
        2. 智能推荐最匹配的单篇样文（基于 custom_tags + Brief 关键词）
        3. 主编可在前端选择/切换参考样文
        4. Step 7 将使用所选样文的独立 style_profile
        """
        channel_config = self.load_channel_config(channel_id)
        
        think_aloud = "[Step 5] 开始风格建模与素材检索 (样文矩阵模式)...\n"
        
        # 获取频道数据
        channel_data = db_service.get_channel_by_slug(channel_id)
        
        # ====================================================================
        # 1. 样文矩阵：获取所有已分析的样文，智能推荐最匹配的一篇
        # ====================================================================
        think_aloud += "\n[样文矩阵] 正在加载样文库...\n"
        
        style_profile = None
        recommended_sample = None
        all_samples = []
        
        # v3.5: 从独立表获取样文
        if channel_data:
            # 提取关键词用于匹配
            keywords = self._extract_keywords(selected_topic)
            think_aloud += f"  - 选题关键词: {', '.join(keywords[:5])}\n"
            
            # 获取样文并计算匹配分数
            all_samples = db_service.get_style_samples_for_matching(
                channel_id=channel_data['id'],
                keywords=keywords
            )
            
            if all_samples:
                think_aloud += f"  - ✓ 找到 {len(all_samples)} 篇已分析的样文\n"
                
                # 推荐匹配度最高的样文
                recommended_sample = all_samples[0]
                matched_tags = recommended_sample.get('matched_tags', [])
                
                think_aloud += f"\n[智能推荐] 最佳匹配样文：《{recommended_sample['title']}》\n"
                if matched_tags:
                    think_aloud += f"  - 匹配标签: {', '.join(matched_tags)}\n"
                think_aloud += f"  - 匹配分数: {recommended_sample.get('match_score', 0)}\n"
                
                # 使用推荐样文的 style_profile 作为默认
                style_profile = recommended_sample.get('style_profile', {})
                
                # 展示该样文的 6 维特征摘要
                if style_profile:
                    dims = style_profile
                    think_aloud += "  - 6 维特征:\n"
                    if dims.get('opening_style'):
                        think_aloud += f"    · 开头: {dims['opening_style'].get('type', '-')}\n"
                    if dims.get('tone'):
                        think_aloud += f"    · 语气: {dims['tone'].get('type', '-')}\n"
                    if dims.get('ending_style'):
                        think_aloud += f"    · 结尾: {dims['ending_style'].get('type', '-')}\n"
            else:
                think_aloud += "  - ⚠ 该频道暂无已分析的样文\n"
        
        # 回退：如果没有独立表样文，尝试从旧 JSONB 字段获取
        if not style_profile:
            style_samples = channel_data.get('style_samples', []) if channel_data else []
            
            if channel_data and channel_data.get('style_profile'):
                style_profile = channel_data['style_profile']
                think_aloud += f"  - 回退到频道整体风格画像\n"
            elif style_samples:
                # 使用第一篇样文的特征
                for sample in style_samples:
                    if sample.get('features'):
                        style_profile = sample['features']
                        think_aloud += f"  - 使用样文《{sample.get('title', '无标题')}》的特征\n"
                        break
        
        # 最终回退：默认风格
        if not style_profile:
            think_aloud += "  - ⚠ 使用默认风格配置\n"
            style_profile = {
                "style_portrait": "专业而亲切的内容创作者，用真诚的态度分享观点",
                "structural_logic": ["场景切入", "问题引出", "观点展开", "案例支撑", "总结升华"],
                "tone_features": ["真诚", "专业", "亲切"],
                "opening_style": {"type": "story_intro", "description": "建议用生活场景引入"},
                "tone": {"type": "warm_friend", "formality": 0.3, "description": "温润亲切，像朋友聊天"},
                "ending_style": {"type": "reflection", "description": "引导读者思考"},
                "writing_guidelines": ["避免说教语气", "多用短句", "融入真实经历"]
            }
        
        # ====================================================================
        # 2. 从数据库检索真实素材
        # ====================================================================
        think_aloud += "\n[RAG] 正在从素材库检索相关素材...\n"
        think_aloud += f"  - 频道过滤: {channel_id}\n"
        
        retrieved_materials = []
        raw_materials = []
        
        if channel_data:
            keywords = self._extract_keywords(selected_topic)
            think_aloud += f"  - 检索关键词: {', '.join(keywords)}\n"
            
            # 增大检索量，为去重留余量
            raw_materials = db_service.search_materials_by_keywords(
                channel_id=channel_data["id"],
                keywords=keywords,
                limit=15
            )
            think_aloud += f"  - 原始检索: {len(raw_materials)} 条素材\n"
        
        if not raw_materials and channel_data:
            think_aloud += "  - 未找到精确匹配，获取频道通用素材...\n"
            raw_materials = db_service.get_materials_by_channel(
                channel_id=channel_data["id"],
                limit=15
            )
        
        # ====================================================================
        # 2.1 素材清洗与去重
        # ====================================================================
        if raw_materials:
            think_aloud += "\n[素材处理] 开始清洗与去重...\n"
            original_count = len(raw_materials)
            
            # 调用素材处理器：噪声过滤 + 来源去重 + 内容去重
            retrieved_materials = process_materials(
                raw_materials,
                enable_spam_filter=True,
                enable_source_dedupe=True,
                enable_content_dedupe=True,
                content_similarity_threshold=0.85
            )
            
            # 限制最终数量
            retrieved_materials = retrieved_materials[:8]
            
            removed_count = original_count - len(retrieved_materials)
            if removed_count > 0:
                think_aloud += f"  - 清洗完成: {original_count} -> {len(retrieved_materials)} 条\n"
                think_aloud += f"  - 移除 {removed_count} 条重复/营销内容\n"
            else:
                think_aloud += f"  - 清洗完成: {len(retrieved_materials)} 条有效素材\n"
        
        # ====================================================================
        # 2.2 素材分类（长文 vs 短碎）
        # ====================================================================
        classified_materials = {"long": [], "short": []}
        if retrieved_materials:
            classified_materials = classify_materials(retrieved_materials, long_threshold=200)
            think_aloud += f"  - 分类: {len(classified_materials['long'])} 条长文 + {len(classified_materials['short'])} 条灵感碎片\n"
        
        # ====================================================================
        # 3. 格式化输出
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
            
            think_aloud += f"\n[RAG] 已注入 {len(retrieved_materials)} 条真实素材\n"
        else:
            think_aloud += "\n[WARN] 素材库中暂无相关素材，请在创作时注入真实经历\n"
        
        # ====================================================================
        # 4. 生成风格指导文档 (v3.5 简化，不再显示 JSON)
        # ====================================================================
        
        # 构建风格摘要（去 JSON 化）
        style_summary = ""
        if style_profile:
            if style_profile.get('style_portrait'):
                style_summary += f"**风格画像**：{style_profile['style_portrait']}\n\n"
            
            if style_profile.get('structural_logic'):
                logic = style_profile['structural_logic']
                style_summary += f"**结构逻辑**：{' → '.join(logic[:5])}\n\n"
            
            if style_profile.get('tone_features'):
                style_summary += f"**语气特征**：{', '.join(style_profile['tone_features'][:4])}\n\n"
            
            if style_profile.get('writing_guidelines'):
                guidelines = style_profile['writing_guidelines']
                style_summary += "**创作指南**：\n"
                for i, g in enumerate(guidelines[:5], 1):
                    style_summary += f"  {i}. {g}\n"
        
        sample_info = ""
        if recommended_sample:
            sample_info = f"""
## 推荐参考样文
- **标题**：《{recommended_sample['title']}》
- **标签**：{', '.join(recommended_sample.get('custom_tags', []) or ['无标签'])}
- **匹配度**：{recommended_sample.get('match_score', 0)} 分

> 本次创作将参考此样文的写作范式。如需更换，请在工作台选择其他样文。
"""
        
        style_guide = f"""## 本篇创作风格指引

{style_summary}
{sample_info}

## 创作要求
1. **严格模仿所选样文的写作范式**（开头方式、句式节奏、语气特点、结尾风格）
2. **真实素材优先**：将检索到的真实经历自然融入，禁止凭空编造案例
3. **保持频道调性**：{channel_config.get('brand_personality', '温润、专业、有深度')}

{materials_context}
"""
        
        # 持久化 Think Aloud
        if task_id:
            db_service.add_think_aloud_log(task_id, 5, think_aloud)
        
        return {
            "output": style_guide,
            "think_aloud": think_aloud,
            "retrieved_materials": retrieved_materials,
            "classified_materials": classified_materials,
            "style_profile": style_profile,
            # v3.5 新增：样文推荐数据
            "recommended_sample": recommended_sample,
            "all_samples": all_samples,
            "has_sample_recommendation": bool(recommended_sample)
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
        word_count: int = 1500,  # 默认字数限制
        style_profile: Dict[str, Any] = None,  # 风格画像
        selected_sample: Dict[str, Any] = None  # v3.5: 所选的单一标杆样文
    ) -> Dict[str, Any]:
        """
        Step 7: 初稿创作（v3.5 - 单一标杆驱动）
        
        核心变化：
        1. 优先使用所选样文的独立 style_profile（单一标杆）
        2. 如果用户修改了创作指南，人工干预覆盖样文默认特征
        3. 严禁凭空编造案例
        
        优先级（从高到低）：
        1. 用户特殊要求 (custom_requirement)
        2. 用户修改的创作指南 (writing_guidelines)
        3. 所选样文的 6 维特征约束 (selected_sample.style_profile)
        4. 频道基本人格设定
        """
        channel_config = self.load_channel_config(channel_id)
        
        # ================================================================
        # v3.5: 确定使用的风格来源
        # ================================================================
        effective_style_profile = None
        style_source = "默认"
        
        # 优先级1: 使用用户自定义的 style_profile（如果有）
        if style_profile and style_profile.get('is_customized'):
            effective_style_profile = style_profile
            style_source = "用户自定义"
        # 优先级2: 使用所选样文的独立 style_profile
        elif selected_sample and selected_sample.get('style_profile'):
            effective_style_profile = selected_sample['style_profile']
            style_source = f"样文《{selected_sample.get('title', '未知')}》"
        # 优先级3: 使用传入的 style_profile（可能是频道整体画像）
        elif style_profile:
            effective_style_profile = style_profile
            style_source = "频道风格画像"
        
        # ================================================================
        # 提取风格关键信息
        # ================================================================
        style_instructions = ""
        structural_logic = []
        writing_guidelines = []
        
        # 获取结构逻辑和创作指南
        if effective_style_profile:
            structural_logic = effective_style_profile.get('structural_logic', [])
            writing_guidelines = effective_style_profile.get('writing_guidelines', [])
            
            # 直接使用样文的特征（不再区分 stable_features 和 dimensions）
            dims = effective_style_profile
        else:
            dims = {}
        
        if dims or structural_logic or writing_guidelines:
            style_instructions = """
## 🎨 【强制】风格 DNA 对齐（必须 100% 遵守）

"""
            # ============================================================
            # 1. 结构逻辑（必须按此顺序组织段落）
            # ============================================================
            if structural_logic:
                style_instructions += "### 📐 段落结构（必须按此顺序）\n"
                for i, step in enumerate(structural_logic[:6], 1):
                    style_instructions += f"  {i}. {step}\n"
                style_instructions += "\n**要求**：文章必须严格按照上述结构安排段落，不得遗漏或乱序。\n\n"
            
            # ============================================================
            # 2. 六维风格特征
            # ============================================================
            if dims:
                style_instructions += "### 🎭 六维风格特征\n\n"
                
                # 开头方式
                if dims.get('opening_style'):
                    opening = dims['opening_style']
                    style_instructions += f"**【开头】** 类型：{opening.get('type', '故事引入')}\n"
                    if opening.get('description'):
                        style_instructions += f"  - 要求：{opening['description']}\n"
                    if opening.get('examples'):
                        style_instructions += f"  - 参考：「{opening['examples'][0][:50]}...」\n"
                    style_instructions += "\n"
                
                # 句式特征
                if dims.get('sentence_pattern'):
                    sp = dims['sentence_pattern']
                    short_ratio = sp.get('short_ratio', 0.6)
                    style_instructions += f"**【句式】** 短句占比：{short_ratio * 100:.0f}%\n"
                    if sp.get('favorite_punctuation'):
                        style_instructions += f"  - 常用标点：{', '.join(sp['favorite_punctuation'][:5])}\n"
                    if sp.get('description'):
                        style_instructions += f"  - 特征：{sp['description']}\n"
                    style_instructions += "\n"
                
                # 段落节奏
                if dims.get('paragraph_rhythm'):
                    pr = dims['paragraph_rhythm']
                    style_instructions += f"**【段落】** 节奏变化：{pr.get('variation', 'medium')}\n"
                    if pr.get('description'):
                        style_instructions += f"  - 特征：{pr['description']}\n"
                    style_instructions += "\n"
                
                # 语气特点
                if dims.get('tone'):
                    tone = dims['tone']
                    formality = tone.get('formality', 0.3)
                    style_instructions += f"**【语气】** 类型：{tone.get('type', '温润亲切')}\n"
                    style_instructions += f"  - 正式度：{formality * 100:.0f}%（{'口语化' if formality < 0.4 else '半正式' if formality < 0.7 else '正式'}）\n"
                    if tone.get('description'):
                        style_instructions += f"  - 要求：{tone['description']}\n"
                    style_instructions += "\n"
                
                # 结尾风格
                if dims.get('ending_style'):
                    ending = dims['ending_style']
                    style_instructions += f"**【结尾】** 类型：{ending.get('type', '引导思考')}\n"
                    if ending.get('description'):
                        style_instructions += f"  - 要求：{ending['description']}\n"
                    style_instructions += "\n"
                
                # 常用表达
                if dims.get('expressions'):
                    expr = dims['expressions']
                    if expr.get('high_freq_words'):
                        style_instructions += f"**【推荐用词】** {', '.join(expr['high_freq_words'][:8])}\n"
                    if expr.get('avoid_words'):
                        style_instructions += f"**【禁止用词】** {', '.join(expr['avoid_words'][:8])}（一旦出现即为不合格）\n"
                    style_instructions += "\n"
            
            # ============================================================
            # 3. 创作指南（每条都是硬性要求）
            # ============================================================
            if writing_guidelines:
                style_instructions += "### 📋 创作指南（每条都是硬性规则）\n"
                for i, guideline in enumerate(writing_guidelines[:10], 1):
                    style_instructions += f"  {i}. ✅ {guideline}\n"
                style_instructions += "\n**审校标准**：上述每条指南都将在 Step 8 审校中逐一检查，不符合的将被退回修改。\n"
            
            # ============================================================
            # 4. 本篇特殊要求（用户自定义，最高优先级）
            # ============================================================
            custom_requirement = style_profile.get('custom_requirement') if style_profile else None
            if custom_requirement:
                style_instructions += f"\n### ⭐ 本篇特殊要求（最高优先级）\n"
                style_instructions += f"用户明确要求：{custom_requirement}\n"
                style_instructions += "**必须严格执行上述特殊要求，不得忽略！**\n"
        
        # 构建 System Prompt
        system_prompt = f"""{channel_config['system_prompt']['role']}

## ⚠️ 核心约束：字数要求
- 目标字数：{word_count}字
- 允许范围：{int(word_count * 0.9)}字 ~ {int(word_count * 1.1)}字（±10%偏差）
- 优先保证内容完整性和质量
{style_instructions}

## ⚠️ 核心约束：真实素材
- 文中所有案例、故事、引用必须来自下方提供的【可用素材】
- 严禁凭空编造任何案例或数据
- 如果素材不够用，请简化内容而不是捏造

## ⚠️ 核心约束：禁用书目（避免AI味）
举例时禁止使用以下被过度引用的常见书目：
《夏洛的网》《小王子》《窗边的小豆豆》《爱心树》《猜猜我有多爱你》《逃家小兔》《好饿的毛毛虫》《大卫不可以》
- 这些书籍因过于经典已成为AI默认举例，容易让内容千篇一律
- 如需书籍举例，请优先使用素材中提及的书目，或选择更小众但同样优质的作品

## 写作风格要求
{chr(10).join(['- ' + style for style in channel_config['system_prompt']['writing_style']])}

## 禁用表达
{', '.join(channel_config['blocked_phrases'])}

## 频道规则
必须遵守：{chr(10).join(['- ' + rule for rule in channel_config['channel_specific_rules']['must_do']])}
严格禁止：{chr(10).join(['- ' + rule for rule in channel_config['channel_specific_rules']['must_not_do']])}
"""
        
        # 构建 Think Aloud (v3.5 显示样文来源)
        is_customized = effective_style_profile.get('is_customized', False) if effective_style_profile else False
        custom_req = effective_style_profile.get('custom_requirement', '') if effective_style_profile else ''
        
        think_aloud = f"✍️ 开始创作初稿 (单一标杆模式)...\n\n"
        think_aloud += f"📍 频道：{channel_config['channel_name']}\n"
        think_aloud += f"📍 调性：{channel_config['brand_personality']}\n"
        think_aloud += f"📍 字数要求：{word_count}字\n"
        think_aloud += f"📍 风格来源：{style_source}\n"
        
        if is_customized:
            think_aloud += "⚡ 用户已自定义风格配置，将优先执行用户修改的规则\n"
        if custom_req:
            think_aloud += f"⚡ 特殊要求：{custom_req[:50]}...\n"
        
        think_aloud += "\n正在融入品牌风格和真实素材..."
        
        user_message = f"""请创作文章初稿。

## 选题
{selected_topic}

## 风格指南
{style_guide}

## 可用素材（只能使用这些，禁止编造）
{materials}

## ⚠️ 创作要求
1. 文章总字数：{int(word_count * 0.9)} ~ {int(word_count * 1.1)} 字（允许±10%偏差）
2. 严格模仿风格画像中的开头方式、句式节奏、语气特点
3. 真实素材自然融入，禁止凭空编造案例

请开始创作，直接输出文章内容。
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
    
    async def execute_step_8(
        self, 
        draft: str, 
        channel_id: str, 
        word_count: int = 1500,
        style_profile: Dict[str, Any] = None  # 风格画像
    ) -> Dict[str, Any]:
        """
        Step 8: 三遍审校机制 + 风格 DNA 对齐检查
        
        新增：基于风格画像的评分标准检查
        """
        channel_config = self.load_channel_config(channel_id)
        blocked_words_config = self.load_blocked_words()
        
        # 计算当前草稿字数（允许 ±10% 偏差）
        current_word_count = len(draft)
        max_allowed = int(word_count * 1.1)  # 上限：目标字数的110%
        min_allowed = int(word_count * 0.9)  # 下限：目标字数的90%
        is_over_limit = current_word_count > max_allowed
        
        # 构建屏蔽词列表
        blocked_phrases = []
        for category in blocked_words_config['categories'].values():
            for pattern in category['patterns']:
                blocked_phrases.append(f"- {pattern['phrase']} → {pattern['replacement']} （原因：{pattern['reason']}）")
        
        # ================================================================
        # 构建风格 DNA 对齐检查清单
        # ================================================================
        style_checklist = ""
        if style_profile:
            dims = style_profile.get('stable_features') or style_profile.get('dimensions', {})
            structural_logic = style_profile.get('structural_logic', [])
            writing_guidelines = style_profile.get('writing_guidelines', [])
            
            style_checklist = """
## 🎯 风格 DNA 对齐检查（必须逐项打分）

请对照以下标准检查文章，每项打分 ✓（符合）或 ✗（不符）：

### 结构检查
"""
            # 结构逻辑检查
            if structural_logic:
                style_checklist += "文章段落是否按以下顺序组织：\n"
                for i, step in enumerate(structural_logic[:6], 1):
                    style_checklist += f"  {i}. [ ] {step}\n"
            
            # 六维特征检查
            style_checklist += "\n### 六维特征检查\n"
            
            if dims.get('opening_style'):
                opening = dims['opening_style']
                style_checklist += f"1. [开头] 是否采用「{opening.get('type', '故事引入')}」方式？ [ ]\n"
            
            if dims.get('sentence_pattern'):
                sp = dims['sentence_pattern']
                short_ratio = sp.get('short_ratio', 0.6)
                style_checklist += f"2. [句式] 短句占比是否 ≥ {short_ratio * 100:.0f}%？ [ ]\n"
                if sp.get('favorite_punctuation'):
                    style_checklist += f"   - 是否使用了这些标点：{', '.join(sp['favorite_punctuation'][:3])}？ [ ]\n"
            
            if dims.get('tone'):
                tone = dims['tone']
                style_checklist += f"3. [语气] 是否为「{tone.get('type', '温润亲切')}」风格？ [ ]\n"
                formality = tone.get('formality', 0.3)
                style_checklist += f"   - 正式度是否约 {formality * 100:.0f}%？ [ ]\n"
            
            if dims.get('ending_style'):
                ending = dims['ending_style']
                style_checklist += f"4. [结尾] 是否采用「{ending.get('type', '引导思考')}」方式？ [ ]\n"
            
            if dims.get('expressions'):
                expr = dims['expressions']
                if expr.get('avoid_words'):
                    style_checklist += f"5. [禁词] 是否使用了禁止用词 {', '.join(expr['avoid_words'][:5])}？ [ ] （必须为 ✗）\n"
            
            # 创作指南检查
            if writing_guidelines:
                style_checklist += "\n### 创作指南检查\n"
                style_checklist += "请逐条检查是否遵守：\n"
                for i, guideline in enumerate(writing_guidelines[:10], 1):
                    style_checklist += f"  {i}. [ ] {guideline}\n"
            
            style_checklist += """
### 对齐评分
- 总分 = 符合项数 / 总项数 × 100%
- 合格线：≥ 80%
- 若不合格，必须修改后重新输出
"""
        
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
        
        system_prompt = f"""你是专业的内容审校专家。请对文章进行四遍审校。
{word_count_instruction}
{style_checklist}

## 一审：内容审校
- 事实准确性
- 逻辑清晰度
- 论证充分性
- 是否有编造内容（严禁编造！）

## 二审：风格 DNA 对齐（重点！）
对照上方《风格 DNA 对齐检查》清单，逐项打分。
- 不符合的项必须修改
- 对齐分数必须 ≥ 80%

## 三审：风格审校（去AI味）
频道要求：{channel_config['brand_personality']}

全局屏蔽词（必须检查）：
{chr(10).join(blocked_phrases[:20])}  

频道屏蔽词：
{', '.join(channel_config['blocked_phrases'])}

## 四审：细节打磨 + 字数控制
- 句子长度（拆分超过40字的长句）
- 段落长度（每段不超过200字）
- 标点符号
- 自然语调
- 情感共鸣
- 【重要】确保总字数在{min_allowed}~{max_allowed}字范围内（±10%偏差）

输出格式：
## 审校报告

### 风格 DNA 对齐评分
| 检查项 | 结果 | 说明 |
|-------|------|-----|
| 开头方式 | ✓/✗ | ... |
| 句式特征 | ✓/✗ | ... |
| 语气风格 | ✓/✗ | ... |
| 结尾方式 | ✓/✗ | ... |
| 禁词检查 | ✓/✗ | ... |
| 创作指南1 | ✓/✗ | ... |
| ... | ... | ... |

**对齐分数：xx%**（{"需要修改" if True else "符合要求"}）

### 其他问题
1. [内容] xxx
2. [风格] xxx
3. [细节] xxx
4. [字数] 当前xxx字，{"需要精简" if is_over_limit else "符合要求"}

### 修改后版本
（输出完整的修改后文章，确保对齐分数 ≥ 80% 且字数在{min_allowed}~{max_allowed}字范围内）
"""
        
        think_aloud = f"🔍 开始四遍审校...\n\n当前字数：{current_word_count}字（目标：{word_count}字，允许范围：{min_allowed}~{max_allowed}字）\n\n第一遍：内容审校\n第二遍：风格 DNA 对齐检查\n第三遍：风格审校（去AI味）\n第四遍：细节打磨 + 字数控制"
        
        # 动态调整 max_tokens
        estimated_tokens = min(int(word_count * 2.5), 8000)  # 预留审校报告空间
        
        result = await ai_service.generate_content(
            system_prompt=system_prompt,
            user_message=f"请对以下文章进行四遍审校（字数允许范围：{min_allowed}~{max_allowed}字，对齐分数 ≥ 80%）：\n\n{draft}",
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

