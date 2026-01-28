"""
频道管理路由
负责频道配置的加载、切换和管理
支持从数据库获取频道（优先）或 JSON 文件（回退）
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
from pathlib import Path

from services.db_service import db_service

router = APIRouter()

# 配置文件路径（回退使用）
CONFIGS_DIR = Path(__file__).parent.parent / "configs" / "channels"

class ChannelInfo(BaseModel):
    """频道基础信息"""
    channel_id: str
    channel_name: str
    slug: str
    name: str
    description: str
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""

class ChannelConfig(BaseModel):
    """完整频道配置"""
    channel_id: str
    channel_name: str
    description: str
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""
    system_prompt: Optional[Dict[str, Any]] = None
    sample_articles: Optional[List[str]] = []
    material_tags: Optional[List[str]] = []
    channel_specific_rules: Optional[Dict[str, List[str]]] = None
    blocked_phrases: Optional[List[str]] = []

class ChannelCreateRequest(BaseModel):
    """创建频道请求"""
    name: str
    slug: str
    description: str = ""
    system_prompt: Optional[Dict[str, Any]] = None
    style_guide_refs: Optional[List[str]] = None
    channel_rules: Optional[Dict[str, Any]] = None
    blocked_phrases: Optional[List[str]] = None
    material_tags: Optional[List[str]] = None
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""

class ChannelUpdateRequest(BaseModel):
    """更新频道请求"""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[Dict[str, Any]] = None
    style_guide_refs: Optional[List[str]] = None
    channel_rules: Optional[Dict[str, Any]] = None
    blocked_phrases: Optional[List[str]] = None
    material_tags: Optional[List[str]] = None
    target_audience: Optional[str] = None
    brand_personality: Optional[str] = None
    is_active: Optional[bool] = None

def load_channel_config(channel_id: str) -> Dict[str, Any]:
    """加载频道配置文件（从 JSON）"""
    config_file = CONFIGS_DIR / f"{channel_id}.json"
    
    if not config_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"频道配置文件不存在: {channel_id}"
        )
    
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"加载配置文件失败: {str(e)}"
        )

@router.get("/")
async def list_channels() -> List[ChannelInfo]:
    """
    获取所有可用频道列表
    优先从数据库获取，失败时回退到 JSON 文件
    """
    channels = []
    
    # 尝试从数据库获取
    try:
        db_channels = db_service.get_all_channels()
        if db_channels:
            for ch in db_channels:
                channels.append(ChannelInfo(
                    channel_id=ch["slug"],
                    channel_name=ch["name"],
                    slug=ch["slug"],
                    name=ch["name"],
                    description=ch.get("description", ""),
                    target_audience="",
                    brand_personality=""
                ))
            return channels
    except Exception as e:
        print(f"[WARN] 从数据库获取频道失败，回退到 JSON: {e}")
    
    # 回退：扫描 JSON 配置目录
    for config_file in CONFIGS_DIR.glob("*.json"):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                channels.append(ChannelInfo(
                    channel_id=config["channel_id"],
                    channel_name=config["channel_name"],
                    slug=config["channel_id"],
                    name=config["channel_name"],
                    description=config["description"],
                    target_audience=config.get("target_audience", ""),
                    brand_personality=config.get("brand_personality", "")
                ))
        except Exception as e:
            print(f"警告: 加载 {config_file.name} 失败: {e}")
            continue
    
    return channels

@router.get("/{channel_id}")
async def get_channel_config(channel_id: str) -> ChannelConfig:
    """
    获取指定频道的完整配置
    优先从数据库读取，失败时回退到 JSON 文件
    
    Args:
        channel_id: 频道ID (deep_reading / picture_books / parenting)
    
    Returns:
        完整的频道配置信息
    """
    # 优先从数据库读取
    try:
        db_channel = db_service.get_channel_by_slug(channel_id)
        if db_channel:
            system_prompt = db_channel.get("system_prompt") or {}
            channel_rules = db_channel.get("channel_rules") or {}
            
            return ChannelConfig(
                channel_id=db_channel["slug"],
                channel_name=db_channel["name"],
                description=db_channel.get("description") or "",
                # 优先从独立字段读取，回退到 system_prompt
                target_audience=db_channel.get("target_audience") or system_prompt.get("target_audience", ""),
                brand_personality=db_channel.get("brand_personality") or system_prompt.get("brand_personality", ""),
                system_prompt=system_prompt,
                sample_articles=db_channel.get("style_guide_refs") or [],
                # 优先从独立字段读取，回退到 system_prompt
                material_tags=db_channel.get("material_tags") or system_prompt.get("material_tags") or [],
                channel_specific_rules=channel_rules,
                blocked_phrases=db_channel.get("blocked_phrases") or system_prompt.get("blocked_phrases") or []
            )
    except Exception as e:
        print(f"[WARN] 从数据库获取频道 {channel_id} 失败，回退到 JSON: {e}")
    
    # 回退到 JSON 文件
    config = load_channel_config(channel_id)
    return ChannelConfig(**config)

@router.get("/{channel_id}/system-prompt")
async def get_system_prompt(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的 System Prompt
    用于初始化 AI 写作人格
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "channel_name": config["channel_name"],
        "system_prompt": config["system_prompt"]
    }

@router.get("/{channel_id}/samples")
async def get_sample_articles(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的样文路径列表
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "sample_articles": config["sample_articles"],
        "material_tags": config["material_tags"]
    }

@router.get("/{channel_id}/rules")
async def get_channel_rules(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的特定规则和屏蔽词
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "channel_specific_rules": config["channel_specific_rules"],
        "blocked_phrases": config["blocked_phrases"]
    }

@router.post("/")
async def create_channel(request: ChannelCreateRequest) -> Dict[str, Any]:
    """
    创建新频道
    """
    try:
        result = db_service.create_channel(
            name=request.name,
            slug=request.slug,
            description=request.description,
            system_prompt=request.system_prompt,
            style_guide_refs=request.style_guide_refs,
            channel_rules=request.channel_rules,
            blocked_phrases=request.blocked_phrases,
            material_tags=request.material_tags,
            target_audience=request.target_audience,
            brand_personality=request.brand_personality
        )
        
        if result is None:
            raise HTTPException(
                status_code=400,
                detail=f"频道标识符 '{request.slug}' 已存在"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建频道失败: {str(e)}"
        )

@router.put("/{channel_id}")
async def update_channel(channel_id: str, request: ChannelUpdateRequest) -> Dict[str, Any]:
    """
    更新频道信息
    """
    try:
        result = db_service.update_channel(
            slug=channel_id,
            name=request.name,
            description=request.description,
            system_prompt=request.system_prompt,
            style_guide_refs=request.style_guide_refs,
            channel_rules=request.channel_rules,
            blocked_phrases=request.blocked_phrases,
            material_tags=request.material_tags,
            target_audience=request.target_audience,
            brand_personality=request.brand_personality,
            is_active=request.is_active
        )
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"频道 '{channel_id}' 不存在"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新频道失败: {str(e)}"
        )

@router.delete("/{channel_id}")
async def delete_channel(channel_id: str) -> Dict[str, str]:
    """
    删除频道（软删除）
    """
    try:
        success = db_service.delete_channel(channel_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"频道 '{channel_id}' 不存在"
            )
        
        return {"message": f"频道 '{channel_id}' 已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除频道失败: {str(e)}"
        )

