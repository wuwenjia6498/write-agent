# -*- coding: utf-8 -*-
"""
数据库 CRUD 操作
提供各表的增删改查方法，封装常用查询逻辑
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from .models import Channel, BrandAsset, PersonalMaterial, WritingTask


# ============================================================================
# Channel CRUD 操作
# ============================================================================

def get_channel_by_id(db: Session, channel_id: uuid.UUID) -> Optional[Channel]:
    """通过 ID 获取频道"""
    return db.query(Channel).filter(Channel.id == channel_id).first()


def get_channel_by_slug(db: Session, slug: str) -> Optional[Channel]:
    """通过 slug 获取频道"""
    return db.query(Channel).filter(Channel.slug == slug).first()


def get_all_channels(db: Session, active_only: bool = True) -> List[Channel]:
    """获取所有频道"""
    query = db.query(Channel)
    if active_only:
        query = query.filter(Channel.is_active == True)
    return query.order_by(Channel.created_at).all()


def create_channel(
    db: Session,
    name: str,
    slug: str,
    description: Optional[str] = None,
    system_prompt: Optional[Dict] = None,
    style_guide_refs: Optional[List[str]] = None,
    channel_rules: Optional[Dict] = None
) -> Channel:
    """创建新频道"""
    channel = Channel(
        name=name,
        slug=slug,
        description=description,
        system_prompt=system_prompt,
        style_guide_refs=style_guide_refs or [],
        channel_rules=channel_rules
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


def update_channel(
    db: Session,
    channel_id: uuid.UUID,
    **kwargs
) -> Optional[Channel]:
    """更新频道信息"""
    channel = get_channel_by_id(db, channel_id)
    if not channel:
        return None
    
    for key, value in kwargs.items():
        if hasattr(channel, key):
            setattr(channel, key, value)
    
    db.commit()
    db.refresh(channel)
    return channel


# ============================================================================
# BrandAsset CRUD 操作
# ============================================================================

def get_brand_asset(db: Session, asset_key: str) -> Optional[BrandAsset]:
    """通过 key 获取品牌资产"""
    return db.query(BrandAsset).filter(BrandAsset.asset_key == asset_key).first()


def get_blocking_words(db: Session) -> Optional[str]:
    """
    快速获取屏蔽词库内容
    专门用于 S8 审校步骤
    """
    asset = get_brand_asset(db, "blocking_words")
    return asset.content if asset else None


def get_all_brand_assets(db: Session) -> List[BrandAsset]:
    """获取所有品牌资产"""
    return db.query(BrandAsset).order_by(BrandAsset.asset_key).all()


def upsert_brand_asset(
    db: Session,
    asset_key: str,
    content: str,
    content_type: str = "markdown",
    description: Optional[str] = None
) -> BrandAsset:
    """创建或更新品牌资产"""
    asset = get_brand_asset(db, asset_key)
    
    if asset:
        asset.content = content
        asset.content_type = content_type
        if description:
            asset.description = description
        asset.last_updated = datetime.utcnow()
    else:
        asset = BrandAsset(
            asset_key=asset_key,
            content=content,
            content_type=content_type,
            description=description
        )
        db.add(asset)
    
    db.commit()
    db.refresh(asset)
    return asset


# ============================================================================
# PersonalMaterial CRUD 操作
# ============================================================================

def get_material_by_id(db: Session, material_id: uuid.UUID) -> Optional[PersonalMaterial]:
    """通过 ID 获取素材"""
    return db.query(PersonalMaterial).filter(PersonalMaterial.id == material_id).first()


def get_materials_by_channel(
    db: Session,
    channel_id: uuid.UUID,
    include_global: bool = True,
    material_type: Optional[str] = None,
    limit: int = 100
) -> List[PersonalMaterial]:
    """
    获取指定频道的素材
    
    关键：必须带 channel_id 过滤，防止跨频道污染
    
    Args:
        db: 数据库会话
        channel_id: 频道 ID
        include_global: 是否包含全频道通用素材 (channel_id IS NULL)
        material_type: 筛选素材类型
        limit: 返回数量限制
    """
    if include_global:
        # 包含指定频道 + 全频道通用素材
        condition = or_(
            PersonalMaterial.channel_id == channel_id,
            PersonalMaterial.channel_id.is_(None)
        )
    else:
        # 仅指定频道
        condition = PersonalMaterial.channel_id == channel_id
    
    query = db.query(PersonalMaterial).filter(condition)
    
    if material_type:
        query = query.filter(PersonalMaterial.material_type == material_type)
    
    return query.order_by(PersonalMaterial.created_at.desc()).limit(limit).all()


def search_materials_by_embedding(
    db: Session,
    channel_id: uuid.UUID,
    query_embedding: List[float],
    top_k: int = 5,
    include_global: bool = True
) -> List[PersonalMaterial]:
    """
    通过向量相似度搜索素材（用于 S5 素材注入）
    
    关键：必须带 channel_id 过滤，防止跨频道污染
    
    Args:
        db: 数据库会话
        channel_id: 频道 ID（强制过滤）
        query_embedding: 查询向量 (1536 维)
        top_k: 返回最相似的 k 条
        include_global: 是否包含全频道通用素材
    
    Returns:
        按相似度排序的素材列表
    """
    from sqlalchemy import text
    
    # 构建频道过滤条件
    if include_global:
        channel_filter = "(channel_id = :channel_id OR channel_id IS NULL)"
    else:
        channel_filter = "channel_id = :channel_id"
    
    # 使用 pgvector 的余弦相似度搜索
    # 注意：向量需要转换为字符串格式
    embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    
    sql = text(f"""
        SELECT id, content, material_type, tags, source, 
               embedding <=> :embedding::vector AS distance
        FROM personal_materials
        WHERE embedding IS NOT NULL
          AND {channel_filter}
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)
    
    result = db.execute(sql, {
        "embedding": embedding_str,
        "channel_id": str(channel_id),
        "limit": top_k
    })
    
    # 获取完整的 ORM 对象
    material_ids = [row.id for row in result]
    if not material_ids:
        return []
    
    return db.query(PersonalMaterial).filter(
        PersonalMaterial.id.in_(material_ids)
    ).all()


def create_material(
    db: Session,
    content: str,
    material_type: str,
    channel_id: Optional[uuid.UUID] = None,
    tags: Optional[List[str]] = None,
    source: Optional[str] = None,
    embedding: Optional[List[float]] = None
) -> PersonalMaterial:
    """创建新素材"""
    material = PersonalMaterial(
        content=content,
        channel_id=channel_id,
        material_type=material_type,
        tags=tags or [],
        source=source,
        embedding=embedding
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


def update_material_embedding(
    db: Session,
    material_id: uuid.UUID,
    embedding: List[float]
) -> Optional[PersonalMaterial]:
    """更新素材的向量嵌入"""
    material = get_material_by_id(db, material_id)
    if not material:
        return None
    
    material.embedding = embedding
    db.commit()
    db.refresh(material)
    return material


# ============================================================================
# WritingTask CRUD 操作
# ============================================================================

def get_task_by_id(db: Session, task_id: uuid.UUID) -> Optional[WritingTask]:
    """通过 ID 获取写作任务"""
    return db.query(WritingTask).filter(WritingTask.id == task_id).first()


def get_tasks_by_channel(
    db: Session,
    channel_id: uuid.UUID,
    status: Optional[str] = None,
    limit: int = 50
) -> List[WritingTask]:
    """获取指定频道的写作任务"""
    query = db.query(WritingTask).filter(WritingTask.channel_id == channel_id)
    
    if status:
        query = query.filter(WritingTask.status == status)
    
    return query.order_by(WritingTask.created_at.desc()).limit(limit).all()


def get_active_tasks(db: Session, limit: int = 20) -> List[WritingTask]:
    """获取所有进行中的任务"""
    return db.query(WritingTask).filter(
        WritingTask.status.in_(["draft", "processing", "waiting_confirm"])
    ).order_by(WritingTask.updated_at.desc()).limit(limit).all()


def create_task(
    db: Session,
    channel_id: uuid.UUID,
    title: Optional[str] = None,
    brief_data: Optional[Dict] = None
) -> WritingTask:
    """创建新的写作任务（S1 需求保存）"""
    task = WritingTask(
        channel_id=channel_id,
        title=title,
        current_step=1,
        status="draft",
        brief_data=brief_data or {}
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task_step(
    db: Session,
    task_id: uuid.UUID,
    step: int,
    status: str,
    **extra_fields
) -> Optional[WritingTask]:
    """
    更新任务步骤和状态
    
    Args:
        task_id: 任务 ID
        step: 新的步骤 (1-9)
        status: 新的状态
        **extra_fields: 其他需要更新的字段
            - brief_data
            - knowledge_base_data
            - draft_content
            - final_content
            - think_aloud_logs
    """
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    task.current_step = step
    task.status = status
    
    for key, value in extra_fields.items():
        if hasattr(task, key):
            setattr(task, key, value)
    
    # 如果任务完成，记录完成时间
    if status == "completed":
        task.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    return task


def add_think_aloud_log(
    db: Session,
    task_id: uuid.UUID,
    step: int,
    log_content: str
) -> Optional[WritingTask]:
    """添加 AI 思考日志"""
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    # 获取现有日志（如果为 None 则初始化为空列表）
    logs = task.think_aloud_logs or []
    
    # 添加新日志
    logs.append({
        "step": step,
        "timestamp": datetime.utcnow().isoformat(),
        "content": log_content
    })
    
    task.think_aloud_logs = logs
    db.commit()
    db.refresh(task)
    return task


def update_task_brief_data(
    db: Session,
    task_id: uuid.UUID,
    updates: Dict[str, Any]
) -> Optional[WritingTask]:
    """
    更新任务的 brief_data（部分更新）
    用于各步骤向 brief_data 中添加数据
    """
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    
    # 合并更新
    current_data = task.brief_data or {}
    current_data.update(updates)
    task.brief_data = current_data
    
    db.commit()
    db.refresh(task)
    return task

