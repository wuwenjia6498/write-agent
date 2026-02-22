# AI 创作流逻辑审计报告

> 审计日期：2026-02-02  
> 审计范围：写作工作流 (Writing Workflow) Step 1-9 全流程  
> 审计目标：梳理 AI 在各环节读取的数据库字段、遵循的规则、潜在冲突及优化建议

---

## 📊 审计总览

| 模块 | 文件 | 代码行数 |
|------|------|----------|
| 工作流引擎 | `server/services/workflow_engine.py` | 1171 行 |
| 路由层 | `server/routes/workflow.py` | 1023 行 |
| AI 服务 | `server/services/ai_service.py` | 127 行 |
| 数据库服务 | `server/services/db_service.py` | 1411 行 |
| 素材处理器 | `server/services/material_processor.py` | 295 行 |
| 数据模型 | `server/database/models.py` | 751 行 |
| 频道配置 | `server/configs/channels/*.json` | 3 个文件 |
| 屏蔽词库 | `server/configs/global/blocked_words.md` | 87 行 |

---

## 📋 Step 1-9 逐步审计清单

### Step 1: 理解需求 & 保存 Brief

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 1: 理解需求 |
| **注入的上下文** | ① `brief`（用户原始输入） ② `channel_id`（频道标识） |
| **数据库读取字段** | `brief_data.brief` |
| **数据库写入字段** | `brief_data.step_1_output` |
| **硬性规则** | 无特殊规则，仅要求提取关键信息 |
| **AI 指令** | 需求分析专家角色，输出：主题、目标读者、期望字数、特殊要求、关键词 |
| **卡点** | ❌ 非卡点，自动进入 Step 2 |
| **温度参数** | 0.3（低创造性，确保准确提取） |

**System Prompt**：
```
你是一个需求分析专家。请仔细分析用户的创作需求，提取关键信息。

输出格式：
1. 主题：xxx
2. 目标读者：xxx
3. 期望字数：xxx
4. 特殊要求：xxx
5. 关键词：xxx
```

**代码位置**：`workflow_engine.py:107-132`

---

### Step 2: 信息搜索与知识管理

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 2: 信息搜索（深度调研） |
| **注入的上下文** | ① `step_1_output`（需求分析结果） ② `channel_id` ③ Tavily 搜索结果（如可用） |
| **数据库读取字段** | `brief_data.step_1_output` |
| **数据库写入字段** | `knowledge_base_data`（调研全文）、`knowledge_summary`（300字摘要）、`brief_data.knowledge_sources` |
| **硬性规则** | ✅ Must-do: 标注信息来源；基于搜索结果生成，不编造 |
| **AI 指令** | 资深内容调研专家角色，生成 6 大维度调研报告 + 300 字摘要 |
| **卡点** | ✅ 是卡点，等待用户确认调研结论 |
| **温度参数** | 0.4（调研阶段）/ 0.3（摘要阶段） |

**双阶段生成流程**：
1. **阶段一**：生成详尽调研资料（max_tokens: 4000）
2. **阶段二**：提炼 300 字核心要点摘要（max_tokens: 500）

**搜索服务集成**：
```python
# 如果 Tavily API 可用，执行真实网络搜索
if search_service.is_available():
    search_result = await search_service.search_for_research(
        topic=topic_keywords,
        context=brief_analysis
    )
```

**调研报告输出格式**：
```
### 一、核心概念与定义
### 二、关键数据与事实
### 三、专家观点与理论支撑
### 四、案例与实证
### 五、常见误区与注意事项
### 六、延伸阅读建议
```

**代码位置**：`workflow_engine.py:134-303`

---

### Step 3: 选题讨论（必做卡点）

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 3: 选题讨论 |
| **注入的上下文** | ① `step_1_output` ② **频道配置文件**（`channel_config`） |
| **频道配置读取** | `system_prompt.role`、`system_prompt.writing_style`、`tone_guidelines` |
| **数据库写入字段** | `brief_data.step_3_output` |
| **硬性规则** | ✅ Must-do: 提供 3-4 个选题方向；✗ Never-do: **禁用书目黑名单** |
| **AI 指令** | 按频道角色输出选题方案 |
| **卡点** | ✅ 是卡点，等待用户选定选题 |
| **温度参数** | 0.8（高创造性，产生多样化选题） |

**选题输出格式**（每个选题包含）：
1. 标题（吸引人但不标题党）
2. 核心观点
3. 大纲（3-5个要点）
4. 预估工作量（字数、所需素材）
5. 优劣分析

**禁用书目规则（硬编码）**：
```
## ⚠️ 禁用书目（避免AI味）
举例时禁止使用以下被过度引用的常见书目：
《夏洛的网》《小王子》《窗边的小豆豆》《爱心树》《猜猜我有多爱你》《逃家小兔》《好饿的毛毛虫》《大卫不可以》
- 如需书籍举例，请选择更小众但同样优质的作品
```

**代码位置**：`workflow_engine.py:305-344`

---

### Step 4: 创建协作文档

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 4: 协作文档 |
| **注入的上下文** | ① `selected_topic`（用户选定的选题） |
| **数据库读取字段** | `brief_data.selected_topic` |
| **数据库写入字段** | `brief_data.step_4_output` |
| **硬性规则** | 明确分工：AI 任务 vs 用户需提供内容 |
| **AI 指令** | 项目管理专家角色，输出协作清单 |
| **卡点** | ❌ 非卡点 |
| **温度参数** | 0.3（结构化输出） |

**协作清单输出格式**：
```
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
```

**代码位置**：`workflow_engine.py:346-378`

---

### Step 5: 风格建模与素材检索（v3.5 样文矩阵模式）

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 5: 风格建模 |
| **注入的上下文** | ① `selected_topic` ② `channel_id` ③ `task_id` |
| **数据库读取字段** | • `channels.style_samples`（频道样文 JSONB）<br>• `channels.style_profile`（频道风格画像）<br>• `style_samples` 表（独立样文表，v3.5）<br>• `personal_materials`（个人素材库） |
| **数据库写入字段** | `brief_data.step_5_output`、`brief_data.retrieved_materials`、`brief_data.classified_materials`、`brief_data.style_profile`、`brief_data.recommended_sample`、`brief_data.all_samples` |
| **硬性规则** | ✅ 素材清洗：噪声过滤 + 来源去重 + 内容去重（相似度阈值 0.85） |
| **AI 指令** | **无 AI 调用**，纯数据检索与匹配 |
| **卡点** | ✅ 是卡点，等待用户确认风格画像 |

**样文智能匹配逻辑**：
```python
# 获取样文并计算匹配分数
all_samples = db_service.get_style_samples_for_matching(
    channel_id=channel_data['id'],
    keywords=keywords  # 从 selected_topic 提取
)

# 匹配分数计算规则：
# - custom_tags 完全匹配: +10 分
# - 6维特征关键词匹配: +2 分
```

**6 维风格特征结构**：
```json
{
  "opening_style": {
    "type": "story_intro",
    "description": "建议用生活场景引入",
    "examples": ["..."]
  },
  "sentence_pattern": {
    "avg_length": 25,
    "short_ratio": 0.6,
    "favorite_punctuation": ["，", "。", "——"],
    "description": "短句为主，节奏明快"
  },
  "paragraph_rhythm": {
    "variation": "medium",
    "avg_paragraph_length": 80,
    "description": "段落长短交替"
  },
  "tone": {
    "type": "warm_friend",
    "formality": 0.3,
    "description": "温润亲切，像朋友聊天"
  },
  "ending_style": {
    "type": "reflection",
    "description": "引导读者思考"
  },
  "expressions": {
    "high_freq_words": ["...", "..."],
    "transition_phrases": ["...", "..."],
    "avoid_words": ["...", "..."]
  }
}
```

**素材处理流程**：
1. 噪声过滤（移除营销内容）
2. 来源去重（同一来源保留最优）
3. 内容去重（Jaccard 相似度 > 0.85 视为重复）
4. 分类：长文（>200字）vs 短碎（≤200字）

**代码位置**：`workflow_engine.py:380-621`

---

### Step 6: 挂起等待（数据确认卡点）

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 6: 挂起等待 |
| **注入的上下文** | 无（纯检查点） |
| **数据库写入字段** | `brief_data.step_6_output`、`brief_data.user_materials`（确认后） |
| **硬性规则** | ✅ Must-do: 绝不编造虚假信息、宁可等待也不瞎写、所有数据必须有来源 |
| **AI 指令** | **无 AI 调用**，输出固定清单 |
| **卡点** | ✅ 是卡点 |

**数据确认清单**：
```
## 数据确认清单

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
```

**代码位置**：`workflow_engine.py:673-699`

---

### Step 7: 初稿创作（v3.5 单一标杆驱动）

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 7: 初稿创作 |
| **注入的上下文** | ① `selected_topic` ② `style_guide`（Step 5 输出） ③ `materials`（用户素材） ④ `channel_config` ⑤ `word_count` ⑥ `style_profile` ⑦ `selected_sample`（v3.5） |
| **数据库读取字段** | • `brief_data.step_5_output`<br>• `brief_data.user_materials`<br>• `brief_data.custom_style_profile`<br>• `brief_data.selected_sample`<br>• `brief_data.step_1_output`（提取字数）<br>• `brief_data.brief`（提取字数） |
| **数据库写入字段** | `draft_content`、`brief_data.step_7_output` |
| **硬性规则** | 详见下方规则表 |
| **卡点** | ❌ 非卡点 |
| **温度参数** | 0.7（平衡创造性与一致性） |
| **max_tokens** | 动态计算：`min(word_count * 1.5, 4000)` |

**Step 7 硬性规则汇总**：

| 规则类型 | 规则内容 | 来源 |
|----------|----------|------|
| **字数约束** | 目标字数 ±10% 偏差 | `extract_word_count()` 从 Step 1 提取 |
| **真实素材** | 严禁凭空编造案例/数据 | 硬编码 |
| **禁用书目** | 8 本常见书籍黑名单 | 硬编码 |
| **频道风格** | `writing_style` 列表 | 频道配置 JSON |
| **频道屏蔽词** | `blocked_phrases` | 频道配置 JSON |
| **must_do** | 频道特定必做规则 | `channel_specific_rules.must_do` |
| **must_not_do** | 频道特定禁止规则 | `channel_specific_rules.must_not_do` |
| **风格 DNA** | 6 维特征约束 | `style_profile` |

**风格来源优先级（从高到低）**：
```python
# 优先级1: 用户自定义的 style_profile（is_customized=True）
# 优先级2: 所选样文的独立 style_profile
# 优先级3: 传入的 style_profile（可能是频道整体画像）
# 优先级4: 默认风格配置
```

**System Prompt 结构**：
```
{频道角色设定}

## ⚠️ 核心约束：字数要求
- 目标字数：{word_count}字
- 允许范围：{word_count * 0.9}字 ~ {word_count * 1.1}字

## 🎨 【强制】风格 DNA 对齐（必须 100% 遵守）

### 📐 段落结构（必须按此顺序）
{structural_logic}

### 🎭 六维风格特征
**【开头】** 类型：{opening_style.type}
**【句式】** 短句占比：{sentence_pattern.short_ratio * 100}%
**【段落】** 节奏变化：{paragraph_rhythm.variation}
**【语气】** 类型：{tone.type}
**【结尾】** 类型：{ending_style.type}
**【推荐用词】** {expressions.high_freq_words}
**【禁止用词】** {expressions.avoid_words}

### 📋 创作指南（每条都是硬性规则）
{writing_guidelines}

### ⭐ 本篇特殊要求（最高优先级）
{custom_requirement}

## ⚠️ 核心约束：真实素材
- 文中所有案例、故事、引用必须来自下方提供的【可用素材】
- 严禁凭空编造任何案例或数据
- 如果素材不够用，请简化内容而不是捏造

## ⚠️ 核心约束：禁用书目（避免AI味）
{禁用书目列表}

## 写作风格要求
{channel_config.writing_style}

## 禁用表达
{channel_config.blocked_phrases}

## 频道规则
必须遵守：{channel_config.must_do}
严格禁止：{channel_config.must_not_do}
```

**代码位置**：`workflow_engine.py:701-937`

---

### Step 8: 四遍审校机制

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 8: 四遍审校 |
| **注入的上下文** | ① `draft`（Step 7 初稿） ② `channel_config` ③ `blocked_words_config`（全局屏蔽词） ④ `word_count` ⑤ `style_profile` |
| **数据库读取字段** | • `draft_content` / `step_7_output`<br>• `custom_style_profile` / `style_profile`<br>• `step_1_output`（提取字数）<br>• `brief`（提取字数） |
| **数据库写入字段** | `final_content`、`brief_data.step_8_output` |
| **屏蔽词处理** | ✅ **在此步骤检测和拦截** |
| **卡点** | ❌ 非卡点 |
| **温度参数** | 0.3（低创造性，确保准确审校） |
| **max_tokens** | 动态计算：`min(word_count * 2.5, 8000)` |

**四遍审校内容**：

| 审校轮次 | 审校内容 | 检查项 |
|----------|----------|--------|
| **一审：内容审校** | 事实准确性、逻辑清晰度、论证充分性 | 是否有编造内容（严禁编造！） |
| **二审：风格 DNA 对齐** | 逐项对照 6 维特征打分 | 合格线 ≥ 80% |
| **三审：去 AI 味** | 全局屏蔽词检测 + 频道屏蔽词检测 | 替换所有命中词汇 |
| **四审：细节打磨** | 句子≤40字、段落≤200字 | 字数控制在允许范围内 |

**屏蔽词检测来源**：
```
1. 全局屏蔽词库（blocked_words.md）- 8 大类：
   - 开场陈词滥调
   - 逻辑结构词过度使用
   - 模糊表达
   - 冗余表达
   - 过度客观（缺乏态度）
   - 标题党用语
   - 教育领域陈词
   - 过度热情（微商风）

2. 频道屏蔽词（channel_config.blocked_phrases）
```

**风格 DNA 对齐检查清单**：
```
### 结构检查
文章段落是否按以下顺序组织：
  1. [ ] {structural_logic[0]}
  2. [ ] {structural_logic[1]}
  ...

### 六维特征检查
1. [开头] 是否采用「{opening_style.type}」方式？ [ ]
2. [句式] 短句占比是否 ≥ {short_ratio}%？ [ ]
3. [语气] 是否为「{tone.type}」风格？ [ ]
4. [结尾] 是否采用「{ending_style.type}」方式？ [ ]
5. [禁词] 是否使用了禁止用词？ [ ] （必须为 ✗）

### 创作指南检查
  1. [ ] {writing_guidelines[0]}
  2. [ ] {writing_guidelines[1]}
  ...

### 对齐评分
- 总分 = 符合项数 / 总项数 × 100%
- 合格线：≥ 80%
- 若不合格，必须修改后重新输出
```

**代码位置**：`workflow_engine.py:939-1122`

---

### Step 9: 文章配图

| 维度 | 详情 |
|------|------|
| **执行阶段** | Step 9: 文章配图 |
| **注入的上下文** | ① `final_article`（Step 8 终稿前 2000 字） |
| **数据库读取字段** | `final_content` / `step_8_output` |
| **数据库写入字段** | `brief_data.step_9_output` |
| **硬性规则** | 5-8 张配图、提供 AI 绘图提示词 |
| **AI 指令** | 配图方案专家角色 |
| **卡点** | ❌ 非卡点，任务完成 |
| **温度参数** | 0.5（中等创造性） |

**配图方案输出格式**：
```
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
```

**代码位置**：`workflow_engine.py:1124-1167`

---

## 🎨 重点核查 1：风格 DNA 如何影响 Step 7 Prompt

### 优先级层级（从高到低）

```python
# workflow_engine.py:718-744
# 优先级（从高到低）：
# 1. 用户特殊要求 (custom_requirement)
# 2. 用户修改的创作指南 (writing_guidelines)
# 3. 所选样文的 6 维特征约束 (selected_sample.style_profile)
# 4. 频道基本人格设定
```

### 风格来源判定逻辑

```python
# workflow_engine.py:730-744
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
```

### 风格 DNA 注入到 Prompt 的完整结构

```
## 🎨 【强制】风格 DNA 对齐（必须 100% 遵守）

### 📐 段落结构（必须按此顺序）
  1. {structural_logic[0]}
  2. {structural_logic[1]}
  3. {structural_logic[2]}
  ...
**要求**：文章必须严格按照上述结构安排段落，不得遗漏或乱序。

### 🎭 六维风格特征

**【开头】** 类型：{opening_style.type}
  - 要求：{opening_style.description}
  - 参考：「{opening_style.examples[0][:50]}...」

**【句式】** 短句占比：{sentence_pattern.short_ratio * 100}%
  - 常用标点：{sentence_pattern.favorite_punctuation}
  - 特征：{sentence_pattern.description}

**【段落】** 节奏变化：{paragraph_rhythm.variation}
  - 特征：{paragraph_rhythm.description}

**【语气】** 类型：{tone.type}
  - 正式度：{tone.formality * 100}%（口语化/半正式/正式）
  - 要求：{tone.description}

**【结尾】** 类型：{ending_style.type}
  - 要求：{ending_style.description}

**【推荐用词】** {expressions.high_freq_words}
**【禁止用词】** {expressions.avoid_words}（一旦出现即为不合格）

### 📋 创作指南（每条都是硬性规则）
  1. ✅ {writing_guidelines[0]}
  2. ✅ {writing_guidelines[1]}
  ...
**审校标准**：上述每条指南都将在 Step 8 审校中逐一检查，不符合的将被退回修改。

### ⭐ 本篇特殊要求（最高优先级）
用户明确要求：{custom_requirement}
**必须严格执行上述特殊要求，不得忽略！**
```

### 关键发现

| 发现 | 说明 |
|------|------|
| ✅ 风格 DNA 完整注入 | 6 维特征全部展开为 Prompt 指令 |
| ✅ 优先级清晰 | 用户自定义 > 样文特征 > 频道画像 |
| ⚠️ 缺少强制校验 | 生成结果未做 6 维特征自动检测（依赖 Step 8 审校） |
| ⚠️ Step 7 和 Step 8 重复检查 | DNA 对齐检查在两个步骤中都存在 |

---

## 📚 重点核查 2：`knowledge_base_data` 实际利用率

### 数据流追踪

| 阶段 | 操作 | 代码位置 |
|------|------|----------|
| Step 2 生成 | 调研全文写入 `knowledge_base_data` | `workflow.py:281-285` |
| Step 2 生成 | 摘要写入 `knowledge_summary` | `workflow.py:281-285` |
| Step 2 前端展示 | 摘要在任务详情页展示 | `workflow.py:220-221` |
| **Step 3** | ❌ **未读取** `knowledge_base_data` | `workflow.py:313` |
| **Step 4** | ❌ **未读取** | - |
| **Step 5** | ❌ **未读取** | - |
| **Step 6** | ❌ **未读取** | - |
| **Step 7** | ❌ **未读取** | `workflow_engine.py:701-710` |
| **Step 8** | ❌ **未读取** | - |
| **Step 9** | ❌ **未读取** | - |

### 关键发现

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| **调研数据未被后续步骤使用** | 🔴 高 | `knowledge_base_data` 和 `knowledge_summary` 在 Step 3-9 中均未被注入到 AI Prompt |
| 仅存储不调用 | 🔴 高 | 花费 4000+ tokens 生成的调研资料，实际上只是存档 |
| 前端展示正常 | ✅ | 用户可以在任务详情页查看调研摘要 |

### 代码证据

```python
# workflow.py:313 - Step 3 只读取 step_1_output，不读取 knowledge_base_data
step1_output = brief_data.get("step_1_output", "")
result = await workflow_engine.execute_step_3(step1_output, channel_id)

# workflow_engine.py:701-710 - Step 7 的参数中没有 knowledge_base_data
async def execute_step_7(
    self,
    selected_topic: str,
    style_guide: str,
    materials: str,  # 这是用户提供的素材，不是调研数据
    channel_id: str,
    word_count: int = 1500,
    style_profile: Dict[str, Any] = None,
    selected_sample: Dict[str, Any] = None
) -> Dict[str, Any]:
```

### 建议修复方案

应在 Step 7 的 `user_message` 中注入调研摘要：

```python
# 修复后的 Step 7 user_message
user_message = f"""请创作文章初稿。

## 调研背景（来自 Step 2）
{knowledge_summary}

## 选题
{selected_topic}

## 风格指南
{style_guide}

## 可用素材（只能使用这些，禁止编造）
{materials}

## ⚠️ 创作要求
1. 文章总字数：{int(word_count * 0.9)} ~ {int(word_count * 1.1)} 字
2. 严格模仿风格画像中的开头方式、句式节奏、语气特点
3. 真实素材自然融入，禁止凭空编造案例

请开始创作，直接输出文章内容。
"""
```

---

## ⚠️ 逻辑潜在冲突分析

### 冲突 1：禁用书目规则位置分散

| 位置 | 规则 | 代码行 |
|------|------|--------|
| Step 3 选题讨论 | 禁用书目黑名单 | `workflow_engine.py:322-325` |
| Step 7 初稿创作 | 禁用书目黑名单 | `workflow_engine.py:872-875` |

**问题**：同一规则在两个地方硬编码，后续维护需同步修改。

**建议**：抽取到配置文件 `global/writing_constraints.json`。

---

### 冲突 2：字数控制多重来源

```python
# workflow.py:54-83 - 字数提取函数
def extract_word_count(step1_output: str, brief: str) -> int:
    patterns = [
        r'期望字数[：:]\s*(\d+)',
        r'字数[：:]\s*(\d+)',
        r'(\d+)\s*字',
        r'字数要求[：:]\s*(\d+)',
        r'字数限制[：:]\s*(\d+)',
        r'(\d{3,4})字左右',
        r'(\d{3,4})字以内',
        r'约(\d{3,4})字',
    ]
    # 合并搜索文本
    search_text = f"{step1_output}\n{brief}"
    ...
```

**问题**：如果 Step 1 分析的字数与用户原始输入不一致，可能产生歧义。

**示例冲突场景**：
- 用户输入：「写一篇 2000 字的文章」
- Step 1 分析输出：「期望字数：1500字」（AI 误解）
- 最终使用：1500 字（错误）

---

### 冲突 3：风格指令优先级理论 vs 实际

**理论优先级**（代码注释）：
1. 用户特殊要求 (custom_requirement)
2. 用户修改的创作指南 (writing_guidelines)
3. 所选样文的 6 维特征约束
4. 频道基本人格设定

**实际 Prompt 组装顺序**：
```
1. 频道角色设定（开头）
2. 字数约束
3. 风格 DNA 对齐（中间）
4. 用户特殊要求（中间）
5. 真实素材约束
6. 禁用书目
7. 频道写作风格
8. 频道屏蔽词
9. 频道 must_do / must_not_do（结尾）
```

**问题**：AI 通常更关注 Prompt 开头和结尾的内容，优先级声明与 Prompt 结构不完全匹配。

---

### 冲突 4：Step 5 vs Step 7 的 style_profile 字段命名不一致

| Step 5 输出字段 | Step 7 读取字段 |
|----------------|-----------------|
| `recommended_sample` | `selected_sample` |
| `style_profile` | `custom_style_profile` or `style_profile` |
| `all_samples` | 未使用 |

**问题**：字段命名不一致（`recommended_sample` vs `selected_sample`），依赖前端正确传递和转换。

---

### 冲突 5：频道配置文件与数据库字段冗余

| 数据源 | 字段 | 说明 |
|--------|------|------|
| 频道配置 JSON | `blocked_phrases` | 频道屏蔽词 |
| 数据库 `channels` 表 | `blocked_phrases` | 频道屏蔽词（JSONB） |
| 频道配置 JSON | `channel_specific_rules` | must_do / must_not_do |
| 数据库 `channels` 表 | `channel_rules` | must_do / must_not_do（JSONB） |

**问题**：同一数据存在两个来源，可能产生不一致。当前代码优先读取 JSON 配置文件。

---

## 🧠 Think Aloud：指令集过载评估

### 当前指令负荷统计

| 步骤 | System Prompt 预估字符数 | 核心规则数 |
|------|-------------------------|-----------|
| Step 1 | ~200 | 5 |
| Step 2 | ~1500 | 12 |
| Step 3 | ~1200 | 8 + 禁用书目 |
| Step 4 | ~300 | 4 |
| Step 5 | N/A（无 AI 调用） | - |
| Step 6 | N/A（无 AI 调用） | - |
| Step 7 | **~2500+** | **20+** |
| Step 8 | **~3000+** | **25+** |
| Step 9 | ~400 | 4 |

### Step 7 Prompt 结构详细拆解

```
[System Prompt 组成]
├── 频道角色设定 (~200 字)
├── 字数约束 (~100 字)
├── 风格 DNA 对齐 (~800 字)  ← 最长部分
│   ├── 段落结构（~150 字）
│   ├── 六维特征（~500 字）
│   └── 创作指南（~150 字）
├── 真实素材约束 (~100 字)
├── 禁用书目 (~200 字)
├── 频道写作风格 (~200 字)
├── 频道屏蔽词 (~100 字)
├── 频道 must_do (~200 字)
└── 频道 must_not_do (~200 字)

总计：~2100 字 System Prompt
```

### 过载风险评估矩阵

| 风险类型 | 等级 | 说明 | 影响 |
|----------|------|------|------|
| **规则冲突** | 🟡 中 | 风格 DNA、频道规则、用户要求可能产生矛盾 | AI 可能选择性忽略某些规则 |
| **优先级模糊** | 🟡 中 | AI 无法判断多条规则哪个更重要 | 输出不符合预期 |
| **注意力分散** | 🔴 高 | 20+ 条规则超出 AI 有效关注范围 | 部分规则被忽略 |
| **重复指令** | 🟡 中 | 禁用书目在 Step 3 和 Step 7 重复 | 维护成本增加 |
| **无效负载** | 🔴 高 | `knowledge_base_data` 从未被使用 | 资源浪费 |
| **上下文竞争** | 🟡 中 | 长 System Prompt 挤占 User Message 空间 | 素材注入受限 |

### AI 视角的体验分析

作为 AI，在处理 Step 7 的 Prompt 时，我会面临以下挑战：

1. **信息过载**：2000+ 字的 System Prompt 包含 20+ 条规则，难以全部记住并执行
2. **优先级不明**：「必须」「严禁」「强制」等词汇出现过于频繁，实际优先级模糊
3. **冲突处理**：当风格 DNA 要求「短句为主」而频道规则要求「论证充分」时，如何平衡？
4. **创造力受限**：过多的限制条件可能导致输出趋于保守、模式化

---

## 💡 精简建议

### 建议 1：合并重复规则到统一配置文件

创建 `server/configs/global/writing_constraints.json`：

```json
{
  "banned_books": [
    "《夏洛的网》",
    "《小王子》",
    "《窗边的小豆豆》",
    "《爱心树》",
    "《猜猜我有多爱你》",
    "《逃家小兔》",
    "《好饿的毛毛虫》",
    "《大卫不可以》"
  ],
  "word_count_default": 1500,
  "word_count_tolerance": 0.1,
  "max_sentence_length": 40,
  "max_paragraph_length": 200,
  "style_dna_pass_threshold": 0.8
}
```

### 建议 2：实际使用 `knowledge_base_data`

修改 `workflow.py` 中 Step 7 的调用：

```python
# Step 7: 初稿创作
# 新增：读取调研摘要
knowledge_summary = task.get("knowledge_summary", "")

result = await workflow_engine.execute_step_7(
    selected_topic, step5_output, materials, channel_id, word_count, 
    style_profile, selected_sample,
    knowledge_summary=knowledge_summary  # 新增参数
)
```

修改 `workflow_engine.py` 中 Step 7 的 user_message：

```python
user_message = f"""请创作文章初稿。

## 调研背景
{knowledge_summary if knowledge_summary else "无特定调研背景"}

## 选题
{selected_topic}
...
"""
```

### 建议 3：风格 DNA 分层加载

```python
# 仅在样文存在且已分析时加载完整 6 维特征
if selected_sample and selected_sample.get('is_analyzed'):
    # 完整 6 维约束
    style_instructions = build_full_style_dna(selected_sample['style_profile'])
elif style_profile:
    # 简化版：仅加载关键特征（开头、语气、结尾）
    style_instructions = build_light_style_dna(style_profile)
else:
    # 最简版：仅加载频道基础调性
    style_instructions = f"保持「{channel_config['brand_personality']}」的调性"
```

### 建议 4：Step 8 审校聚焦化

当前 Step 8 承担了 4 项审校任务，建议拆分或精简：

| 原审校轮次 | 建议处理 |
|------------|----------|
| 一审：内容审校 | ✅ 保留（核心功能） |
| 二审：风格 DNA 对齐 | ⚠️ 可移至 Step 7 后处理，或简化为抽检 |
| 三审：去 AI 味 | ✅ 保留（核心功能） |
| 四审：细节打磨 | ⚠️ 可合并到三审 |

精简后的 Step 8：
```
## 审校任务（2 轮）

### 第一轮：内容与风格审校
- 检查是否有编造内容
- 检查屏蔽词（全局 + 频道）
- 检查字数范围

### 第二轮：细节打磨
- 拆分超长句子（>40字）
- 拆分超长段落（>200字）
- 确保自然语调
```

### 建议 5：规则优先级显式化

在 Prompt 顶部添加优先级声明：

```
## ⚠️ 规则优先级（冲突时按此顺序执行）

| 优先级 | 规则类型 | 说明 |
|--------|----------|------|
| P0 最高 | 用户本篇特殊要求 | custom_requirement |
| P1 高 | 禁止编造 / 禁用书目 | 硬性底线 |
| P2 中 | 所选样文的 6 维特征 | 风格约束 |
| P3 低 | 频道基础调性 | 兜底规则 |

**当规则冲突时，优先执行高优先级规则。**
```

### 建议 6：统一字段命名

| 当前命名 | 建议统一为 |
|----------|-----------|
| `recommended_sample` | `selected_sample` |
| `custom_style_profile` | `user_style_profile` |
| `style_profile` | `effective_style_profile` |

---

## 📊 审计总结

### 架构优点

| 优点 | 说明 |
|------|------|
| ✅ 流程清晰 | 9 步 SOP 分工明确，每步职责单一 |
| ✅ 卡点设计合理 | Step 2/3/5/6 四个确认点，用户掌握主导权 |
| ✅ v3.5 样文矩阵 | 单一标杆驱动，风格一致性好 |
| ✅ 屏蔽词系统完善 | 8 类 AI 腔词汇，Markdown 表格易维护 |
| ✅ 素材处理模块 | 噪声过滤 + 多重去重，数据质量有保障 |
| ✅ Think Aloud 机制 | 每步记录日志，过程可追溯 |
| ✅ 数据库持久化 | 任务状态可恢复，支持断点续作 |

### 待改进问题

| 问题 | 优先级 | 修复建议 |
|------|--------|----------|
| `knowledge_base_data` 未被使用 | 🔴 P0 | 在 Step 7 注入调研摘要 |
| 指令集过载 | 🟡 P1 | 规则分层，精简 Prompt |
| 禁用书目重复定义 | 🟡 P1 | 抽取到配置文件 |
| 字段命名不一致 | 🟢 P2 | 统一 `selected_sample` 等命名 |
| 风格 DNA Step 7/8 重复检查 | 🟢 P2 | Step 8 聚焦去 AI 味 |
| 频道配置与数据库冗余 | 🟢 P2 | 明确单一数据源 |
| 字数提取可能冲突 | 🟢 P3 | 优先使用用户原始输入 |

### 建议实施优先级

1. **立即修复**：`knowledge_base_data` 注入到 Step 7
2. **短期优化**：合并禁用书目到配置文件、统一字段命名
3. **中期优化**：风格 DNA 分层加载、Step 8 审校聚焦化
4. **长期优化**：规则优先级显式化、Prompt 结构重构

---

## 附录：关键代码文件索引

| 文件 | 核心功能 | 行数范围 |
|------|----------|----------|
| `workflow_engine.py` | 9 步执行逻辑 | 全文 |
| `workflow.py` | 路由与状态管理 | 全文 |
| `ai_service.py` | Claude API 调用 | 48-84 |
| `db_service.py` | 数据库 CRUD | 全文 |
| `material_processor.py` | 素材清洗去重 | 50-248 |
| `models.py` | 数据表结构 | 全文 |
| `blocked_words.md` | 屏蔽词库 | 全文 |
| `deep_reading.json` | 深度阅读频道配置 | 全文 |
| `parenting.json` | 育儿频道配置 | 全文 |
| `picture_books.json` | 绘本频道配置 | 全文 |

---

*审计完成时间：2026-02-02*

