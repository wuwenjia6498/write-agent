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

class ChannelConfig(BaseModel):
    """完整频道配置"""
    channel_id: str
    channel_name: str
    description: str
    target_audience: Optional[str] = ""
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
                    target_audience=""
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
                    target_audience=config.get("target_audience", "")
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
            target_audience=request.target_audience
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
    更新数据库后自动同步到 JSON 配置文件，确保工作流引擎使用最新配置
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
            is_active=request.is_active
        )
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"频道 '{channel_id}' 不存在"
            )
        
        # 自动同步到 JSON 配置文件，确保工作流引擎读取最新数据
        try:
            from services.workflow_engine import workflow_engine
            synced = workflow_engine.sync_channel_config_to_json(channel_id)
            if synced:
                print(f"✅ 频道 '{channel_id}' 配置已自动同步到 JSON")
            else:
                print(f"⚠️ 频道 '{channel_id}' 自动同步失败，工作流可能使用旧配置")
        except Exception as sync_err:
            print(f"⚠️ 自动同步异常（不影响数据库更新）: {sync_err}")
        
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


# ============================================================================
# 标杆样文管理 API (v3.5 - 独立表 + custom_tags)
# ============================================================================

# [v4.5 已移除] 预设标签库 / PRESET_TAG_LIBRARY / DEFAULT_INDUSTRY_TAGS
# 样文降维重构后不再使用标签系统
PRESET_TAG_LIBRARY_LEGACY = {
    "绘本阅读": {
        "内容": ["#绘本解析", "#绘本阅读指导", "#亲子阅读", "#主题书单"],
        "调性": ["#暖心治愈", "#趣味生动", "#情感共鸣", "#轻松种草"]
    },
    "深度阅读": {
        "内容": ["#整本书阅读", "#读写结合", "#阅读策略与技巧"],
        "调性": ["#理性专业", "#硬核干货", "#逻辑严密", "#教育前沿", "#思辨培养"]
    },
    "育儿随笔": {
        "内容": ["#科学育儿", "#情绪管理", "#亲子沟通", "#习惯养成", "#避坑建议"],
        "调性": ["#教育理念", "#实用指导", "#焦虑粉碎", "#观点犀利", "#温暖陪伴"]
    }
}

class StyleSampleCreate(BaseModel):
    """创建样文请求（v4.5 极简版：标题+内容+来源）"""
    title: str
    content: str
    source: Optional[str] = None


class StyleSampleUpdate(BaseModel):
    """更新样文请求"""
    title: Optional[str] = None
    source: Optional[str] = None


class StyleSampleResponse(BaseModel):
    """样文响应（v4.5 极简版）"""
    id: str
    title: str
    content: str
    source: Optional[str]
    added_at: str
    word_count: Optional[int] = None


@router.get("/{channel_slug}/style-samples")
async def get_style_samples(channel_slug: str) -> List[StyleSampleResponse]:
    """获取频道的样文列表（v4.5 极简版：标题+内容+来源）"""
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    samples_from_table = db_service.get_style_samples_by_channel(channel['id'])
    
    if samples_from_table:
        return [
            StyleSampleResponse(
                id=str(s['id']),
                title=s['title'],
                content=s['content'],
                source=s.get('source'),
                added_at=s.get('created_at', '').isoformat() if s.get('created_at') else '',
                word_count=s.get('word_count'),
            )
            for s in samples_from_table
        ]
    
    # 回退：从旧的 JSONB 字段读取
    samples = channel.get('style_samples', []) or []
    return [
        StyleSampleResponse(
            id=s.get('id', ''),
            title=s.get('title', ''),
            content=s.get('content', ''),
            source=s.get('source'),
            added_at=s.get('added_at', ''),
            word_count=len(s.get('content', '')),
        )
        for s in samples
    ]


@router.post("/{channel_slug}/style-samples")
async def add_style_sample(channel_slug: str, request: StyleSampleCreate) -> StyleSampleResponse:
    """添加样文（v4.5 极简版：纯 CRUD，不再调用 AI 分析）"""
    import uuid
    from datetime import datetime
    
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    existing_count = db_service.count_style_samples_by_channel(channel['id'])
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="样文最多 5 篇，请先删除旧样文")
    
    word_count = len(request.content) if request.content else 0
    
    sample_id = str(uuid.uuid4())
    success = db_service.create_style_sample(
        id=sample_id,
        channel_id=channel['id'],
        title=request.title,
        content=request.content,
        source=request.source,
        custom_tags=[],
        ai_suggested_tags=[],
        style_profile=None,
        is_analyzed=False,
        word_count=word_count
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="保存样文失败")
    
    return StyleSampleResponse(
        id=sample_id,
        title=request.title,
        content=request.content,
        source=request.source,
        added_at=datetime.utcnow().isoformat(),
        word_count=word_count,
    )


@router.put("/{channel_slug}/style-samples/{sample_id}")
async def update_style_sample(
    channel_slug: str, 
    sample_id: str, 
    request: StyleSampleUpdate
) -> Dict[str, Any]:
    """更新样文信息（标题、来源）"""
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    success = db_service.update_style_sample(
        sample_id=sample_id,
        title=request.title,
        source=request.source,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="样文不存在或更新失败")
    
    return {
        "message": "样文已更新",
        "sample_id": sample_id,
    }


@router.delete("/{channel_slug}/style-samples/{sample_id}")
async def delete_style_sample(channel_slug: str, sample_id: str) -> Dict[str, str]:
    """删除样文"""
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    success = db_service.delete_style_sample(sample_id)
    
    if not success:
        # 回退：从旧 JSONB 删除
        samples = channel.get('style_samples', []) or []
        new_samples = [s for s in samples if s.get('id') != sample_id]
        
        if len(new_samples) == len(samples):
            raise HTTPException(status_code=404, detail="样文不存在")
        
        db_service.update_channel_style_samples(channel['id'], new_samples)
    
    return {"message": "样文已删除"}


# ================================================================
# 配置同步 API（单一数据源策略）
# ================================================================

@router.post("/{channel_slug}/sync-config")
async def sync_channel_config(channel_slug: str):
    """
    将数据库中的频道配置同步到 JSON 配置文件
    
    用途：
    - 当通过管理界面修改了数据库中的频道配置后
    - 调用此 API 将配置同步到 JSON 文件
    - 确保工作流引擎使用最新配置
    
    数据源策略：
    - JSON 配置文件是"真相来源"（Source of Truth）
    - 数据库仅用于管理界面的 CRUD 操作
    - 同步操作将数据库配置写入 JSON 文件
    """
    from services.workflow_engine import workflow_engine
    
    success = workflow_engine.sync_channel_config_to_json(channel_slug)
    
    if success:
        return {
            "message": f"频道 '{channel_slug}' 配置已同步到 JSON 文件",
            "status": "success"
        }
    else:
        raise HTTPException(
            status_code=500, 
            detail=f"配置同步失败: 请检查频道 '{channel_slug}' 是否存在于数据库"
        )


@router.get("/{channel_slug}/config-source")
async def get_channel_config_source(channel_slug: str):
    """
    获取频道配置的数据来源
    
    用于诊断配置来源，确保数据一致性
    
    Returns:
        source: "json" | "database" | "not_found"
    """
    from services.workflow_engine import workflow_engine
    
    source = workflow_engine.get_config_source(channel_slug)
    
    return {
        "channel_slug": channel_slug,
        "config_source": source,
        "description": {
            "json": "配置来自 JSON 文件（推荐）",
            "database": "配置来自数据库（建议同步到 JSON）",
            "not_found": "未找到配置"
        }.get(source, "未知")
    }
