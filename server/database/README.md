# 数据库模块说明

## 📦 技术栈
- **ORM**: SQLAlchemy 2.0
- **数据库**: PostgreSQL + pgvector
- **向量维度**: 1536 (兼容 OpenAI embeddings)

## 📋 核心表结构

| 表名 | 说明 | 主要用途 |
|------|------|----------|
| `channels` | 内容频道表 | 管理深度阅读、绘本、育儿等频道配置 |
| `brand_assets` | 品牌全局资产表 | 存储品牌灵魂资料 (Key-Value 结构) |
| `personal_materials` | 个人素材库 | RAG 核心表，支持向量检索 |
| `writing_tasks` | 写作任务流表 | 记录 9 步 SOP 全过程状态 |

## 🚀 快速开始

### 1. 安装依赖
```bash
cd server
pip install -r requirements.txt
```

### 2. 配置数据库连接
在 `.env` 文件中设置：
```env
# 方式一：完整 URL (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# 方式二：分别配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=old_john_writing
DB_USER=postgres
DB_PASSWORD=postgres
```

### 3. 初始化数据库
```bash
cd server
python -m database.init_db
```

## 📝 使用示例

### 在 FastAPI 路由中使用
```python
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db, crud

@app.get("/channels")
async def get_channels(db: Session = Depends(get_db)):
    return crud.get_all_channels(db)
```

### 素材向量检索 (S5 步骤)
```python
from database import crud

# 带频道过滤的向量检索
materials = crud.search_materials_by_embedding(
    db=db,
    channel_id=channel_id,     # 必须指定频道
    query_embedding=embedding,  # 1536 维向量
    top_k=5,
    include_global=True        # 包含全频道通用素材
)
```

### 获取屏蔽词库 (S8 步骤)
```python
blocking_words = crud.get_blocking_words(db)
```

## ⚠️ 数据隔离规则

**关键约束**：检索素材时必须带 `channel_id` 过滤，严禁跨频道污染。

```python
# ✅ 正确：带频道过滤
materials = crud.get_materials_by_channel(db, channel_id=channel_id)

# ❌ 错误：不带频道过滤（函数设计上已强制要求 channel_id）
```

## 📁 文件结构
```
server/database/
├── __init__.py      # 模块导出
├── config.py        # 数据库配置和连接
├── models.py        # SQLAlchemy 模型定义
├── crud.py          # CRUD 操作封装
├── init_db.py       # 初始化和迁移脚本
├── schema.sql       # 纯 SQL Schema (可直接在 PostgreSQL 执行)
└── README.md        # 本文档
```

