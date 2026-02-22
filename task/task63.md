# Role
资深 Prompt 架构师


# Role
资深 Prompt 架构师

# Task
微调 `server/services/workflow_engine.py` 中的 `execute_step_7` (初稿创作) 方法。在组装 `user_message` 的末尾（最高军规部分），补齐之前重构时遗漏的【频道专属规则】（channel_rules），确保大模型在动笔前不仅牢记全局纪律，也能死死守住频道的调性底线。

# Requirements

## 1. 提取频道规则变量
在 `execute_step_7` 方法中，找到准备拼接 `user_message = f"""...` 的代码位置（约 709 行之上）。在它前面加上这一行，把频道规则提前准备好：

```python
        # 获取频道专属规则
        channel_rules = self._build_channel_rules_prompt(channel_config)

2. 注入 User Message 末尾
在 user_message 的多行字符串模板最末尾，找到第 4 点“【严禁凭空捏造】”的位置。在它下方、最终输出指令的上方，插入 {channel_rules} 变量。修改后的末尾结构必须如下所示：

4. **【严禁凭空捏造】**：所有案例、故事、数据必须来自上方的参考资料，绝不允许编造。如果资料不够，请简化论述。

{channel_rules}

确认已牢记上述军规及频道铁律，请直接输出纯净的文章初稿：
"""