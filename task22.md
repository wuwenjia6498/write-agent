# 任务：单一数据源——解决频道配置与数据库冗余

## 1. 问题背景
| 数据源 | 字段 |
|-------|------|
| 频道配置 JSON | `blocked_phrases`、`channel_specific_rules` |
| 数据库 `channels` 表 | `blocked_phrases`（JSONB）、`channel_rules`（JSONB） |

同一数据存在两个来源，可能产生不一致。

## 2. 统一策略
- **选项 A**（推荐）：JSON 为主，数据库为运行时缓存
- **选项 B**：数据库为主，JSON 仅作初始化种子

## 3. 修改要求
- 明确读取优先级
- 添加数据同步机制或完全移除冗余源