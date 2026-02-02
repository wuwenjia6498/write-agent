# 任务：实现基于 Supabase 的 RAG 检索与前端交互卡点

## 1. 背景参考
数据库已初始化成功（包含 Channels, BrandAssets, Materials, Tasks 表）。
当前目标是让 AI 在创作流程中真正调用这些存储在数据库里的“人味素材”。

## 2. 开发核心任务

### A. 实现 Step 5 的向量检索逻辑 (Memory/RAG)
在后端 `Step 5: 风格与素材检索` 节点中，修改逻辑以适配 Supabase：
- **语义搜索**：利用 `personal_materials` 表的 `embedding` 字段，根据当前选题关键词，检索出相关度最高的 3-5 条真实素材。
- **数据隔离**：必须严格按照当前所选的 `channel_id` 进行过滤，防止“深度阅读”频道搜到“绘本”素材。
- **注入 Prompt**：将检索到的金句或案例（如“揉馒头”感悟）作为 `context` 传给下一步的初稿节点。

### B. 实现 Step 3 的前端“物理卡点”交互
根据 `Writing Workbench` UI 截图，实现以下联动：
- **中断逻辑**：后端运行到 S3 选题讨论后，将 `writing_tasks` 表中的状态更新为 `waiting_confirm` 并暂停。
- **前端渲染**：当任务状态为等待确认时，在主区域弹出“选题卡片”，展示 AI 生成的 3-4 个大纲。
- **恢复执行**：用户点击确认后，前端调用 API 更新数据库，并触发后端 Agent 继续执行后续步骤。

### C. Think Aloud 实时持久化
- 将 AI 的每一步思考过程同步写入 `writing_tasks` 表的 `think_aloud_logs` 字段，并实时推送到前端的 Think Aloud 看板。

## 3. 执行要求
- 编码前请输出 **Think Aloud**，说明你如何确保在高并发下（多个同事同时写文章时）保持各自任务的状态独立。
- 请使用 `supabase-js` 处理前端状态订阅。