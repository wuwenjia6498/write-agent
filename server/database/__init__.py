# -*- coding: utf-8 -*-
"""
数据库模块
提供数据库连接、模型定义和会话管理
"""

from .config import get_database_url, engine, SessionLocal, get_db
from .models import Base, Channel, BrandAsset, PersonalMaterial, WritingTask, StyleSample
from . import crud

__all__ = [
    # 配置和连接
    "get_database_url",
    "engine", 
    "SessionLocal",
    "get_db",
    # 模型
    "Base",
    "Channel",
    "BrandAsset", 
    "PersonalMaterial",
    "WritingTask",
    "StyleSample",  # v3.5 新增
    # CRUD 操作
    "crud"
]

