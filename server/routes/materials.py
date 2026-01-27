"""
素材管理路由
负责品牌素材库的管理和检索
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

class Material(BaseModel):
    """素材模型"""
    material_id: str
    title: str
    content: str
    tags: List[str]
    channel_ids: List[str]  # 适用的频道
    source: str  # 素材来源
    created_at: datetime

class BlockedWord(BaseModel):
    """屏蔽词模型"""
    phrase: str
    category: str
    reason: str
    replacement: str

# 内存存储（实际应用应使用向量数据库）
materials_db: List[Material] = []

@router.get("/blocked-words")
async def get_blocked_words() -> List[BlockedWord]:
    """
    获取全局屏蔽词库
    """
    import json
    from pathlib import Path
    
    config_file = Path(__file__).parent.parent / "configs" / "global" / "blocked_words.json"
    
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        blocked_words = []
        for category_id, category_data in config["categories"].items():
            for pattern in category_data["patterns"]:
                blocked_words.append(BlockedWord(
                    phrase=pattern["phrase"],
                    category=category_data["name"],
                    reason=pattern["reason"],
                    replacement=pattern["replacement"]
                ))
        
        return blocked_words
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"加载屏蔽词库失败: {str(e)}"
        )

@router.post("/search")
async def search_materials(
    keywords: List[str],
    channel_id: Optional[str] = None
) -> List[Material]:
    """
    根据关键词搜索素材
    
    Args:
        keywords: 搜索关键词列表
        channel_id: 限定频道ID（可选）
    
    Returns:
        匹配的素材列表
    """
    # 简单的关键词匹配（实际应用应使用向量检索）
    results = []
    
    for material in materials_db:
        # 频道过滤
        if channel_id and channel_id not in material.channel_ids:
            continue
        
        # 关键词匹配
        content_lower = material.content.lower()
        title_lower = material.title.lower()
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in content_lower or keyword_lower in title_lower:
                results.append(material)
                break
    
    return results

@router.post("/")
async def create_material(material: Material) -> Material:
    """
    创建新素材
    """
    materials_db.append(material)
    return material

@router.get("/")
async def list_materials(
    channel_id: Optional[str] = None,
    tag: Optional[str] = None
) -> List[Material]:
    """
    获取素材列表
    
    Args:
        channel_id: 按频道筛选
        tag: 按标签筛选
    """
    results = materials_db
    
    if channel_id:
        results = [m for m in results if channel_id in m.channel_ids]
    
    if tag:
        results = [m for m in results if tag in m.tags]
    
    return results

