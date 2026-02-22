# Role
后端研发工程师

# Task
修复 `/api/ai/inline-rewrite` 路由中的两个逻辑漏洞：1. 全局禁用书单未注入；2. 缺乏防幻觉和逻辑自洽指令。

# Action (修改 `server/routes/ai_rewrite.py` 或对应的后端文件)

## 1. 补齐全局写作约束 (Banned Books)
在组装 Prompt 之前，调用 `workflow_engine.load_writing_constraints()` 获取全局写作约束，并提取禁用书单（`banned_books_list`）。

## 2. 升级 System Prompt 模板
更新 `inline-rewrite` 接口中调用大模型的 System Prompt，在【最高红线】部分增加防禁书和逻辑自洽的强力约束。修改后的核心 Prompt 模板应包含如下逻辑：

"""
【用户要求】：{user_instruction}
【需要修改的原文】：{selected_text}
【原文所在的上下文】：{surrounding_context}

【全局与频道纪律】：
1. 频道底线：{channel_rules_prompt}
2. 全局禁书（绝对不可使用）：{banned_books_list}

【最高红线】：
1. 你只能输出重写后的文本，绝不输出多余废话。输出长度应与原文本体量相当。
2. **防禁书机制**：即便用户要求换书，也绝对禁止使用上述【全局禁书】名单中的书目。
3. **完美缝合机制**：确保你输出的文本能丝滑嵌回上下文。如果用户的要求会导致原文与上下文（如主人公名字、情节）产生逻辑冲突，请在满足用户要求的前提下，聪明地泛化或调整你输出的这部分措辞，尽最大努力保持整体逻辑的连贯。
"""