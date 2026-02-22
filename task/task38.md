# Role
资深前端/后端工程师

# Task
更新知识库管理后台 (`app/admin/knowledge/page.tsx`) 的频道与资料类型级联联动配置，以适配最新的业务分类需求。

# Configuration Data
请使用以下最新的映射字典（Key 为存入数据库的 `material_type`，Value 为前端显示的中文标签）：

1. **小学生深度阅读 (`deep_reading`)**:
   - `lesson_plan`: "课程详案"
   - `article`: "公号文"
   - `course_info`: "课程说明资料"
   - `theory_book`: "理论书籍"

2. **幼儿绘本阅读 (`picture_books`)**:
   - `booklist`: "主题书单"
   - `qa`: "专家问答"
   - `guide_book`: "指导与理论书籍"

3. **育儿频道 (`parenting`)**:
   - `article`: "公号文"
   - `parenting_book`: "育儿类书籍"

# Logic Update
1. 在前端界面的“频道选择”下拉框中，确保有以上三个频道。
2. 当选择不同频道时，“资料类型”下拉框必须严格显示上述对应的中文 Value，并在提交表单时传递对应的英文 Key。
3. 如果后端 `admin_knowledge.py` 或数据库模型中有对 `material_type` 的枚举校验 (Enum Validation)，请同步更新以允许这些新的英文 Key 写入数据库。