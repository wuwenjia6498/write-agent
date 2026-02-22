# Role
资深 Python/Next.js 全栈工程师

# Task
优化育儿频道 (Parenting Channel) 的知识检索逻辑与上传配置。目前育儿频道暂无专属物理资料，需采用“虚拟借用”策略。

# Backend Update (server/services/knowledge_service.py)
在 `search_docs` 方法中，修改针对 `channel_scope` 的过滤逻辑：
- 如果传入的 `channel_scope` 是 `'parenting'`，则不要只查 `'parenting'`。
- 请将查询条件修改为：在 `'parenting'`, `'picture_books'`, `'deep_reading'` 这三个 scope 中，搜索与 query 最匹配的 chunk。
- 这样即使 `parenting` 标签下暂无数据，也能自动借用其他两个频道中蕴含的育儿/心理学观点。

# Frontend Update (知识库上传页面 & 工作台页面)
- 在刚才开发的知识库上传页面 (`/admin/knowledge`) 的“频道选择”下拉框中，确保包含【育儿频道 (parenting)】选项。这就为未来上传资料留好了入口。
- 在工作台创建任务的下拉框中，也确保有【育儿频道】。