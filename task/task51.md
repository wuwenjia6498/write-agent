# Role
资深 Python/Prompt 工程师

# Task
优化 `server/services/workflow_engine.py` 中的提示词组装逻辑。将频道配置中的“频道规则”（必须遵守 `rules_obey` / 严格禁止 `rules_prohibit`）强制注入到 Step 7（初稿创作）和 Step 8（四遍审校）的 System Prompt 中。

# Logic Requirements (后端注入逻辑)

1. **获取频道配置**：
   在 `execute_step_7` 和 `execute_step_8` 函数的开头，确保通过 `channel_scope` 获取到了当前频道的完整配置数据（如调用类似 `channel_service.get_channel_config(task.channel_scope)` 的方法）。

2. **组装规则字符串**：
   提取频道配置中的“必须遵守”和“严格禁止”字段。如果字段有内容，将其格式化为以下结构的字符串 `channel_rules_prompt`：
   ```text
   【频道专属内容铁律】
   你在创作/审校时，必须严格遵守以下原则：
   {rules_obey}

   你绝对禁止出现以下情况：
   {rules_prohibit}

3. **更新 Step 7 (初稿创作) Prompt**  
   - 将组装好的 `channel_rules_prompt` 强制追加到 Step 7 发送给大模型的 System Prompt/主提示词，可放在“创作要求”板块的开头或结尾，确保 AI 在生成初稿时第一时间知晓并遵守。

4. **更新 Step 8 (四遍审校) Prompt**  
   - 在 Step 8 的 System Prompt/审校逻辑主提示词中，同样插入 `channel_rules_prompt`。  
   - 额外增加一句警告：  
     > “请作为严厉的审核员，逐句检查文章是否违反了上述【绝对禁止】的事项，如果发现，必须彻底改写。”

5. **容错处理**  
   - 若频道的规则字段（如 `rules_obey` 或 `rules_prohibit`）为空，组装 prompt 时自动忽略该部分，不输出空模板或占位符内容。