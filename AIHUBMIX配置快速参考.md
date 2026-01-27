# 🚀 AIHubMix 配置快速参考

> **官方文档：** https://docs.aihubmix.com/cn

---

## ⚡ 快速配置（3步完成）

### 1️⃣ 获取 API Key
访问 [AIHubMix 平台](https://aihubmix.com) 获取您的 API Key

### 2️⃣ 创建配置文件
在 `server` 目录创建 `.env` 文件：

```env
ANTHROPIC_API_KEY=your-aihubmix-key
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1/claude
ANTHROPIC_MODEL=claude-sonnet-4-5
ENVIRONMENT=development
DEBUG=true
```

### 3️⃣ 重启后端
```bash
cd server
.\venv\Scripts\python.exe main.py
```

✅ 看到 `INFO: Using custom API base URL: https://api.aihubmix.com/v1/claude` 即配置成功！

---

## 📋 完整配置模板

```env
# AIHubMix Claude 兼容接口配置
# 文档: https://docs.aihubmix.com/cn

ANTHROPIC_API_KEY=your-aihubmix-key
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1/claude
ANTHROPIC_MODEL=claude-sonnet-4-5

ENVIRONMENT=development
DEBUG=true
```

---

## 🎯 关键信息

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **API Key** | 从 AIHubMix 平台获取 | `sk-xxx...` |
| **Base URL** | Claude 兼容接口地址 | `https://api.aihubmix.com/v1/claude` |
| **Model** | 模型名称 | `claude-sonnet-4-5` |

---

## 💡 为什么选择 AIHubMix？

根据 [官方文档](https://docs.aihubmix.com/cn)：

- ✅ **统一接口**：兼容 OpenAI SDK，代码零改动
- ✅ **Claude 兼容**：支持 Anthropic API 格式
- ✅ **多模型支持**：访问数百个模型
- ✅ **灵活计费**：按量付费，无会员、无包月

---

## 🔍 验证配置

### 方法1：检查启动日志
```
INFO: Using custom API base URL: https://api.aihubmix.com/v1/claude
```

### 方法2：测试 API
访问：http://localhost:3000/workbench
- 选择频道：深度阅读
- 输入测试需求
- 启动工作流

---

## ⚠️ 常见问题

### Q: 提示 "unauthorized"
**A:** 检查 API Key 是否正确，确认在 AIHubMix 平台有效

### Q: 提示 "model not found"
**A:** 尝试以下模型名称：
- `claude-sonnet-4-5`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-sonnet`

### Q: 连接超时
**A:** 
1. 检查 Base URL 是否为 `https://api.aihubmix.com/v1/claude`
2. 确认网络可以访问 AIHubMix
3. 查看防火墙设置

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [AIHubMix 官方文档](https://docs.aihubmix.com/cn) | 平台完整文档 |
| [快速入门指南](https://docs.aihubmix.com/cn/quick-start) | AIHubMix 快速开始 |
| `AIHUBMIX平台配置指南.md` | 详细配置说明（本项目） |
| `AI功能使用指南.md` | AI 功能使用教程 |

---

## 🎊 配置完成后

您可以：
- ✅ 使用 AIHubMix 的 Claude 模型
- ✅ 完整的 9 步 AI 创作工作流
- ✅ 三个频道的不同 AI 人格
- ✅ 自动屏蔽词过滤
- ✅ Think Aloud 思考过程

**立即体验：** http://localhost:3000/workbench

---

## 💰 成本优势

AIHubMix 提供：
- 按量付费，成本与业务同步增长
- 无会员费、无包月费
- 灵活的计费方式

**参考：** 单篇文章约 $0.15-0.30（取决于字数和模型）

---

**🚀 开始使用 AIHubMix 创作高质量内容吧！**

