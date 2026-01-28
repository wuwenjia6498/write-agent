# -*- coding: utf-8 -*-
"""
数据库配置模块
提供 PostgreSQL + pgvector 的连接配置
"""

import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


def get_database_url() -> str:
    """
    获取数据库连接 URL
    支持从环境变量读取，或使用默认的本地开发配置
    
    Returns:
        str: PostgreSQL 数据库连接字符串
    """
    # 优先从环境变量读取完整 URL
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        # Supabase 等云服务可能提供带 postgres:// 的 URL，需要转换为 postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return database_url
    
    # 否则从单独的环境变量组装
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "old_john_writing")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


# 创建数据库引擎
# pool_pre_ping=True 确保连接在使用前是有效的
engine = create_engine(
    get_database_url(),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=os.getenv("DB_ECHO", "false").lower() == "true"  # 调试时打印 SQL
)

# 创建会话工厂
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话的依赖注入函数
    用于 FastAPI 的 Depends()
    
    Yields:
        Session: SQLAlchemy 数据库会话
    
    Example:
        @app.get("/items")
        async def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

