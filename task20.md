# 任务：配置文件规范化——抽取硬编码规则

## 1. 问题背景
禁用书目等规则仍以硬编码形式散落在 `workflow_engine.py` 中，维护成本高。

## 2. 修改要求

### A. 创建全局约束配置文件
创建 `server/configs/global/writing_constraints.json`：
- `banned_books`: 禁用书目列表
- `word_count_default`: 默认字数
- `word_count_tolerance`: 字数偏差容忍度（0.1 = ±10%）
- `max_sentence_length`: 40
- `max_paragraph_length`: 200
- `style_dna_pass_threshold`: 0.8

### B. 修改 workflow_engine.py
- 移除 Step 3、Step 7、Step 8 中的硬编码禁用书目
- 改为从配置文件加载

## 3. 验证要求
- 修改 `writing_constraints.json` 中的禁用书目后，无需改代码即可生效