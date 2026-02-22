# Role
资深 Python 后端工程师

# Task
优化 `server/services/workflow_engine.py` 中的 `execute_step_2` (信息搜索与知识管理) 方法，将内部知识库的来源显示在前台的参考来源列表中。

# Logic Requirements
1. 在 `execute_step_2` 中，当调用 `knowledge_service.search_docs` 获取到内部资料（chunks）后，提取出这些 chunk 的唯一来源文件名（`source_filename`）。
2. 将这些内部文件来源，格式化为与 Tavily 搜索结果相同的字典结构。例如：
   ```python
   internal_source = {
       "title": f"[老约翰内部知识库] {filename}",
       "url": "internal_database",
       "content": "内部专家指导资料" # 或具体的 snippet
   }

3. 将提取到的 internal_source 条目（每个来源文件一个）统一插入到最终返回给前端的搜索结果列表（search_results）**数组的最前面**，确保优先展示于外部（Tavily）网络检索结果之前。

4. 在构建用于 AI 生成“调研摘要”的 Prompt 时，需加入明确指令：“在列出参考来源时，请务必将带有 [老约翰内部知识库] 前缀的文件来源同步列入来源清单”。

约束：
仅优化 Step 2 中数据组装的流程与 Prompt 逻辑，不更改原有工作流状态机结构；保证前端无需感知即可正常渲染内部资料的来源信息。