# Role
全栈开发工程师

# Task
优化工作台 Step 5 (风格建模) 的历史展示 UI。虽然该步骤已实现自动流转（无需用户操作），但目前的 UI 过于空洞（仅有一句“自动锁定样文风格”），缺乏系统透明度。

# Logic & UI Requirements
1. **后端状态记录 (`server/services/workflow_engine.py`)**：
   - 确保在执行 Step 5（或为 Step 7 抽取样文）时，将本次随机抽中的 1 到 2 篇样文的**标题 (Titles)** 保存到当前 task 的上下文中（如 `brief_data['selected_samples']`）。
2. **前端信息展示 (`app/workbench/page.tsx` 中渲染 Step 5 的区块)**：
   - 读取后端保存的 `selected_samples` 数据。
   - 将原来干巴巴的“自动锁定样文风格”替换为一个具有设计感的反馈卡片（可使用浅绿色或浅蓝色背景的 Alert / Callout 样式）。
   - **文案结构**：
     - **主标题**：✅ 风格基调已自动锁定
     - **副文本**：AI 已从样文库中自动抽取了以下标杆文章，接下来的创作将严格复刻它们的排版格式与语气节奏：
     - **列表**：以 `<li>` 或小 Badge 的形式，展示抽中的《样文标题1》、《样文标题2》。