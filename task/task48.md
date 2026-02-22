# Role
资深全栈工程师

# Task
修复工作台 (Workbench) Step 4 协作文档步骤的 UI 脱节问题：移除无用的历史记录按钮，并新增用户补充信息的输入框。

# Step 1: 移除无用 UI
1. 在呈现 Step 4 协作文档的组件中（可能是 `app/workbench/page.tsx` 或相关的 Step 组件），找到右上角的 `历史记录` 按钮/标签。
2. 直接删除该按钮的 DOM 结构及相关无用代码。

# Step 2: 增加“用户补充”输入框
1. 在 Step 4 的 Markdown 渲染区域下方，新增一个多行文本输入框 (Textarea)。
2. UI 提示语 (Placeholder) 设置为："在此输入补充信息（如真实案例细节、数据等）。如果确认无误且无需补充，请留空并直接点击「下一步」。"
3. 绑定一个 React State（例如 `userSupplement`）来实时获取用户的输入。

# Step 3: 工作流状态传递
1. 找到控制“进入下一步 (Step 5/7)”的按钮点击事件逻辑。
2. 在触发进入下一步的 API 请求或状态更新时，将这个 `userSupplement` 文本一同提交，保存到当前的 Task 状态或上下文中。
3. 确保最终调用 Step 7（生成初稿）的后端接口时，能够把这段用户补充的话作为参数（如 `user_feedback`）传给大模型。

# Step 4: 微调 Step 4 Prompt (server/services/workflow_engine.py)
1. 找到生成 Step 4 的 Prompt 模板。
2. 将结尾的引导语从“请回复：xxx”修改为适合前端界面的话术：“**请在下方输入框中补充上述信息。如果无需补充，请直接点击界面的「下一步」按钮，我将开始为您撰写初稿。**”