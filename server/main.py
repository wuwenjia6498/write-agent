"""
老约翰自动化写作AGENT - 后端主入口
FastAPI + LangGraph 驱动的智能写作系统
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

# 创建 FastAPI 应用
app = FastAPI(
    title="老约翰自动化写作AGENT",
    description="基于AI的品牌内容创作平台 - 两层判断 + 9步SOP",
    version="1.0.0"
)

# CORS 配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 根路由 - 健康检查
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "老约翰自动化写作AGENT API 运行中",
        "version": "1.0.0"
    }

# 健康检查路由
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "debug": os.getenv("DEBUG", "false")
    }

# 导入路由模块
from routes import channels, workflow, materials

# 注册路由
app.include_router(channels.router, prefix="/api/channels", tags=["频道管理"])
app.include_router(workflow.router, prefix="/api/workflow", tags=["工作流"])
app.include_router(materials.router, prefix="/api/materials", tags=["素材管理"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

