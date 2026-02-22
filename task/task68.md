# Role
前端开发工程师

# Task
修复“划词重写（Inline AI Rewrite）”功能在历史任务详情页（`app/tasks/[id]/page.tsx`）中未生效（无法唤出浮层）的 Bug。

# Bug 诊断
目前工作台页面的划词功能正常，但在历史任务详情页的“终稿” Tab 下，用户划选文本后没有任何反应（没有弹出修改工具栏）。

# Action
请打开 `app/tasks/[id]/page.tsx` 文件，执行以下精准修复：

1. **精准定位渲染区域**：找到历史详情页中，用于渲染**“终稿（Final）”内容**的 Tab 面板或对应的内容块。
2. **替换组件**：将该区域原本的文本/Markdown 渲染代码，彻底替换为咱们封装好的 `<ArticleEditor>` 组件。
3. **传递正确的 Props**：确保传入以下关键参数：
   - `content={taskData.final_article}` (或者是你代码中对应的终稿内容字段)
   - `taskId={taskId}`
   - `channelSlug={channelSlug}` (必须传入，以便后端获取频道红线)
   - `contentType="final"`
4. **解除只读锁定**：检查并确保在历史页调用该组件时，**绝对没有**传递 `readOnly={true}` 或类似禁用编辑的属性。历史页的终稿必须允许划词编辑并支持自动保存。