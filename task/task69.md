# Role
前端开发工程师 (UX/UI 专家)

# Task
优化 `components/ArticleEditor.tsx` 组件，将“直接强制替换”升级为“先预览、后确认（Preview & Confirm）”的防错交互模式。

# Problem
目前 AI 重写接口返回数据后，直接原位替换了正文文本。如果 AI 生成的内容不理想，用户无法撤销（Undo）。我们需要赋予用户把控权。

# Action
请修改 `ArticleEditor` 组件内部的 State 和 UI 渲染逻辑：

1. **引入缓冲状态 (State)**：
   - 新增 `suggestedText` 状态，用于暂存 AI 接口返回的重写结果。**绝不能在接口刚返回时就去修改 `content` 正文。**

2. **浮层 UI 状态切换**：
   - **状态 A（输入模式）**：默认划词后弹出的 UI，包含输入框和魔法棒按钮。
   - **状态 B（预览与决策模式）**：当接口成功返回重写文本后，浮层自动变宽/变大，上方用浅绿色背景区（或引文样式）清晰展示 AI 写好的 `suggestedText`。下方提供三个并排的操作按钮：
     - **✅ 替换 (Replace)**：用户点击后，才真正执行咱们之前写好的精确索引切片替换（`content.slice(0, startIndex) + suggestedText + content.slice(endIndex)`），随后触发静默保存，清空状态并关闭浮层。
     - **🔄 重试 (Retry)**：用户觉得不满意，点击后清空当前 `suggestedText`，用刚才的指令重新请求一次 API。
     - **❌ 取消 (Discard)**：放弃修改，直接清空状态并关闭浮层，原文保持原样。

3. **核心底线**：
   - 绝对不要破坏之前已经完美实现的 `TreeWalker` 精确获取 `startIndex / endIndex` 的逻辑，仅仅是把“执行替换”的动作，从“接口返回时”延后到了“用户点击【替换】按钮时”。