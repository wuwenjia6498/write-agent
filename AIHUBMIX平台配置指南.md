# 🔌 AIHUBMIX平台配置指南

## 📋 配置说明

根据 [AIHubMix 官方文档](https://docs.aihubmix.com/cn)，平台提供 **Claude 兼容（Beta）** 接口，可以通过 Anthropic API 格式调用所有模型。

**优势：**
- ✅ 兼容 Anthropic SDK，代码零改动
- ✅ 统一接口，极简迁移
- ✅ 支持数百个模型

---

## ⚙️ 环境变量配置

在 `server` 目录下创建或编辑 `.env` 文件：

```env
# AIHUBMIX Claude 兼容接口配置
ANTHROPIC_API_KEY=your_aihubmix_api_key_here
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1/claude
ANTHROPIC_MODEL=claude-sonnet-4-5

# 应用配置
ENVIRONMENT=development
DEBUG=true
```

> **📌 注意：** 根据官方文档，Claude 兼容接口的 Base URL 应该是 `https://api.aihubmix.com/v1/claude`

### 配置项说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | AIHUBMIX提供的API Key | `sk-xxx...` 或平台提供的格式 |
| `ANTHROPIC_BASE_URL` | AIHUBMIX的API地址 | `https://api.aihubmix.com/v1` |
| `ANTHROPIC_MODEL` | 模型名称 | `claude-sonnet-4-5` |

---

## 🔍 获取AIHUBMIX配置信息

### 1. API Key
- 登录 AIHUBMIX 平台
- 进入"API密钥"或"设置"页面
- 复制您的API Key

### 2. API Base URL
根据 [AIHubMix 官方文档](https://docs.aihubmix.com/cn)，Claude 兼容接口的地址为：

**推荐配置：**
```
https://api.aihubmix.com/v1/claude
```

**说明：**
- AIHubMix 支持多种兼容格式（OpenAI、Claude、Gemini）
- 我们使用的是 Claude 兼容（Beta）接口
- 该接口兼容 Anthropic SDK，无需修改代码

### 3. 模型名称
AIHubMix 支持通过统一接口访问数百个模型。对于 Claude 模型，常见名称：
- `claude-sonnet-4-5` （您提到的版本）
- `claude-3-5-sonnet-20241022` （官方标准名称）
- `claude-3-opus`
- 其他 Claude 系列模型

**建议：**
- 先使用 `claude-sonnet-4-5` 测试
- 如果不工作，尝试 `claude-3-5-sonnet-20241022`
- 查看 [AIHubMix 文档](https://docs.aihubmix.com/cn) 获取最新模型列表

---

## 🚀 完整配置步骤

### 步骤 1：创建配置文件

在 `server` 目录手动创建 `.env` 文件：

**Windows PowerShell:**
```powershell
cd server
New-Item -Path .env -ItemType File -Force
```

**或直接在IDE中创建**
- 右键 `server` 文件夹
- 新建文件 → `.env`

### 步骤 2：填写配置内容

复制以下内容到 `.env` 文件，并替换为您的实际信息：

```env
# ===== AIHUBMIX Claude 兼容接口配置 =====
# 官方文档: https://docs.aihubmix.com/cn

# 您的API Key（必需）
# 从 AIHubMix 平台获取: https://aihubmix.com
ANTHROPIC_API_KEY=请替换为您的AIHUBMIX_API_Key

# Claude 兼容接口地址（必需）
# 根据官方文档，使用 Claude 兼容（Beta）接口
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1/claude

# 模型名称（必需）
# 支持 Claude 系列所有模型
ANTHROPIC_MODEL=claude-sonnet-4-5

# ===== 应用配置 =====
ENVIRONMENT=development
DEBUG=true
```

**配置说明：**
- AIHubMix 提供 [Claude 兼容（Beta）接口](https://docs.aihubmix.com/cn)
- 兼容 Anthropic SDK，我们的代码无需修改
- 统一接口，可访问数百个模型

### 步骤 3：验证配置

保存文件后，重启后端服务：

```bash
# 停止当前后端服务（在9号终端按 Ctrl+C）

# 重新启动
cd server
.\venv\Scripts\python.exe main.py
```

**成功标志：**
启动时会显示：
```
INFO: Using custom API base URL: https://api.aihubmix.com/v1
INFO: Uvicorn running on http://0.0.0.0:8000
```

---

## ✅ 测试配置

### 方法1：通过Web界面测试

1. 访问：http://localhost:3000/workbench
2. 选择频道：深度阅读
3. 输入测试需求：
   ```
   帮我写一篇关于《夏洛的网》的阅读指导文章
   ```
4. 点击"启动创作流程"
5. 观察AI是否正常响应

### 方法2：通过API文档测试

1. 访问：http://localhost:8000/docs
2. 找到 `POST /api/workflow/create`
3. 点击"Try it out"
4. 填写测试数据并执行

---

## 🔧 常见问题

### Q1: 提示"unauthorized"或"invalid API key"
**原因：** API Key配置错误

**解决方案：**
1. 检查`.env`文件中的API Key是否正确
2. 确认Key没有多余的空格或换行
3. 验证Key是否有效（登录AIHUBMIX平台查看）

### Q2: 提示"connection refused"或"timeout"
**原因：** API Base URL配置错误

**解决方案：**
1. 检查`ANTHROPIC_BASE_URL`是否正确
2. 确认URL格式（通常以`/v1`结尾）
3. 测试URL是否可访问（浏览器打开试试）

### Q3: 提示"model not found"
**原因：** 模型名称不匹配

**解决方案：**
1. 查看AIHUBMIX文档确认准确的模型名称
2. 常见的可能名称：
   - `claude-sonnet-4-5`
   - `claude-3.5-sonnet`
   - `claude-3-5-sonnet-20241022`
3. 更新`.env`中的`ANTHROPIC_MODEL`

### Q4: 代码中如何修改默认超时时间？

如果AIHUBMIX响应较慢，可以调整超时设置：

编辑 `server/services/ai_service.py`，在创建client时添加：

```python
from anthropic import AsyncAnthropic
import httpx

self.client = AsyncAnthropic(
    api_key=api_key,
    base_url=base_url,
    timeout=httpx.Timeout(60.0, connect=10.0)  # 60秒总超时，10秒连接超时
)
```

---

## 📊 AIHUBMIX vs Anthropic官方差异

| 项目 | Anthropic官方 | AIHUBMIX |
|------|--------------|----------|
| API地址 | `https://api.anthropic.com` | 自定义（需配置） |
| 认证方式 | API Key | API Key |
| 模型名称 | 官方标准名称 | 可能有平台自定义名称 |
| 请求格式 | 标准Anthropic格式 | 通常兼容 |
| 响应格式 | 标准Anthropic格式 | 通常兼容 |
| 价格 | 官方定价 | 平台定价（可能不同） |

---

## 💡 推荐配置模板

### 开发环境（`server/.env`）
```env
# AIHUBMIX配置
ANTHROPIC_API_KEY=your_aihubmix_key
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1
ANTHROPIC_MODEL=claude-sonnet-4-5

# 调试配置
ENVIRONMENT=development
DEBUG=true

# 可选：降低token消耗
MAX_TOKENS=4096
```

### 生产环境
```env
# AIHUBMIX配置
ANTHROPIC_API_KEY=${SECRET_API_KEY}
ANTHROPIC_BASE_URL=https://api.aihubmix.com/v1
ANTHROPIC_MODEL=claude-sonnet-4-5

# 生产配置
ENVIRONMENT=production
DEBUG=false
```

---

## 📞 获取帮助

### AIHUBMIX平台
- 查看平台文档了解API详情
- 联系平台客服获取技术支持

### 项目相关
- 查看 `AI功能使用指南.md`
- 查看 `SETUP.md`
- 查看后端日志：`server`目录终端输出

---

## ✨ 配置完成后

配置成功后，您可以：

1. ✅ 使用完整的9步AI工作流
2. ✅ 体验三个频道的不同人格
3. ✅ 观察Think Aloud思考过程
4. ✅ 使用全局屏蔽词过滤
5. ✅ 自动化三遍审校机制

---

**🎉 祝您配置顺利！开始使用AIHUBMIX平台创作高质量内容吧！**

