# Role
资深全栈工程师

# Task
在知识库管理列表 (`app/admin/knowledge/page.tsx`) 中，新增“查看切片详情”的功能，允许用户预览某个文件具体被切分成了哪些文本内容。

# Step 1: 后端 API 开发 (server/routers/admin_knowledge.py)
1. 新增接口 `GET /chunks`:
   - 接收参数 (Query Params): `source_filename` (字符串)。
   - 目的：查询 `KnowledgeChunk` 表中该文件名对应的所有记录。
   - 返回字段：返回一个包含所有 chunk 的数组，每个对象需包含 `id`, `content` (切片的具体文字), `created_at`。按时间或 ID 排序。

# Step 2: 前端页面开发 (app/admin/knowledge/page.tsx)
1. 在资料库列表的表格“操作”列中，在“删除”按钮前新增一个“查看”按钮。
2. 交互逻辑：
   - 点击“查看”按钮时，打开一个侧边抽屉 (Drawer) 或居中弹窗 (Modal)。
   - 组件打开时，展示加载状态 (Loading)，请求 `GET /api/admin/knowledge/chunks?source_filename=xxx`。
   - 获取到数据后，在抽屉/弹窗中以卡片 (Card) 的列表形式展示所有的 `content` 文本段落。
   - 样式要求：文本展示区域应支持自动换行，保持良好的阅读间距，并显示“切片 1”、“切片 2”的序号标记。
   - 提供明确的“关闭”按钮。