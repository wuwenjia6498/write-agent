"""
品牌资产管理路由
负责 brand_assets 表的 CRUD 操作
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from services.db_service import db_service

router = APIRouter()


class BrandAssetCreate(BaseModel):
    """创建品牌资产请求"""
    asset_key: str
    content: str
    content_type: str = "markdown"
    description: Optional[str] = None


class BrandAssetUpdate(BaseModel):
    """更新品牌资产请求"""
    content: str
    content_type: Optional[str] = None
    description: Optional[str] = None


class BrandAssetResponse(BaseModel):
    """品牌资产响应"""
    asset_key: str
    content: str
    content_type: str
    description: Optional[str]
    last_updated: str


@router.get("/")
async def list_brand_assets() -> List[BrandAssetResponse]:
    """获取所有品牌资产"""
    assets = db_service.get_all_brand_assets()
    return [
        BrandAssetResponse(
            asset_key=a["asset_key"],
            content=a["content"],
            content_type=a["content_type"],
            description=a.get("description"),
            last_updated=a["last_updated"]
        )
        for a in assets
    ]


@router.get("/{asset_key}")
async def get_brand_asset(asset_key: str) -> BrandAssetResponse:
    """获取指定品牌资产"""
    asset = db_service.get_brand_asset_detail(asset_key)
    if not asset:
        raise HTTPException(status_code=404, detail=f"资产不存在: {asset_key}")
    
    return BrandAssetResponse(
        asset_key=asset["asset_key"],
        content=asset["content"],
        content_type=asset["content_type"],
        description=asset.get("description"),
        last_updated=asset["last_updated"]
    )


@router.post("/")
async def create_brand_asset(request: BrandAssetCreate) -> BrandAssetResponse:
    """创建新的品牌资产"""
    try:
        asset = db_service.upsert_brand_asset(
            asset_key=request.asset_key,
            content=request.content,
            content_type=request.content_type,
            description=request.description
        )
        return BrandAssetResponse(
            asset_key=asset["asset_key"],
            content=asset["content"],
            content_type=asset["content_type"],
            description=asset.get("description"),
            last_updated=asset["last_updated"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{asset_key}")
async def update_brand_asset(asset_key: str, request: BrandAssetUpdate) -> BrandAssetResponse:
    """更新品牌资产"""
    try:
        asset = db_service.upsert_brand_asset(
            asset_key=asset_key,
            content=request.content,
            content_type=request.content_type or "markdown",
            description=request.description
        )
        return BrandAssetResponse(
            asset_key=asset["asset_key"],
            content=asset["content"],
            content_type=asset["content_type"],
            description=asset.get("description"),
            last_updated=asset["last_updated"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{asset_key}")
async def delete_brand_asset(asset_key: str):
    """删除品牌资产"""
    success = db_service.delete_brand_asset(asset_key)
    if not success:
        raise HTTPException(status_code=404, detail=f"资产不存在: {asset_key}")
    return {"success": True, "message": f"已删除: {asset_key}"}

