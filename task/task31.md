# Role
你是一个资深的全栈工程师 (Python/FastAPI/PostgreSQL)，精通 RAG 系统构建和 ETL 数据处理。

# Context
我们正在为 "Old John Writing Agent" 构建核心知识库。
数据源文件已存放在项目根目录的 `data_source/` 文件夹下。

# 任务目标
请一次性生成完成以下工作所需的代码：
1. 更新数据库模型 (SQLAlchemy)。
2. 安装必要的依赖。
3. 编写三个独立的数据导入脚本（ETL）。

---

# Step 1: 依赖管理 (server/requirements.txt)
请确保添加以下库，不要删除原有依赖：
pandas
python-docx
pypdf
langchain
langchain-community
langchain-openai
psycopg2-binary
pgvector
tiktoken

# Step 2: 数据库模型 (server/database/models.py)
请在原有 `Base` 下新增两个模型：

Class 1: `CurriculumBook` (结构化书籍表)
- id: Integer, Primary Key
- title: String (书名)
- author: String (作者)
- grade: String (年级)
- content_intro: Text (内容介绍)
- reading_suggestion: Text (阅读建议 - 包含要点和建议)
- created_at: DateTime

Class 2: `KnowledgeChunk` (非结构化向量表)
- id: Integer, Primary Key
- content: Text (切片内容)
- embedding: Mapped[Vector] (使用 pgvector, 维度 1536)
- channel_scope: String (核心字段! 必须是 'deep_reading' 或 'picture_books')
- material_type: String (枚举: 'lesson_plan', 'article', 'booklist', 'qa')
- tags: JSONB (存放提取的元数据或关键词)
- source_filename: String (文件名)
- created_at: DateTime

# Step 3: 编写导入脚本 (server/scripts/)

脚本 A: `import_primary_books.py` (处理 books.csv)
- 目标文件: `data_source/primary_school/books.csv`
- 逻辑:
  1. 使用 pandas 读取 CSV 文件。
  2. **字段映射** (根据实际 CSV 列名):
     - `title` <- "书名"
     - `author` <- "作者"
     - `grade` <- "grade" (直接读取该列)
     - `content_intro` <- "内容简介"
     - `reading_suggestion` <- 组合字段 ("阅读要点" + "\n\n" + "阅读建议")
  3. 清洗数据：去除 NaN 值，去除空白字符。
  4. 批量插入 `CurriculumBook` 表。
  5. 输出: "成功导入 X 本书，涵盖年级: [一年级, 二年级...]"。

脚本 B: `import_primary_rag.py` (处理小学文档)
- 目标目录: `data_source/primary_school/lesson_plans/` 和 `articles/`
- 逻辑:
  1. 遍历目录下的 .docx 和 .pdf。
  2. 提取文本并使用 RecursiveCharacterTextSplitter 切片 (chunk_size=600, overlap=100)。
  3. 调用 OpenAI Embeddings 生成向量。
  4. 存入 `KnowledgeChunk`。
  5. **强制 Tag**:
     - 详案目录 -> `channel_scope='deep_reading'`, `material_type='lesson_plan'`
     - 公号文目录 -> `channel_scope='deep_reading'`, `material_type='article'`

脚本 C: `import_picture_book_rag.py` (处理绘本文档)
- 目标目录: `data_source/picture_books/book_lists/` 和 `qa_guides/`
- 逻辑:
  1. 遍历 .docx 文件。
  2. 切片并向量化。
  3. **强制 Tag**:
     - 书单目录 -> `channel_scope='picture_books'`, `material_type='booklist'`
     - 问答目录 -> `channel_scope='picture_books'`, `material_type='qa'`

# Execution Constraints
- 所有脚本必须使用 `asyncio` 运行。
- 数据库连接请复用 `server/database/config.py` 中的 `async_session_maker`。
- 必须包含详细的 print 日志。
- 遇到无法解析的文件，打印错误并跳过，不要中断整个进程。