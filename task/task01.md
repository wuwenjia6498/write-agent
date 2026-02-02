# 任务：初始化“老约翰自动化写作AGENT”核心骨架

## 1. 资源对齐
请深度阅读根目录下的 `README.md`（定义 9 步 SOP 逻辑）和 `PRD.md`（定义 Web 架构）。
- 注意：README 中定义的“两层判断”和“9 步流程”是系统的灵魂，必须严格在代码逻辑中体现。

## 2. 第一阶段开发要求

### A. 物理结构与配置化 (Backend)
- **目录初始化**：按照 README 结构创建 `/server/configs/channels/`，并预设 `deep_reading.json` (深度阅读)、`picture_books.json` (绘本阅读)、`parenting.json` (育儿) 三个配置文件。
- **路由逻辑**：在 `app/api/channels` 下建立后端路由，使其能动态返回对应频道的 System Prompt 和样文路径。
- **屏蔽词预装**：将 `image_f21575.png` 中的违禁词逻辑（如禁止“在当今...时代”、逻辑结构词优化等）写入全局审校逻辑中。

### B. 工作流状态管理 (State Machine)
- 实现一个后端状态追踪器，确保 AI 严格按顺序执行：需求 -> 调研 -> 选题讨论(卡点) -> 创作 -> 三遍审校。

### C. 前端看板渲染 (Frontend)
- 在 `/app/workbench` 下创建主界面，引入 `WorkflowProgress` 组件，实时展示 9 个 Step 的当前状态。
- 必须包含一个侧边栏用于展示 AI 的 **Think Aloud** 思考过程。

## 3. 互动规范
- 编码前请输出 Think Aloud，说明你准备如何将 15 年的品牌资产（素材库）与这三个频道进行逻辑关联。