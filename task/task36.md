# Role
资深全栈工程师 (Next.js 15, React, Tailwind CSS, FastAPI, LangChain, PostgreSQL)

# Task
为 "Old John Writing Agent" 开发可视化的知识库文件上传与管理功能，让运营人员可以通过 Web 界面直接上传文档，系统自动完成向量化并存入数据库。
参考 @README_STORY_AI.md 了解项目当前架构。

# Step 1: 后端 API 开发 (server/routers/admin_knowledge.py)
1. 创建一个新的路由文件 `admin_knowledge.py`，并挂载到主 `main.py` 中（路由前缀 `/api/admin/knowledge`）。
2. 开发接口 `POST /upload`:
   - 接收参数: `file: UploadFile`, `channel_scope: str` (deep_reading 或 picture_books), `material_type: str` (lesson_plan, article, booklist, qa 等)。
   - 逻辑: 
     - 将上传文件保存到临时目录。
     - 根据文件后缀 (.docx, .pdf) 使用 langchain 对应的 DocumentLoader 读取文本。
     - 使用 `RecursiveCharacterTextSplitter` (chunk_size=600, overlap=100) 进行切片。
     - 调用 OpenAI Embedding 接口生成向量。
     - 存入 `KnowledgeChunk` 表，保留 `source_filename`, `channel_scope`, `material_type` 等元数据。
     - 清理临时文件，返回成功信息及切片数量。

# Step 2: 后端服务层封装 (server/services/document_parser.py)
1. 将刚才提到的解析 (Loader) -> 切片 (Splitter) -> 向量化 (Embedding) 逻辑封装到一个独立的 Service 类中，保持路由层整洁。复用现有的 `async_session_maker`。

# Step 3: 前端页面开发 (app/admin/knowledge/page.tsx)
1. 创建一个新的后台管理页面 `/admin/knowledge`。
2. UI 设计: 
   - 采用左右分栏或上下结构的现代化卡片设计 (符合现有 Tailwind 风格)。
   - **表单区**: 
     - 频道选择 (Select): 小学深度阅读、幼儿绘本阅读。
     - 资料类型选择 (Select): 课程详案、公号文、专家问答、主题书单。
     - 文件上传区 (拖拽或点击上传，支持 .docx, .pdf)。
     - 提交按钮 (带有 Loading 状态)。
   - **状态区**: 
     - 显示上传进度或成功/失败的 Toast 提示。
3. 交互逻辑: 
   - 组装 `FormData`，调用后端的 `/api/admin/knowledge/upload` 接口。

# Constraints
- 必须使用异步 (`async/await`) 处理文件和数据库。
- 考虑到向量化可能耗时，前端必须有明确的 loading 状态防抖，避免用户重复点击。
- 代码需处理常见异常（如文件格式不支持、上传失败），并返回友好的错误提示。