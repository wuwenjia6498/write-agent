# Role
前端开发工程师 (UX/UI 专家)

# Task
在 `components/ArticleEditor.tsx` 组件中新增“一键复制全文 (Copy to Clipboard)”功能，打通内容导出的最后一公里。

# Action
请修改 `ArticleEditor` 组件，增加以下功能与交互：

1. **添加悬浮复制按钮 (UI 布局)**：
   - 在文章展示区域的右上角（建议使用 `relative` 容器搭配 `absolute top-4 right-4`，或者直接融合在顶部的提示条/工具栏右侧），添加一个轻量级的“复制”按钮。
   - 按钮样式要求精致：默认状态为线框或浅色背景，带一个【Copy / 文档】的 SVG 小图标。

2. **实现复制逻辑 (Clipboard API)**：
   - 编写 `handleCopy` 函数，当用户点击按钮时，调用 `navigator.clipboard.writeText(content)` 将当前编辑器内**最新的完整文本内容**写入系统剪贴板。

3. **极佳的交互反馈 (UX Feedback)**：
   - 点击后，按钮的图标和文案需瞬间切换为绿色高亮的“✅ 已复制 (Copied)”。
   - 设定一个 `setTimeout`，在 2 秒后自动将按钮恢复为默认的“复制”状态。
   - 同时触发一个轻量的全局 Toast 提示：“全文已成功复制到剪贴板”。