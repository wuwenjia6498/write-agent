# Role
资深全栈工程师

# Task
优化知识库管理后台 (`app/admin/knowledge/page.tsx`) 的“资料库列表”视图，增加按“资料类型 (material_type)”进行二次筛选的功能。

# Step 1: 后端 API 优化 (server/routers/admin_knowledge.py)
1. 找到现有的 `GET /list` 接口。
2. 在接收参数中，除了原有的可选参数 `channel_scope` 外，新增一个可选参数 `material_type: Optional[str] = None`。
3. 在构建数据库查询 (SQL / SQLAlchemy query) 时，增加过滤条件：如果传入了 `material_type`，则按该字段进行进一步过滤。

# Step 2: 前端页面优化 (app/admin/knowledge/page.tsx)
1. 在“资料库列表”顶部的筛选区域，在现有的“频道筛选”下拉框右侧，新增一个“类型筛选”下拉框。
2. 复用之前为上传表单定义的 `CHANNEL_MATERIAL_MAP` (或等效的联动字典)。
3. 交互逻辑：
   - “类型筛选”下拉框的选项（Options）必须根据当前“频道筛选”选中的值动态生成。
   - 默认额外增加一个“全部类型 (All)”的选项。
   - 当用户更改“频道”时，自动将“类型”重置为“全部”，并重新请求列表数据。
   - 当用户更改“类型”时，触发列表数据重新请求，将 `channel_scope` 和 `material_type` 一起作为 query 传给后端的 `/list` 接口。