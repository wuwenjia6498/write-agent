# 📖 README_STORY_AI — 老约翰自动化写作 AGENT 深度扫描报告

> **扫描时间**：2026-02-10  
> **项目名称**：`old-john-writing-agent`（老约翰自动化写作 AGENT）  
> **版本**：v1.0.0  
> **定位**：基于 AI 驱动的品牌内容创作平台，服务于"老约翰儿童阅读"品牌的多元化内容创作

---

## 一、项目概览

### 1.1 核心定位

本项目是一套 **工业级 AI 写作协作系统**，旨在将"老约翰儿童阅读"品牌 15 年的内容调性通过结构化的 **两层判断机制** + **9 步 SOP 工作流** 进行工业化产出。系统以 **Claude（Anthropic）** 为核心模型，深度集成品牌资产管理、频道风格建模、素材 RAG 检索、四遍审校降 AI 味等能力。

### 1.2 核心受众

- 公司运营团队
- 策划人员
- 阅读推广老师

### 1.3 一句话总结

> 把"写出一篇低 AI 感的品牌公众号文章"这件事，拆解成了一个可被程序驱动的 9 步流水线。

---

## 二、技术架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                    🖥️  Frontend (Next.js 15)                │
│  App Router · React 19 · TypeScript · Tailwind CSS          │
│  Apple 风格设计系统 · Radix UI 组件                          │
│  Vercel 部署 · write.skyline666.top                         │
├─────────────────────────────────────────────────────────────┤
│                           ↕ REST API                        │
├─────────────────────────────────────────────────────────────┤
│                   🐍  Backend (FastAPI)                      │
│  Python · Uvicorn · Pydantic · CORS                        │
│  Railway 部署 · write-agent-production.up.railway.app       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 路由层 Routes │  │ 服务层 Svc   │  │ 配置层 JSON  │      │
│  │ channels     │  │ ai_service   │  │ deep_reading │      │
│  │ workflow     │  │ db_service   │  │ picture_books│      │
│  │ materials    │  │ workflow_eng │  │ parenting    │      │
│  │ brand_assets │  │ search_svc   │  │ blocked_words│      │
│  │ tasks        │  │ material_proc│  │ constraints  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│              🗄️  Database (Supabase PostgreSQL)              │
│  pgvector 向量检索 · SQLAlchemy ORM · Alembic 迁移          │
│  4 核心表 + 1 独立样文表                                     │
├─────────────────────────────────────────────────────────────┤
│              🤖  AI Layer                                    │
│  Claude 3.5 Sonnet (核心写作) · AIHUBMIX 中转              │
│  Tavily Search API (真实网络调研)                            │
│  LangChain / LangGraph (预留)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、目录结构与文件清单

```
write-agent/
├── app/                            # 🖥️ Next.js 前端页面
│   ├── layout.tsx                  # 根布局 (lang=zh-CN, Apple 风格主题)
│   ├── page.tsx                    # 首页 (Logo + CTA + 功能入口)
│   ├── globals.css                 # 全局样式 (Tailwind + 自定义滚动条)
│   ├── workbench/page.tsx          # ⭐ 创作工作台 (2467 行，核心页面)
│   ├── channels/page.tsx           # 频道管理页面
│   ├── materials/page.tsx          # 素材管理页面
│   ├── tasks/page.tsx              # 任务历史列表
│   ├── tasks/[id]/page.tsx         # 任务详情页
│   └── settings/page.tsx           # 品牌资产设置
│
├── components/                     # 📦 React 组件库
│   ├── AppHeader.tsx               # 顶部导航栏
│   ├── WorkflowProgress.tsx        # 9 步进度可视化 (轮询机制)
│   ├── ThinkAloud.tsx              # AI 思考过程实时展示
│   ├── ChannelSelector.tsx         # 三频道卡片选择器
│   ├── DiffViewer.tsx              # 审校前后对比视图
│   ├── BlockingWordsViewer.tsx     # 屏蔽词库查看器
│   └── ui/                         # shadcn/ui 基础组件
│       ├── button.tsx, card.tsx, dialog.tsx, input.tsx
│       ├── select.tsx, tabs.tsx, textarea.tsx, badge.tsx
│       ├── auto-resize-textarea.tsx, tag-input.tsx
│       ├── dropdown-menu.tsx, scroll-area.tsx
│       ├── label.tsx, separator.tsx
│       └── ...
│
├── lib/                            # 🔧 前端工具库
│   ├── api-config.ts               # API 地址自动切换 (开发/生产)
│   ├── supabase.ts                 # Supabase 客户端初始化
│   └── utils.ts                    # 工具函数 (cn, 类型定义)
│
├── server/                         # 🐍 Python 后端
│   ├── main.py                     # FastAPI 入口 (5 路由模块注册)
│   ├── requirements.txt            # Python 依赖 (26 个包)
│   ├── start_server.ps1            # Windows 启动脚本
│   │
│   ├── routes/                     # API 路由层
│   │   ├── channels.py             # 频道 CRUD + 样文管理 + 风格分析
│   │   ├── workflow.py             # 9 步工作流执行 + 卡点确认
│   │   ├── materials.py            # 素材搜索 + 上传
│   │   ├── brand_assets.py         # 品牌资产 KV 管理
│   │   └── tasks.py                # 任务列表 + 详情 + 删除
│   │
│   ├── services/                   # 业务逻辑层
│   │   ├── ai_service.py           # Claude API 封装 (生成 + 流式)
│   │   ├── workflow_engine.py      # ⭐ 9 步工作流引擎 (1509 行核心)
│   │   ├── db_service.py           # 数据库 CRUD 封装 (1400+ 行)
│   │   ├── search_service.py       # Tavily 网络搜索服务
│   │   └── material_processor.py   # 素材清洗/去重/分类
│   │
│   ├── database/                   # 数据库层
│   │   ├── models.py               # SQLAlchemy ORM 模型 (5 表)
│   │   ├── schema.sql              # PostgreSQL DDL 原始建表
│   │   ├── config.py               # 数据库连接配置
│   │   ├── crud.py                 # 基础 CRUD
│   │   ├── init_db.py              # 数据库初始化脚本
│   │   └── migrations/             # 数据库迁移脚本
│   │       ├── add_channels_indexes.py
│   │       ├── add_knowledge_summary.py
│   │       ├── add_materials_indexes.py
│   │       ├── add_style_samples_table.py
│   │       └── add_tasks_indexes.py
│   │
│   └── configs/                    # 静态配置文件
│       ├── channels/               # 频道配置 (JSON 为真相来源)
│       │   ├── deep_reading.json   # 深度阅读（小学段）
│       │   ├── picture_books.json  # 绘本阅读（幼儿段）
│       │   └── parenting.json      # 育儿方向（家长随笔）
│       └── global/                 # 全局配置
│           ├── blocked_words.json  # 屏蔽词库 (8 大类)
│           ├── blocked_words.md    # 屏蔽词库 (Markdown 表格版)
│           └── writing_constraints.json # 写作约束 (禁用书目/字数限制)
│
├── public/                         # 静态资源
│   ├── logo-1.png                  # 品牌 Logo
│   └── logo-1.jpg                  # 品牌 Logo (备用)
│
├── task/                           # 📋 开发任务记录
│   ├── task01.md ~ task16.md       # 历史任务记录
│
├── package.json                    # 前端依赖 (Next.js 15 + React 19)
├── tsconfig.json                   # TypeScript 配置
├── tailwind.config.js              # Tailwind CSS 配置
├── next.config.js                  # Next.js 配置
├── postcss.config.js               # PostCSS 配置
├── components.json                 # shadcn/ui 配置
├── railway.toml                    # Railway 部署配置
├── prd.md                          # 产品需求文档 (PRD)
├── README.md                       # 原始 README
└── PROJECT_SUMMARY.md              # 项目实施总结
```

---

## 四、核心架构详解

### 4.1 两层判断机制

```
用户请求 → 🏢 第一层：工作区路由
               │
               ↓ 当前锁定「公众号创作」工作区
               │
           📺 第二层：频道路由
               │
     ┌─────────┼─────────┐
     ↓         ↓         ↓
  🔵 深度阅读  🟢 绘本阅读  🟡 育儿方向
  (小学段)    (幼儿段)    (家长随笔)
     │         │         │
     ↓         ↓         ↓
  加载专属     加载专属     加载专属
  System       System       System
  Prompt +     Prompt +     Prompt +
  样文 +       样文 +       样文 +
  屏蔽词       屏蔽词       屏蔽词
```

**三频道定位**：

| 频道 | Slug | 核心业务 | 创作风格 |
|:---|:---|:---|:---|
| 深度阅读 | `deep_reading` | 经典文学拆解、整本书阅读策略 | 专业、有文学厚度、逻辑严密 |
| 绘本阅读 | `picture_books` | 高品质绘本推荐、亲子共读 | 温润、活泼、画面感强 |
| 育儿方向 | `parenting` | 缓解家长焦虑、教育观察 | 睿智老友式、有温度、同理心 |

### 4.2 九步 SOP 工作流

这是系统最核心的引擎，在 `workflow_engine.py` 中实现（1509 行）：

```
┌──────────────────────────────────────────────────────┐
│                   9 步完整 SOP                        │
│                                                      │
│  S1 ── 理解需求 & 保存 Brief                          │
│  │     AI 自动分析：主题、读者、字数、关键词            │
│  ↓                                                    │
│  S2 ── 信息搜索与知识管理 ★ 卡点                      │
│  │     Tavily 网络搜索 → AI 调研报告 → 摘要提炼        │
│  │     用户可编辑调研结论后确认                         │
│  ↓                                                    │
│  S3 ── 选题讨论（强制卡点）★                          │
│  │     AI 输出 3-4 个选题方向 → 用户选定后继续          │
│  │     含大纲、工作量评估、优劣分析                     │
│  ↓                                                    │
│  S4 ── 创建协作文档                                   │
│  │     AI 任务清单 + 用户需提供的真实素材清单            │
│  ↓                                                    │
│  S5 ── 风格建模与素材检索 ★ 卡点                      │
│  │     样文矩阵模式：智能推荐最匹配样文                 │
│  │     RAG 检索素材库 → 清洗去重 → 分类（长文/碎片）   │
│  │     长文素材自动摘要化                              │
│  │     用户确认风格画像后继续                           │
│  ↓                                                    │
│  S6 ── 挂起等待（数据确认卡点）★                      │
│  │     确认所有真实素材已就绪，绝不编造                 │
│  ↓                                                    │
│  S7 ── 初稿创作 (专注手感模式)                        │
│  │     单一标杆驱动：复刻所选样文的 6 维风格特征         │
│  │     注入调研摘要（事实地基）                         │
│  │     字数动态控制（±10% 容忍度）                     │
│  ↓                                                    │
│  S8 ── 四遍纪律审校                                   │
│  │     🔴 去 AI 腔（屏蔽词替换 + 频道禁止项）          │
│  │     🟡 黑名单校验（禁用书目检查）                   │
│  │     🟢 风格 DNA 对齐检查（6 维 + 创作指南逐项打分）  │
│  │     🔵 细节打磨（句长/段长/标点/字数控制）           │
│  │     发现违禁内容 → 局部重写，无需返回 S7             │
│  ↓                                                    │
│  S9 ── 文章配图                                       │
│        5-8 张配图建议 + AI 绘图提示词 + Markdown 代码    │
│                                                      │
│  ★ = 卡点（需用户确认后方可继续）                      │
└──────────────────────────────────────────────────────┘
```

---

## 五、数据模型 (5 张核心表)

### 5.1 ER 关系图

```
channels ─┬── 1:N ──→ writing_tasks
          ├── 1:N ──→ personal_materials
          └── 1:N ──→ style_samples (v3.5)

brand_assets (独立 KV 表)
```

### 5.2 各表说明

| 表名 | 用途 | 核心字段 |
|:---|:---|:---|
| `channels` | 内容频道配置 | `slug`, `system_prompt`(JSONB), `style_profile`(JSONB), `blocked_phrases`(JSONB) |
| `style_samples` | 标杆样文（v3.5 独立表） | `channel_id`(FK), `content`, `style_profile`(JSONB=6维特征), `custom_tags`(JSONB), `is_analyzed` |
| `brand_assets` | 品牌全局资产 (KV) | `asset_key`(PK), `content`(Text/Markdown), `content_type` |
| `personal_materials` | 个人素材库 (RAG 核心) | `channel_id`(FK), `content`, `embedding`(vector 1536维), `tags`(JSONB), `material_type` |
| `writing_tasks` | 写作任务流 (9步状态) | `channel_id`(FK), `current_step`(1-9), `status`, `brief_data`(JSONB), `draft_content`, `final_content`, `think_aloud_logs`(JSONB) |

### 5.3 数据库特性

- **向量检索**：`pgvector` 扩展，`personal_materials.embedding` 存储 1536 维向量（兼容 OpenAI embeddings），支持 `ivfflat` 索引加速余弦相似度搜索
- **自动时间戳**：所有表均有 PostgreSQL 触发器自动更新 `updated_at`
- **复合索引**：`(channel_id, status)`, `(channel_id, material_type)`, `(channel_id, current_step)` 等优化查询
- **连接池**：SQLAlchemy `pool_pre_ping=True` 自动检测失效连接

---

## 六、AI 服务层详解

### 6.1 AI 调用架构

```
┌──────────────────────────────────────────┐
│             AIService (单例)              │
│                                          │
│  Model: Claude 3.5 Sonnet                │
│  Platform: AIHUBMIX 中转 (可配)          │
│                                          │
│  generate_content()    →  同步生成        │
│  generate_content_stream()  →  流式 SSE   │
│                                          │
│  温度策略:                                │
│    S1 需求分析:  0.3 (精确)               │
│    S2 调研生成:  0.4 (偏精确)             │
│    S3 选题方案:  0.8 (发散创意)           │
│    S4 协作清单:  0.3                      │
│    S7 初稿创作:  0.7 (兼顾创意和一致性)   │
│    S8 审校纠错:  0.3 (精确判断)           │
│    S9 配图方案:  0.5                      │
└──────────────────────────────────────────┘
```

### 6.2 SearchService (Tavily)

- 专为 AI 应用设计的搜索 API
- Step 2 执行 **3 组搜索**（学术/专家/数据），去重后取 Top 8
- 结果格式化后传给 AI 生成调研报告
- 支持域名过滤、搜索深度控制
- 自动清理 Windows 编码特殊字符

### 6.3 素材处理器 (MaterialProcessor)

三阶段清洗管线：

```
原始素材 (15条)
    ↓ [1] 噪声过滤 — 正则匹配 40+ 营销脏数据模式
    ↓       "点击购买"、"加盟"、"扫码"、"限时优惠"...
    ↓ [2] 来源去重 — 同源保留评分最高
    ↓ [3] 内容去重 — 2-gram Jaccard 相似度 > 0.85 视为重复
    ↓ [4] 分类 — 长文 (>200字) / 灵感碎片
    ↓ [5] 长文摘要化 — AI 提取核心论点+可引用内容
有效素材 (8条)
```

---

## 七、降 AI 味核心机制

这是本系统最大的亮点——系统化地降低 AI 文章的检测率：

### 7.1 四层防护体系

| 层级 | 机制 | 实现位置 | 效果 |
|:---|:---|:---|:---|
| **L1** | 全局屏蔽词库 | `blocked_words.md` (8 大类) | 自动替换"综上所述"等 AI 腔 |
| **L2** | 频道屏蔽词 | `channels/*.json` | 频道级定制化过滤 |
| **L3** | 个人素材融入 | `personal_materials` + RAG | 真实经历替代泛泛而谈 |
| **L4** | 四遍审校机制 | `execute_step_8()` | 内容→黑名单→DNA→细节 |

### 7.2 屏蔽词库 8 大类

1. **开场陈词滥调** — "在当今...时代"、"众所周知"
2. **逻辑结构词过度使用** — "综上所述"、"总而言之"
3. **模糊表达** — "在一定程度上"、"某种意义上"
4. **冗余表达** — "进行...活动"、"实现...目标"
5. **过度客观** — "据报道"、"研究表明"
6. **标题党用语** — "震惊"、"必看"、"速看"
7. **教育领域陈词** — "寓教于乐"、"赢在起跑线"
8. **过度热情** — "亲"、"么么哒"、"哦~"

### 7.3 风格 DNA 6 维特征体系

每篇标杆样文独立分析 6 个维度（v3.5 样文矩阵模式）：

```json
{
  "opening_style":     { "type": "story_intro", "description": "..." },
  "sentence_pattern":  { "avg_length": 18, "short_ratio": 0.4 },
  "paragraph_rhythm":  { "variation": "medium", "avg_length": 80 },
  "tone":              { "type": "warm_friend", "formality": 0.3 },
  "ending_style":      { "type": "reflection", "description": "..." },
  "expressions":       { "high_freq_words": [...], "avoid_words": [...] }
}
```

审校时逐项打分，合格线 ≥ 80%。

---

## 八、API 接口清单

### 8.1 频道管理 `/api/channels`

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | `/` | 获取所有频道列表 |
| GET | `/{id}` | 获取频道完整配置 |
| POST | `/` | 创建新频道 |
| PUT | `/{id}` | 更新频道 |
| DELETE | `/{id}` | 删除频道 |
| GET | `/{id}/system-prompt` | 获取 AI 人格 |
| GET | `/{id}/samples` | 获取样文路径 |
| GET | `/{id}/rules` | 获取频道规则 |
| GET | `/{id}/style-samples` | 获取标杆样文列表 (v3.5) |
| POST | `/{id}/style-samples` | 添加样文并自动分析 |
| PUT | `/{id}/style-samples/{sid}` | 更新样文标签 |
| DELETE | `/{id}/style-samples/{sid}` | 删除样文 |
| POST | `/{id}/style-samples/{sid}/analyze` | 重新分析样文特征 |
| GET | `/{id}/style-samples/preset-tags` | 获取预设标签库 |
| GET | `/{id}/style-profile` | 获取频道风格画像 |
| POST | `/{id}/analyze-style` | 合成频道 DNA |
| POST | `/{id}/sync-config` | 数据库 → JSON 同步 |
| GET | `/{id}/config-source` | 查看配置数据来源 |

### 8.2 工作流 `/api/workflow`

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | `/create` | 创建工作流会话 |
| GET | `/{id}` | 获取工作流状态 |
| POST | `/{id}/execute-step/{step}` | 执行指定步骤 |
| POST | `/{id}/confirm` | 确认卡点继续 |
| POST | `/{id}/abort` | 中止任务 |
| GET | `/{id}/think-aloud` | 获取思考日志 |
| GET | `/{id}/stream-think-aloud` | SSE 流式日志 |
| GET | `/{id}/recommend-samples` | 样文智能推荐 (v3.5) |
| POST | `/{id}/select-sample` | 选定标杆样文 |
| POST | `/{id}/regenerate-summary` | 重新生成调研摘要 |
| GET | `/` | 获取所有会话列表 |

### 8.3 素材管理 `/api/materials`

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | `/` | 获取素材列表 (支持频道/标签筛选) |
| POST | `/` | 创建新素材 |
| POST | `/search` | 关键词搜索素材 |
| GET | `/blocked-words` | 获取屏蔽词库 |

### 8.4 品牌资产 `/api/brand-assets`

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | `/` | 获取所有品牌资产 |
| GET | `/{key}` | 获取指定资产 |
| POST | `/` | 创建/更新资产 (Upsert) |
| PUT | `/{key}` | 更新资产 |
| DELETE | `/{key}` | 删除资产 |

### 8.5 任务管理 `/api/tasks`

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| GET | `/` | 获取任务列表 (支持频道/状态筛选) |
| GET | `/{id}` | 获取任务详情 |
| DELETE | `/{id}` | 删除任务 |

---

## 九、前端页面与交互设计

### 9.1 页面路由表

| 路径 | 页面 | 核心功能 |
|:---|:---|:---|
| `/` | 首页 | Logo + 核心特点 + CTA 入口 |
| `/workbench` | ⭐ 创作工作台 | 三栏布局（进度/工作区/思考），9 步流程全程交互 |
| `/channels` | 频道管理 | 频道列表 + 详情 + 样文管理 + 风格分析 |
| `/materials` | 素材管理 | 素材列表 + 搜索 + 上传 |
| `/tasks` | 任务历史 | 任务列表 + 状态筛选 |
| `/tasks/[id]` | 任务详情 | 查看历史任务的完整数据 |
| `/settings` | 品牌资产 | 个人简介/屏蔽词/价值观 编辑 |

### 9.2 设计系统

- **设计风格**：Apple 简约风，圆角 + 阴影 + 渐变
- **品牌色系**：
  - Primary: `#3a5e98`（深邃蓝）
  - 渐变底色：灰白 → 纯白
- **组件库**：Radix UI (无障碍) + shadcn/ui（自定义样式）
- **图标**：Lucide React（线性风格）+ 内联 SVG
- **响应式**：Grid 自适应三栏/两栏/单栏

### 9.3 核心组件

| 组件 | 文件 | 用途 |
|:---|:---|:---|
| `WorkflowProgress` | 9 步进度条 | 实时状态同步（2s 轮询）、卡点标识、动画图标 |
| `ThinkAloud` | AI 思考面板 | 消息分类展示（thinking/decision/info）、时间戳 |
| `ChannelSelector` | 频道选择器 | 三频道卡片、选中高亮、响应式网格 |
| `DiffViewer` | 审校对比 | 初稿 vs 终稿对比显示 |
| `BlockingWordsViewer` | 屏蔽词查看 | 8 大类屏蔽词展示 |

---

## 十、部署架构

```
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Vercel      │  HTTPS  │   Railway     │  TCP    │   Supabase    │
│   (前端)      │ ──────→ │   (后端)      │ ──────→ │   (数据库)    │
│               │         │               │         │               │
│ Next.js 15    │         │ FastAPI       │         │ PostgreSQL    │
│ React 19      │         │ Uvicorn       │         │ + pgvector    │
│               │         │ Python 3.x    │         │               │
│ 域名:         │         │ 域名:          │         │               │
│ write.        │         │ write-agent-  │         │ 云端托管      │
│ skyline666.   │         │ production.   │         │               │
│ top           │         │ up.railway.   │         │               │
│               │         │ app           │         │               │
└───────────────┘         └───────────────┘         └───────────────┘
```

### 环境变量

| 变量 | 用途 | 位置 |
|:---|:---|:---|
| `ANTHROPIC_API_KEY` | Claude API 密钥 | 后端 `.env` |
| `ANTHROPIC_BASE_URL` | API 中转地址 (AIHUBMIX) | 后端 `.env` |
| `ANTHROPIC_MODEL` | 模型名称 | 后端 `.env` |
| `TAVILY_API_KEY` | 搜索 API 密钥 | 后端 `.env` |
| `DATABASE_URL` | Supabase PostgreSQL | 后端 `.env` |
| `NEXT_PUBLIC_API_URL` | 后端地址 | 前端 `.env` |

---

## 十一、版本演进记录

| 版本 | 关键特性 |
|:---|:---|
| **v1.0** | 基础框架搭建，9 步 SOP 流程定义，三频道配置 |
| **v2.0** | 数据库持久化（Supabase），品牌资产管理，素材 KV 检索 |
| **v3.0** | 风格画像系统（6 维特征分析），样文管理（JSONB 存储） |
| **v3.5** | 样文矩阵模式（独立表 `style_samples`），智能匹配推荐，custom_tags + AI 建议标签 |
| **v3.6** | 调研事实地基（Step 2 摘要注入 Step 7），调研卡点（可编辑确认） |
| **v3.7** | Step 7 瘦身（专注手感，禁令交由 Step 8），Step 8 升级四遍审校 + 风格 DNA 对齐评分 |
| **v3.8** | 禁用书目从 `writing_constraints.json` 动态加载，素材长文摘要化 |

---

## 十二、核心技术依赖

### 前端 (Node.js)

| 依赖 | 版本 | 用途 |
|:---|:---|:---|
| `next` | ^15.1.0 | React 全栈框架 (App Router) |
| `react` / `react-dom` | ^19.0.0 | UI 渲染 |
| `typescript` | ^5.7.2 | 类型系统 |
| `tailwindcss` | ^3.4.17 | 原子化 CSS |
| `@radix-ui/*` | latest | 无障碍 UI 基础组件 |
| `lucide-react` | ^0.563.0 | 图标库 |
| `@supabase/supabase-js` | ^2.93.2 | Supabase 客户端 |
| `docx` | ^9.5.1 | Word 文档导出 |
| `file-saver` | ^2.0.5 | 文件下载 |

### 后端 (Python)

| 依赖 | 版本 | 用途 |
|:---|:---|:---|
| `fastapi` | 0.115.6 | Web 框架 |
| `uvicorn` | 0.32.1 | ASGI 服务器 |
| `anthropic` | 0.42.0 | Claude API SDK |
| `sqlalchemy` | 2.0.36 | ORM |
| `psycopg2-binary` | 2.9.10 | PostgreSQL 驱动 |
| `pgvector` | 0.3.6 | 向量检索扩展 |
| `httpx` | 0.28.1 | 异步 HTTP 客户端 |
| `langchain` | 0.3.14 | LLM 框架（预留） |
| `langgraph` | 0.2.59 | 工作流状态图（预留） |
| `alembic` | 1.14.0 | 数据库迁移 |
| `python-docx` | 1.1.2 | Word 文档解析 |
| `beautifulsoup4` | 4.12.3 | HTML 解析 |

---

## 十三、启动与运行

### 13.1 前端启动

```bash
# 安装依赖
npm install

# 开发模式 (http://localhost:3000)
npm run dev

# 生产构建
npm run build && npm start
```

### 13.2 后端启动

```bash
cd server

# 安装 Python 依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key 和数据库连接

# 开发模式 (http://localhost:8000)
uvicorn main:app --reload --port 8000

# 或使用 PowerShell 脚本
./start_server.ps1
```

### 13.3 数据库初始化

```bash
cd server/database
python init_db.py          # 自动建表
python migrations/*.py     # 执行迁移
```

---

## 十四、关键设计决策与权衡

### 14.1 JSON 配置 vs 数据库 — 「单一数据源策略」

- **JSON 文件** 是配置的"真相来源"（Source of Truth）
- **数据库** 仅用于管理界面的 CRUD 操作
- 通过 `sync-config` API 实现 DB → JSON 同步
- 工作流引擎始终优先读取 JSON

**原因**：JSON 文件可版本控制、可离线编辑、部署简单

### 14.2 样文 JSONB → 独立表（v3.5 迁移）

- 早期将样文存储在 `channels.style_samples` JSONB 字段中
- v3.5 迁移为独立的 `style_samples` 表
- 原因：支持每篇样文独立 6 维特征、标签系统、智能匹配
- 保留 JSONB 回退兼容

### 14.3 Step 7 瘦身 + Step 8 接管禁令（v3.7）

- Step 7 只关注「文字流动感」和「风格复刻」
- 所有禁令检查（屏蔽词、禁用书目、风格对齐）交由 Step 8
- **原因**：让 AI 在创作时不受规则束缚，审校时再严格把关

### 14.4 数据库操作重试机制

- `db_retry` 装饰器：最多 3 次重试，间隔 1 秒
- 应对 Railway/Supabase 临时网络抖动
- `pool_pre_ping=True` 自动检测失效连接

---

## 十五、待优化方向

| 方向 | 当前状态 | 建议 |
|:---|:---|:---|
| **向量检索** | RAG 框架已搭建，关键词匹配为主 | 接入 OpenAI Embedding 实现语义检索 |
| **LangGraph 集成** | 依赖已安装，未深度使用 | 用 StateGraph 管理 9 步状态机 |
| **流式输出** | SSE 框架已搭建 | 完善 Step 7 创作过程的实时流式展示 |
| **用户认证** | 暂无 | 添加登录/权限管理 |
| **导出功能** | docx 依赖已安装 | 完善一键导出为 Word/微信格式 |
| **多人协作** | 单用户模式 | 支持多编辑同时使用 |
| **A/B 测试** | 无 | 对比不同风格样文的产出质量 |

---

## 十六、代码质量统计

| 维度 | 数据 |
|:---|:---|
| 前端 TypeScript/TSX | ~5,000+ 行 |
| 后端 Python | ~6,000+ 行 |
| SQL Schema | ~240 行 |
| JSON 配置 | ~300+ 行 |
| 核心引擎 (`workflow_engine.py`) | 1,509 行 |
| 核心页面 (`workbench/page.tsx`) | 2,467 行 |
| 数据库服务 (`db_service.py`) | 1,400+ 行 |
| API 路由总数 | 35+ 个端点 |
| 数据库表 | 5 张 |
| 数据库索引 | 10+ 个 |
| Python 依赖 | 26 个包 |
| Node.js 依赖 | 20 个包 |

---

## 十七、总结

**老约翰自动化写作 AGENT** 是一个工程化程度很高的 AI 写作系统，它不是简单地调用 LLM 生成文章，而是：

1. **流程化**：将"写文章"拆解为 9 个可控步骤，每步有明确输入输出
2. **品牌化**：三频道 × 独立人格 × 标杆样文 × 6 维风格特征 = 工业化品牌调性
3. **去 AI 化**：四层防护体系（屏蔽词 + 素材融入 + 风格DNA + 四遍审校）系统性降低 AI 检测率
4. **透明化**：Think Aloud 机制 + 卡点确认 + 用户掌控权
5. **工程化**：前后端分离 + 数据库持久化 + 云端部署 + 重试机制

整套系统已完成从概念到可运行产品的全链路搭建，具备真实的业务落地价值。

---

> **本文档由 AI 自动扫描生成** | 扫描范围：整个 workspace 核心代码  
> **文件路径**：`README_STORY_AI.md`  
> **最后更新**：2026-02-10



