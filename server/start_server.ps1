# 清除可能冲突的环境变量
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\ANTHROPIC_MODEL -ErrorAction SilentlyContinue

Write-Host "已清除系统环境变量，将使用 .env 文件中的配置" -ForegroundColor Green
Write-Host "启动后端服务..." -ForegroundColor Cyan

# 启动后端
python main.py
