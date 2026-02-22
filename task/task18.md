# 任务：打通事实地基——将 Step 2 调研摘要注入 Step 7 创作引擎

## 1. 问题背景
根据逻辑审计发现，目前 Step 2 生成的 `knowledge_base_data` 和 `knowledge_summary` 字段在后续环节利用率为 0。AI 在 Step 7 创作初稿时完全没有参考这些专业调研事实。

## 2. 后端逻辑修改要求

### A. 修改 `server/services/workflow_engine.py`
- **更新函数签名**：修改 `execute_step_7` 方法，新增 `knowledge_summary: str = ""` 参数。
- **注入 Prompt**：在组装 Step 7 的 `user_message` 时，在“选题”上方新增一个【## 调研背景】板块，并注入 `knowledge_summary` 的内容。
- **强化约束**：在 Prompt 中明确要求 AI：“请结合下方的‘调研背景’进行创作，确保文章的专业论据与调研结论保持一致”。

### B. 修改 `server/routes/workflow.py`
- **数据获取**：在调用 `execute_step_7` 之前的逻辑中，从数据库 `writing_tasks` 表中读取当前任务的 `knowledge_summary` 字段。
- **参数传递**：确保在路由层调用 `workflow_engine.execute_step_7` 时，正确传入该摘要数据。

## 3. 验证要求
- **数据流转测试**：确认 Step 7 生成的 Prompt（可通过日志查看）中已包含 Step 2 的调研摘要内容。
- **内容验证**：生成的初稿应能体现调研资料中的核心观点（例如：如果调研提到了“布鲁姆分类法”，初稿应有相应体现）。

## 4. Think Aloud
- 请先说明你打算如何处理 `knowledge_summary` 为空时的兼容逻辑（例如：是跳过注入，还是提醒用户先完成调研？）。