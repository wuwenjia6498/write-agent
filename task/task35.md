# Role
资深前端工程师 (Next.js 15, React 19, Tailwind CSS)

# Task
修复工作台 (Workbench) 渲染调研报告参考来源时，内部数据库链接导致 404 的 Bug。

# Logic Requirements
1. 找到前端渲染“参考来源”或“搜索结果”列表的代码（大概率在 `app/workbench/page.tsx` 中 Step 2 结果展示区域，或者提取的某个子组件中）。
2. 在 `map` 渲染搜索来源列表时，增加一个条件判断：
   - 如果 `source.url` 等于 `"internal_database"` 或者不以 `"http"` 开头：
     **不要使用** `<a href=...>` 标签。
     将其渲染为一个视觉上独特的 `<Badge>` 或 `<span>`（例如：背景为淡蓝色或带有小图标，表明这是“老约翰内部库”），并且**不可点击**。
   - 如果是正常的 `http` 链接：
     保持原有的 `<a target="_blank">` 跳转逻辑。
3. 确保样式美观，符合整体的 Apple 简约设计系统规范。