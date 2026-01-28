"""
素材管理路由
负责品牌素材库的管理和检索，支持数据库持久化
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from services.db_service import db_service

router = APIRouter()


class MaterialCreate(BaseModel):
    """创建素材请求"""
    content: str
    material_type: str  # 金句/案例/反馈/感悟/其他
    channel_slug: Optional[str] = None  # 归属频道，None 为全局
    tags: Optional[List[str]] = []
    source: Optional[str] = None


class MaterialResponse(BaseModel):
    """素材响应"""
    id: str
    content: str
    material_type: str
    channel_id: Optional[str]
    channel_slug: Optional[str]
    tags: List[str]
    source: Optional[str]
    created_at: Optional[str]


class BlockedWord(BaseModel):
    """屏蔽词模型"""
    phrase: str
    category: str
    reason: str
    replacement: str


@router.get("/blocked-words")
async def get_blocked_words() -> List[BlockedWord]:
    """获取全局屏蔽词库"""
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


@router.get("/")
async def list_materials(
    channel: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
) -> List[MaterialResponse]:
    """
    获取素材列表
    
    Args:
        channel: 按频道筛选 (slug)
        type: 按类型筛选 (金句/案例/反馈/感悟/其他)
        search: 关键词搜索
        limit: 返回数量限制
    """
    materials = db_service.get_all_materials(
        channel_slug=channel,
        material_type=type,
        search=search,
        limit=limit
    )
    
    return [
        MaterialResponse(
            id=m["id"],
            content=m["content"],
            material_type=m["material_type"],
            channel_id=m.get("channel_id"),
            channel_slug=m.get("channel_slug"),
            tags=m.get("tags", []),
            source=m.get("source"),
            created_at=m.get("created_at")
        )
        for m in materials
    ]


@router.post("/")
async def create_material(request: MaterialCreate) -> MaterialResponse:
    """
    创建新素材
    
    注意：创建后需要调用 embedding 接口生成向量
    """
    try:
        material = db_service.create_material(
            content=request.content,
            material_type=request.material_type,
            channel_slug=request.channel_slug,
            tags=request.tags,
            source=request.source
        )
        
        return MaterialResponse(
            id=material["id"],
            content=material["content"],
            material_type=material["material_type"],
            channel_id=material.get("channel_id"),
            channel_slug=material.get("channel_slug"),
            tags=material.get("tags", []),
            source=material.get("source"),
            created_at=material.get("created_at")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{material_id}")
async def delete_material(material_id: str):
    """删除素材"""
    success = db_service.delete_material(material_id)
    if not success:
        raise HTTPException(status_code=404, detail="素材不存在")
    return {"success": True, "message": "素材已删除"}


@router.post("/search")
async def search_materials(
    keywords: List[str],
    channel_slug: Optional[str] = None,
    limit: int = 10
) -> List[MaterialResponse]:
    """
    根据关键词搜索素材
    """
    # 获取频道 ID
    channel_id = None
    if channel_slug:
        channel = db_service.get_channel_by_slug(channel_slug)
        if channel:
            channel_id = channel["id"]
    
    if channel_id:
        materials = db_service.search_materials_by_keywords(
            channel_id=channel_id,
            keywords=keywords,
            limit=limit
        )
    else:
        # 全局搜索
        materials = db_service.get_all_materials(
            search=" ".join(keywords),
            limit=limit
        )
    
    return [
        MaterialResponse(
            id=m["id"],
            content=m["content"],
            material_type=m["material_type"],
            channel_id=m.get("channel_id"),
            channel_slug=m.get("channel_slug"),
            tags=m.get("tags", []),
            source=m.get("source"),
            created_at=m.get("created_at")
        )
        for m in materials
    ]
