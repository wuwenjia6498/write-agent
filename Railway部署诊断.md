# Railway 后端部署诊断指南

## 📋 快速检查清单

### 1. Railway 部署状态检查

登录 Railway Dashboard：https://railway.app/

检查项目状态：
- [ ] 部署状态是否为 "Active"
- [ ] 最近一次部署是否成功
- [ ] 是否有错误日志

---

## 🔍 常见问题诊断

### 问题 1：Railway 服务未启动

**症状**：
- Railway 显示部署成功，但访问域名返回 503 或超时
- 日志中看不到 "Uvicorn running" 信息

**原因**：
Railway 需要监听 `$PORT` 环境变量指定的端口，而不是硬编码的 8000 端口。

**解决方案**：

#### 检查 `server/main.py` 中的端口配置：

```python
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))  # ← 必须读取 PORT 环境变量
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,  # ← 使用动态端口
        reload=False  # ← 生产环境关闭 reload
    )
```

---

### 问题 2：缺少必要的环境变量

**症状**：
- 日志显示数据库连接失败
- 提示 "DATABASE_URL not found"

**解决方案**：

在 Railway 项目设置中添加所有环境变量：

```env
# 必需的环境变量
DATABASE_URL=postgresql://...（你的 Supabase 连接字符串）
ANTHROPIC_API_KEY=sk-...
ANTHROPIC_BASE_URL=https://aihubmix.com
ANTHROPIC_MODEL=claude-4-5-sonnet
TAVILY_API_KEY=tvly-...

# 可选的环境变量
DB_ECHO=false
ENVIRONMENT=production
```

⚠️ **注意**：不要在 Railway 中设置 `PORT` 变量，Railway 会自动注入。

---

### 问题 3：依赖安装失败

**症状**：
- 部署日志显示 "ModuleNotFoundError"
- 缺少某些 Python 包

**解决方案**：

#### 检查 `server/requirements.txt` 是否完整：

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-dotenv==1.0.0
anthropic==0.7.1
tavily-python==0.3.0
pgvector==0.2.3
pydantic==2.5.0
```

#### 确保 Railway 能找到 requirements.txt：

Railway 会自动检测 Python 项目，但需要确保：
- `requirements.txt` 在**项目根目录**或 `server/` 目录
- Railway 构建命令正确（见下方）

---

### 问题 4：Railway 构建配置错误

**症状**：
- Railway 找不到 Python 项目
- 或者在错误的目录运行

**解决方案**：

在 Railway 项目设置中配置：

#### Settings → Deploy:

- **Root Directory**: `server` ← 如果后端代码在 server 目录
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python main.py`

或者在项目根目录创建 `railway.toml`：

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd server && python main.py"
```

---

### 问题 5：数据库连接超时

**症状**：
- 日志显示 "Connection timeout"
- "Could not connect to database"

**可能原因**：

1. **DATABASE_URL 格式错误**
   
   Supabase Pooler URL 格式：
   ```
   postgresql://postgres.[PROJECT]:PASSWORD@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

2. **Railway 无法访问 Supabase**
   
   检查 Supabase 防火墙设置，确保允许所有 IP 访问（或添加 Railway IP 白名单）

3. **连接池配置问题**
   
   检查 `server/database/config.py` 中的连接超时设置：
   ```python
   connect_args={
       "connect_timeout": 10,
       "keepalives": 1,
       "keepalives_idle": 30,
       "keepalives_interval": 10,
       "keepalives_count": 5
   }
   ```

---

### 问题 6：CORS 配置不正确

**症状**：
- 前端能访问后端 URL，但浏览器报错 "CORS error"
- Network 请求被 blocked

**解决方案**：

检查 `server/main.py` 中的 CORS 配置：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://your-vercel-app.vercel.app",  # ← 添加你的 Vercel 域名
        "https://*.vercel.app"  # ← 允许所有 Vercel 预览域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

或者临时允许所有来源（仅用于测试）：
```python
allow_origins=["*"]
```

---

### 问题 7：前端 API 地址配置错误

**症状**：
- 前端部署成功，但无法连接后端
- Network 请求发送到错误的地址

**解决方案**：

#### 在 Vercel 项目中设置环境变量：

进入 Vercel Dashboard → Settings → Environment Variables

添加：
```env
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
```

⚠️ **注意**：
- Railway 域名格式通常是：`[project-name]-production.up.railway.app`
- 必须以 `NEXT_PUBLIC_` 开头才能在前端访问
- 修改后需要重新部署 Vercel 项目

---

## 🛠️ 诊断步骤

### 步骤 1：检查 Railway 部署日志

1. 进入 Railway Dashboard
2. 点击你的项目
3. 点击 "Deployments" 标签
4. 查看最新部署的日志

**查找关键信息**：
```
✅ 成功：INFO:     Uvicorn running on http://0.0.0.0:XXXX
❌ 失败：ModuleNotFoundError / Connection refused / Timeout
```

### 步骤 2：测试 Railway 后端健康检查

在浏览器或 Postman 中访问：

```
https://your-railway-app.railway.app/
```

**期望返回**：
```json
{
  "status": "ok",
  "message": "老约翰自动化写作AGENT API 运行中",
  "version": "1.0.0"
}
```

### 步骤 3：测试数据库连接

访问：
```
https://your-railway-app.railway.app/health
```

**期望返回**：
```json
{
  "status": "healthy",
  "environment": "production",
  "debug": "false"
}
```

### 步骤 4：测试频道 API

访问：
```
https://your-railway-app.railway.app/api/channels
```

**期望返回**：
```json
[
  {
    "channel_id": "deep_reading",
    "channel_name": "深度阅读小学版",
    ...
  }
]
```

### 步骤 5：检查前端是否正确连接

打开 Vercel 部署的前端，按 F12 打开开发者工具：

1. 进入 "Network" 标签
2. 刷新页面
3. 查看 API 请求

**检查**：
- 请求是否发送到正确的 Railway 域名
- 状态码是否为 200
- 是否有 CORS 错误

---

## 🔧 快速修复脚本

### 修复 1：更新 main.py 支持 Railway 动态端口

```python
# server/main.py 底部修改为：

if __name__ == "__main__":
    import uvicorn
    import os
    
    port = int(os.getenv("PORT", 8000))
    
    print(f"[INFO] 启动服务在端口: {port}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
```

### 修复 2：创建 railway.toml 配置文件

在项目根目录创建：

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd server && python main.py"
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 10
```

### 修复 3：添加健康检查端点

确保 `main.py` 中有：

```python
@app.get("/health")
async def health_check():
    try:
        # 测试数据库连接
        from services.db_service import db_service
        db_service.get_all_channels()
        
        return {
            "status": "healthy",
            "database": "connected",
            "environment": os.getenv("ENVIRONMENT", "production")
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

---

## 📞 需要提供的信息

如果问题仍未解决，请提供以下信息：

1. **Railway 部署日志**（最后 50 行）
2. **Railway 域名**（例如：`xxx.railway.app`）
3. **访问根路径的返回结果**（或错误信息）
4. **Railway 环境变量截图**（隐藏敏感信息）
5. **Vercel 前端环境变量截图**

---

## ✅ 检查清单总结

部署前确认：

- [ ] `main.py` 使用了 `os.getenv("PORT", 8000)`
- [ ] Railway 已配置所有必需的环境变量
- [ ] `requirements.txt` 在正确位置且完整
- [ ] Railway Start Command 设置正确
- [ ] CORS 配置包含 Vercel 域名
- [ ] Vercel 设置了 `NEXT_PUBLIC_API_URL` 环境变量
- [ ] Supabase 允许 Railway IP 访问
- [ ] Railway 部署日志显示 "Uvicorn running"

---

**下一步**：告诉我你的 Railway 部署日志或遇到的具体错误，我可以帮你精准定位问题！
