# Role
资深前端工程师

# Task
优化新建创作任务页面中“需求简述”版块的 UI。为了防止用户输入时提示语消失，需将输入规范从 textarea 的 placeholder 中移出，改为一个常驻的 UI 辅助说明块 (Helper Text Box)。

# UI Update Requirements (定位到新建任务组件，如 `app/workbench/page.tsx` 或 `app/admin/tasks/new/page.tsx` 等)
1. **找到“需求简述”区域**：定位到标题 Label（“需求简述”）和其下方的多行文本输入框 (Textarea)。
2. **新增常驻提示块**：在标题 Label 和 Textarea 之间（或 Textarea 下方），插入一个带浅色背景（如 Tailwind 的 `bg-blue-50` 或 `bg-gray-50`）、圆角 (`rounded-md`)、内边距适中的提示信息框。
3. **提示块文案内容**：
   - 💡 **高分指令公式**：【核心痛点】 + 【期望切入角度】 + 【召唤内部知识库】 + 【字数与格式】
   - 📝 **参考示例**：针对“二年级只看漫画不看纯文字书”的痛点，请从“图像到文字的认知过渡”角度切入，重点参考内部资料《洋葱头历险记》或桥梁书的教学策略，写一篇 1800 字的公号文。
4. **调整样式**：提示块的文字大小建议为 `text-sm`，文字颜色偏灰或浅蓝，确保它起到辅助作用而不喧宾夺主。
5. **精简 Placeholder**：将 Textarea 原本的 placeholder 简化为一句简单的引导：“请输入您的创作需求，建议参考上方示例...”