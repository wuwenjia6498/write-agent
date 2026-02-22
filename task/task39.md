# Role
资深全栈工程师

# Task
为 "Old John Writing Agent" 的知识库管理后台 (`/admin/knowledge`) 增加“文件列表查看与管理”功能。

# Step 1: 后端 API 开发 (server/routers/admin_knowledge.py)
1. 新增接口 `GET /list`:
   - 目的：查询 `KnowledgeChunk` 表，按 `source_filename` 进行分组 (GROUP BY)。
   - 返回字段：`source_filename` (文件名), `channel_scope` (频道), `material_type` (资料类型), `chunk_count` (该文件被切分的数量), `created_at` (最新上传时间)。
   - 支持按 `channel_scope` 过滤。
2. 新增接口 `DELETE /delete`:
   - 接收参数：`source_filename`。
   - 逻辑：从 `KnowledgeChunk` 表中删除所有该文件名的切片数据。

# Step 2: 前端页面开发 (app/admin/knowledge/page.tsx)
1. 改造现有页面，将其分为左右两栏或使用 Tabs 切换（"上传资料" vs "资料库列表"）。
2. 在“资料库列表”视图中：
   - 增加一个表格 (Table) 来展示 `GET /list` 获取的数据。
   - 表格列：文件名、所属频道 (显示中文)、资料类型 (显示中文)、切片数量、上传时间、操作 (删除按钮)。
   - 顶部增加一个“频道”筛选下拉框，方便用户只看“小学”或“绘本”的资料。
3. 交互逻辑：
   - 页面加载时自动请求列表数据。
   - 上传新文件成功后，自动刷新这个列表。
   - 点击删除按钮时，弹出二次确认框，确认后调用 `DELETE` 接口并刷新列表。