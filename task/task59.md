# Role
全栈开发工程师 (架构与 UX 专家)

# Task
将工作流中的 Step 6 (挂起等待/创作准备) 彻底自动化。移除其作为“人工卡点”的阻断逻辑，并优化前端 UI，使其成为一个静默流转的极简状态展示，实现从 Step 5 到 Step 7 的无缝衔接。

# Requirements (后端与前端同步重构):

## 1. 后端工作流引擎改造 (server/services/workflow_engine.py)
- 找到执行 Step 6 (`execute_step_6` 或相应逻辑) 的代码区块。
- 移除要求用户确认的挂起/阻塞逻辑 (例如移除设置状态为 `WAITING_CONFIRMATION` 或 `PENDING_USER_ACTION` 等等待前端确认的代码)。
- 确保 Step 6 执行完毕后（如打包好 prompt 和素材上下文），工作流能自动、立即推进到 Step 7 (`status` 直接设为进行中或触发下一步执行函数)。
- 在 Think Aloud 日志中追加记录：“[系统自动流转] 真实素材与风格特征已封装完毕，直接启动初稿生成。”

## 2. 前端进度条状态同步
- 定位到渲染左侧步骤导航的组件（如 `WorkflowProgress`）。
- 将 Step 6 (创作准备/挂起等待) 下方的副标题状态，由“卡点”明确修改为“自动”或“自动流转”。

## 3. 前端界面极简重构 (app/workbench/page.tsx & app/tasks/[id]/page.tsx 中渲染 Step 6 的区块)
- **彻底删除**该区域原有的“数据确认清单”多选框 UI 和“确认无误，点击继续...”的交互按钮。
- 采用与 Step 5 同步的 Apple 极简风 UI 规范（浅灰底色 `bg-slate-50`，细边框 `border border-slate-100`，圆角 `rounded-lg`，适当内边距 `p-4` 或 `p-5`）。
- **绝对禁止使用 Emoji**，必须引入并使用 `lucide-react` 图标。
- 渲染一个优雅的状态卡片，文案及排版要求如下：
  - **图标**：在标题前使用 `<Database className="w-5 h-5 text-slate-700" />` 或 `Layers` 图标。
  - **主标题**：“创作上下文已自动封装” (设置 `text-slate-800 font-medium`，并与图标垂直居中对齐)。
  - **副标题**：“系统已整合 RAG 检索事实与标杆样文特征，无缝切入初稿创作阶段...” (设置 `text-slate-500 text-sm mt-1 mb-3`)。