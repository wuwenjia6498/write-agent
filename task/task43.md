# Role
资深全栈工程师 (Next.js 15, FastAPI)

# Task
执行“素材库并入知识库”的第一步重构。改造现有的知识库管理页面 (`app/admin/knowledge/page.tsx`)，增加“手动录入文本”的功能；并新增对应的后端接收接口。

# Step 1: 扩展资料类型字典 (Frontend & Backend)
1. 在前端 `CHANNEL_MATERIAL_MAP` 配置中，为所有的三个频道 (`deep_reading`, `picture_books`, `parenting`) 统一追加一个资料类型：
   - `anecdote`: "真实案例/微素材"
2. 确保后端枚举或校验逻辑允许 `anecdote` 类型的存入。

# Step 2: 前端 UI 改造 (app/admin/knowledge/page.tsx)
1. 在“上传知识文档”卡片的顶部，增加一个 Tabs 或 Toggle 切换器，包含两个选项：【文件上传】和【手动录入】。
2. 无论选择哪个 Tab，“频道范围”和“资料类型”的下拉框保持共用不变。
3. 当切换到【文件上传】时：显示原有的拖拽上传区域和按钮。
4. 当切换到【手动录入】时：
   - 隐藏拖拽上传区域。
   - 新增一个“标题”输入框 (Input, 必填，作为 source_filename)。
   - 新增一个“素材内容”多行文本框 (Textarea, 必填，提示语：“例如：那天在课堂上，一个三年级的孩子读完《夏洛的网》后说...”)。
   - 提交按钮文字改为“保存并向量化”。

# Step 3: 后端 API 新增 (server/routers/admin_knowledge.py)
1. 新增接口 `POST /upload_text`:
   - 接收 JSON Body 参数: `title` (str), `content` (str), `channel_scope` (str), `material_type` (str)。
   - 逻辑处理：
     - 将 `title` 加上 `.txt` 后缀作为 `source_filename`。
     - 将 `content` 包装为纯文本，调用现有的 `RecursiveCharacterTextSplitter` 进行切片（如果文本很短可能就只有 1 个 chunk）。
     - 调用 Embedding 模型向量化。
     - 存入 `KnowledgeChunk` 数据库表。
     - 返回成功信息和切片数量。
2. 前端【手动录入】表单提交时，调用此新接口。完成后清空 Textarea 并刷新右侧的资料列表。