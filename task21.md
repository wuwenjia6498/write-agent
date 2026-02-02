# 任务：字段命名统一——消除 Step 5 ↔ Step 7 的字段歧义

## 1. 问题背景
| Step 5 输出 | Step 7 读取 | 问题 |
|------------|------------|------|
| `recommended_sample` | `selected_sample` | 命名不一致 |
| `style_profile` | `custom_style_profile` or `style_profile` | 歧义 |

## 2. 统一命名规范
| 旧命名 | 统一为 | 说明 |
|-------|-------|------|
| `recommended_sample` | `selected_sample` | AI 推荐 + 用户确认 |
| `custom_style_profile` | `user_style_profile` | 用户自定义配置 |
| `style_profile` (通用) | `effective_style_profile` | 最终生效的风格 |

## 3. 修改范围
- `workflow_engine.py`: Step 5、Step 7
- `workflow.py`: 路由层数据传递
- 前端：确保字段映射一致