# 🚀 老约翰自动化写作AGENT - 启动指南

## 📋 项目概述

这是一个基于 AI 驱动的品牌内容创作平台，专门服务于"老约翰儿童阅读"品牌的多元化内容创作。

**核心特性：**
- ✅ 两层判断机制（工作区路由 + 频道路由）
- ✅ 9步完整SOP工作流
- ✅ 三个垂直频道（深度阅读、绘本阅读、育儿方向）
- ✅ 全局屏蔽词审校机制
- ✅ Think Aloud 透明化思考过程

---

## 🛠 技术栈

### 前端
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS** (Apple 风格设计)

### 后端
- **Python 3.11+**
- **FastAPI**
- **LangGraph** (工作流状态管理)
- **Supabase** (PostgreSQL + pgvector，可选)

### AI 服务
- **Claude 3.5 Sonnet** (Anthropic)
- **Search API** (Tavily，可选)

---

## 📦 环境准备

### 1. 前端环境

#### 安装 Node.js
确保已安装 Node.js 18+ 和 npm/yarn/pnpm。

```bash
node --version  # 应该 >= 18.0.0
npm --version
```

#### 安装依赖
```bash
npm install
# 或
yarn install
# 或
pnpm install
```

### 2. 后端环境

#### 创建 Python 虚拟环境
```bash
cd server
python -m venv venv

# Windows 激活
venv\Scripts\activate

# Linux/Mac 激活
source venv/bin/activate
```

#### 安装 Python 依赖
```bash
pip install -r requirements.txt
```

#### 配置环境变量
复制 `.env.example` 并重命名为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 API Keys：

```env
# Anthropic API Key (必需)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Tavily Search API Key (可选，用于信息搜索)
TAVILY_API_KEY=your_tavily_api_key_here

# Supabase (可选，用于向量数据库)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here

# App Config
ENVIRONMENT=development
DEBUG=true
```

**获取 API Keys：**
- **Anthropic API Key**: https://console.anthropic.com/
- **Tavily API Key**: https://tavily.com/

---

## 🚀 启动项目

### 方式一：分别启动（推荐用于开发）

#### 1. 启动后端服务
```bash
cd server
python main.py
# 或
uvicorn main:app --reload --port 8000
```

后端服务将运行在：http://localhost:8000

访问 http://localhost:8000/docs 查看 API 文档。

#### 2. 启动前端服务
打开新终端：

```bash
npm run dev
```

前端服务将运行在：http://localhost:3000

### 方式二：使用 npm scripts

```bash
# 终端1：启动前端
npm run dev

# 终端2：启动后端
npm run server
```

---

## 🎯 快速测试

### 1. 访问主页
打开浏览器访问：http://localhost:3000

您将看到欢迎页面，包含：
- 项目介绍
- 核心特点展示
- "开始创作"和"频道管理"按钮

### 2. 查看频道配置
点击"频道管理"或访问：http://localhost:3000/channels

可以查看三个频道的详细配置：
- 深度阅读（小学段）
- 绘本阅读（幼儿段）
- 育儿方向（家长随笔）

### 3. 测试创作工作流
1. 点击"开始创作"或访问：http://localhost:3000/workbench
2. 选择一个频道（如"深度阅读"）
3. 输入需求简述，例如：
   ```
   我想写一篇关于《窗边的小豆豆》整本书阅读策略的文章，
   目标读者是小学生家长，期望3000字左右。
   ```
4. 点击"启动创作流程"
5. 观察：
   - 左侧：9步流程进度条
   - 中间：主工作区
   - 右侧：Think Aloud 思考过程

---

## 📁 项目结构

```
write-agent/
├── app/                        # Next.js App Router
│   ├── layout.tsx             # 全局布局
│   ├── page.tsx               # 主页
│   ├── globals.css            # 全局样式
│   ├── workbench/             # 创作工作台
│   │   └── page.tsx
│   └── channels/              # 频道管理
│       └── page.tsx
│
├── components/                 # React 组件
│   ├── WorkflowProgress.tsx   # 9步进度组件
│   ├── ThinkAloud.tsx         # Think Aloud 侧边栏
│   └── ChannelSelector.tsx    # 频道选择器
│
├── server/                     # FastAPI 后端
│   ├── main.py                # 入口文件
│   ├── requirements.txt       # Python 依赖
│   ├── routes/                # API 路由
│   │   ├── channels.py        # 频道管理
│   │   ├── workflow.py        # 工作流管理
│   │   └── materials.py       # 素材管理
│   └── configs/               # 配置文件
│       ├── channels/          # 频道配置
│       │   ├── deep_reading.json
│       │   ├── picture_books.json
│       │   └── parenting.json
│       └── global/            # 全局配置
│           └── blocked_words.json
│
├── package.json               # Node.js 配置
├── tsconfig.json              # TypeScript 配置
├── tailwind.config.js         # Tailwind 配置
├── next.config.js             # Next.js 配置
├── README.md                  # 项目说明
├── SETUP.md                   # 本文件
└── prd.md                     # 产品需求文档
```

---

## 🔧 常见问题

### Q1: 后端API调用失败？
**A:** 检查：
1. 后端服务是否运行在 http://localhost:8000
2. 查看浏览器控制台是否有CORS错误
3. 确认 `next.config.js` 中的代理配置正确

### Q2: 启动后端时提示模块找不到？
**A:** 确保：
1. 已激活 Python 虚拟环境
2. 已运行 `pip install -r requirements.txt`
3. Python 版本 >= 3.11

### Q3: 前端样式显示异常？
**A:** 尝试：
```bash
rm -rf .next
npm run dev
```

### Q4: API Keys配置问题？
**A:** 
- 如果只想测试前端界面，可以不配置 API Keys
- 要完整测试工作流，至少需要 `ANTHROPIC_API_KEY`
- Tavily 和 Supabase 是可选的

---

## 📝 下一步开发

当前版本完成了核心骨架，后续可以扩展：

### Phase 2 功能
- [ ] 集成 Claude API 实现真实的内容生成
- [ ] 实现 LangGraph 工作流编排
- [ ] 添加文件上传功能（素材库）
- [ ] 实现素材检索（关键词/语义搜索）

### Phase 3 功能
- [ ] 集成 Supabase 向量数据库
- [ ] 实现 RAG 素材检索
- [ ] 添加用户认证系统
- [ ] 多人协作功能
- [ ] 历史记录管理

---

## 📞 支持

如有问题，请查阅：
- `README.md` - 项目核心理念说明
- `prd.md` - 产品需求文档
- API 文档：http://localhost:8000/docs（后端运行时）

---

**祝您使用愉快！开始创造高质量的品牌内容吧！** 🎉

