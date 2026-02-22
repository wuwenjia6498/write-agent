# Role
资深 Python/后端开发工程师

# Task
执行“素材库并入知识库”的第二步重构。清理 `server/services/workflow_engine.py` 中冗余的旧素材库查询逻辑，并融合大模型的提示词 (Prompt)。

# Logic Requirements (代码减法)
1. 找到 `workflow_engine.py` 中负责生成文章初稿的逻辑（通常是 `execute_step_7` 或类似的生成步骤）。
2. **删除**所有调用 `material_service.search_materials`（或查询旧 `Material` 表）的代码。
3. **删除**将 `materials` 组装成 `【真实素材库参考】` 注入给大模型的字符串拼接逻辑。
4. 现在系统仅依赖 `knowledge_service.search_docs` 来获取所有的背景知识（因为 `anecdote` 微素材也存入了知识库）。

# Prompt Update (提示词融合)
1. 在 Step 7 生成文章初稿的 System Prompt 或 User Prompt 中，更新关于“如何使用参考资料”的指令。
2. 明确告诉大模型：
   "提供的【补充参考资料】中，既包含了老约翰的专业理论、课程详案，也可能包含真实的课堂案例/微素材。请在行文中自然融合：以专业理论作为文章的骨架与核心观点，以真实的案例/微素材作为论据来增加文章的温度与可读性。"
3. 继续保持之前的要求：引用任何资料时，统一使用 `[来源X]` 格式。