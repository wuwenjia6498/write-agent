# Role
你是一个资深 Python 后端工程师 (FastAPI/LangChain)。

# Context
我们刚刚完成了 "Old John Writing Agent" 的知识库数据导入 (PostgreSQL + pgvector)。
现在的任务是将这些数据接入到写作工作流中，实现 RAG (检索增强生成)。
参考 @README_STORY_AI.md 了解现有项目结构。

# Task 1: 创建检索服务 (server/services/knowledge_service.py)
请编写一个 `KnowledgeService` 类，包含以下核心方法：

1.  `search_docs(query: str, channel_scope: str, limit: int = 5)`
    -   使用 OpenAI Embeddings 将 query 向量化。
    -   在 `KnowledgeChunk` 表中进行向量相似度搜索 (Cosine Distance)。
    -   **关键过滤**: 必须加上 `WHERE channel_scope = :scope` (实现频道隔离)。
    -   返回匹配的文本块列表。

2.  `search_books(query: str, grade: str = None)`
    -   (仅针对小学频道) 在 `CurriculumBook` 表中进行模糊匹配 (书名/作者/简介)。
    -   返回匹配的书籍详情 (包含阅读建议)。

3.  `format_knowledge_for_prompt(chunks: list, books: list) -> str`
    -   将检索到的结果格式化为清晰的 String，准备喂给 LLM。
    -   格式示例:
        ```text
        === 内部知识库参考 ===
        [专家观点]: 孩子不爱看书可能是因为...
        [推荐书单]: 《魔法亲亲》适合分离焦虑...
        ==================
        ```

# Task 2: 改造工作流引擎 (server/services/workflow_engine.py)
请修改 `WorkflowEngine` 类，注入 RAG 逻辑：

1.  **修改 `execute_step_2` (信息搜索)**:
    -   在调用外部搜索 (Tavily) 之前，**优先调用** `knowledge_service.search_docs`。
    -   使用用户输入的 `task_topic` 作为查询词。
    -   根据 `channel_id` 自动判断 `channel_scope` ('deep_reading' 或 'picture_books')。
    -   将检索到的内部知识存入 `step2_data['internal_knowledge']`。

2.  **修改 `execute_step_7` (初稿生成)**:
    -   在构建 System Prompt 或 User Prompt 时，检查 `step2_data` 中是否有 `internal_knowledge`。
    -   如果有，**强制注入** 到 Prompt 的 "Context" 部分。
    -   **Prompt 强化指令**: "请优先基于以下【内部知识库参考】中的观点和案例进行写作，确保符合品牌价值观。"

# Requirements
- 使用 `asyncio` 和 `AsyncSession`。
- 确保处理好“检索结果为空”的情况（优雅降级，不要报错）。
- 在控制台打印清晰的日志: `[RAG] Channel: deep_reading | Query: xxx | Found: 5 docs`。