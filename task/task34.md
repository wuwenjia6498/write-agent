# Role
资深 Python 后端工程师 / AI Agent 架构师

# Task
优化 `server/services/workflow_engine.py` 中的 `execute_step_2` (信息搜索)。目前直接将用户的 `task_topic` 传给 Tavily 会导致搜索结果极度发散和不相关。

# Logic Requirements
1. 在调用 Tavily 搜索之前，增加一个轻量级的 LLM 调用（Query Rewriting）。
2. 让 LLM 根据用户的 `task_topic` 和当前的 `channel_id` (如 deep_reading)，提炼出 1-2 个**高度精准、适合搜索引擎的关键词组合**。
3. Prompt 示例思路：
   "用户输入的主题是：{task_topic}。请将其转化为1到2个适合在 Google/Bing 搜索的精准关键词短语，去除口语化词汇，提取核心教育概念（如：'三年级 整本书阅读 专注力'）。仅返回关键词，以逗号分隔。"
4. 将 LLM 返回的精准关键词传递给 Tavily 进行搜索，而不是直接传递原始的长句 `task_topic`。
5. 依然保留上一步增加的“将内部知识库结果合并到搜索来源列表”的功能。

# Constraint
保证代码的健壮性。如果 Query Rewriting 这一步 LLM 调用失败，则降级 (Fallback) 使用原始的 `task_topic` 进行搜索，确保工作流不会因此中断。