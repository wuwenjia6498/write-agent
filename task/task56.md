# Role
高级前端工程师 (UI/UX 专家)

# Task
重构工作台 (`app/workbench/page.tsx`) 和 任务历史页 (`app/tasks/[id]/page.tsx`) 中 Step 5 的“风格已锁定”提示卡片 UI。去除当前过于花哨的颜色和 Emoji，使其完美融入系统现有的 Apple 极简风和沉稳的品牌调性。

# UI Update Requirements (请务必同时修改上述两个文件中的 Step 5 渲染区块)

1. **色彩与容器降噪 (去除亮绿色)**：
   - 移除所有亮绿色背景和边框类名 (如 `bg-green-50`, `border-green-200`, `text-green-600` 等)。
   - 替换为极简风格的容器：浅灰底色 (如 `bg-slate-50` 或 `bg-gray-50/50`)，细微边框 (`border border-slate-100` 或 `border-border`)，圆角 (`rounded-lg`)，适中的内边距 (`p-4` 或 `p-5`)。

2. **图标专业化 (彻底消灭 Emoji)**：
   - **绝对禁止**在文案中使用 ✅ 和 📌 等 Emoji 表情。
   - 引入并使用 `lucide-react` 组件库中的线性图标。
   - 主标题图标：使用 `<CheckCircle2 className="w-5 h-5 text-blue-600" />` (或 `text-slate-700`)。

3. **样文展示列表 (极简重构)**：
   - 移除原先红绿搭配的胶囊状 Badge 样式。
   - 将选中的样文渲染为清爽的垂直列表 (`flex flex-col gap-2` 或单纯的 `ul`)。
   - 每一项样文的样式设计为干净的微型卡片：白底 (`bg-white`)、细边框 (`border border-slate-200`)、小圆角 (`rounded-md`)、浅色阴影 (`shadow-sm`)、文字颜色 (`text-slate-700 text-sm`)。
   - 每篇样文标题前，使用 `<FileText className="w-4 h-4 text-slate-400 mr-2" />` 作为点缀图标。

4. **文案层级与颜色**：
   - 主标题：“风格基调已自动锁定” (使用 `text-slate-800 font-medium`)。
   - 副标题（描述说明）使用偏灰的辅助色 (`text-slate-500 text-sm mt-1`)。