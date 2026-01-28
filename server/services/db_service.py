# -*- coding: utf-8 -*-
"""
数据库服务层
封装数据库操作，支持任务状态管理和向量检索
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import text

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.config import SessionLocal
from database.models import Channel, BrandAsset, PersonalMaterial, WritingTask


class DatabaseService:
    """数据库服务类"""
    
    def get_db(self) -> Session:
        """获取数据库会话"""
        return SessionLocal()
    
    # ========================================================================
    # Channel 操作
    # ========================================================================
    
    def get_channel_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """通过 slug 获取频道配置"""
        db = self.get_db()
        try:
            channel = db.query(Channel).filter(Channel.slug == slug).first()
            if not channel:
                return None
            
            return {
                "id": str(channel.id),
                "name": channel.name,
                "slug": channel.slug,
                "description": channel.description,
                "system_prompt": channel.system_prompt,
                "style_guide_refs": channel.style_guide_refs,
                "channel_rules": channel.channel_rules,
                "blocked_phrases": channel.blocked_phrases,
                "material_tags": channel.material_tags,
                "target_audience": channel.target_audience,
                "brand_personality": channel.brand_personality,
                "is_active": channel.is_active
            }
        finally:
            db.close()
    
    def get_all_channels(self) -> List[Dict[str, Any]]:
        """获取所有活跃频道"""
        db = self.get_db()
        try:
            channels = db.query(Channel).filter(Channel.is_active == True).all()
            return [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "slug": c.slug,
                    "description": c.description
                }
                for c in channels
            ]
        finally:
            db.close()
    
    def create_channel(
        self,
        name: str,
        slug: str,
        description: str = "",
        system_prompt: Dict[str, Any] = None,
        style_guide_refs: List[str] = None,
        channel_rules: Dict[str, Any] = None,
        blocked_phrases: List[str] = None,
        material_tags: List[str] = None,
        target_audience: str = "",
        brand_personality: str = ""
    ) -> Optional[Dict[str, Any]]:
        """创建新频道"""
        db = self.get_db()
        try:
            # 检查 slug 是否已存在
            existing = db.query(Channel).filter(Channel.slug == slug).first()
            if existing:
                return None
            
            channel = Channel(
                name=name,
                slug=slug,
                description=description,
                system_prompt=system_prompt or {},
                style_guide_refs=style_guide_refs or [],
                channel_rules=channel_rules or {},
                blocked_phrases=blocked_phrases or [],
                material_tags=material_tags or [],
                target_audience=target_audience or "",
                brand_personality=brand_personality or "",
                is_active=True
            )
            db.add(channel)
            db.commit()
            db.refresh(channel)
            
            return {
                "id": str(channel.id),
                "name": channel.name,
                "slug": channel.slug,
                "description": channel.description,
                "system_prompt": channel.system_prompt,
                "style_guide_refs": channel.style_guide_refs,
                "channel_rules": channel.channel_rules,
                "blocked_phrases": channel.blocked_phrases,
                "material_tags": channel.material_tags,
                "target_audience": channel.target_audience,
                "brand_personality": channel.brand_personality,
                "is_active": channel.is_active
            }
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def update_channel(
        self,
        slug: str,
        name: str = None,
        description: str = None,
        system_prompt: Dict[str, Any] = None,
        style_guide_refs: List[str] = None,
        channel_rules: Dict[str, Any] = None,
        blocked_phrases: List[str] = None,
        material_tags: List[str] = None,
        target_audience: str = None,
        brand_personality: str = None,
        is_active: bool = None
    ) -> Optional[Dict[str, Any]]:
        """更新频道信息"""
        db = self.get_db()
        try:
            channel = db.query(Channel).filter(Channel.slug == slug).first()
            if not channel:
                return None
            
            if name is not None:
                channel.name = name
            if description is not None:
                channel.description = description
            if system_prompt is not None:
                channel.system_prompt = system_prompt
            if style_guide_refs is not None:
                channel.style_guide_refs = style_guide_refs
            if channel_rules is not None:
                channel.channel_rules = channel_rules
            if blocked_phrases is not None:
                channel.blocked_phrases = blocked_phrases
            if material_tags is not None:
                channel.material_tags = material_tags
            if target_audience is not None:
                channel.target_audience = target_audience
            if brand_personality is not None:
                channel.brand_personality = brand_personality
            if is_active is not None:
                channel.is_active = is_active
            
            db.commit()
            db.refresh(channel)
            
            return {
                "id": str(channel.id),
                "name": channel.name,
                "slug": channel.slug,
                "description": channel.description,
                "system_prompt": channel.system_prompt,
                "style_guide_refs": channel.style_guide_refs,
                "channel_rules": channel.channel_rules,
                "blocked_phrases": channel.blocked_phrases,
                "material_tags": channel.material_tags,
                "target_audience": channel.target_audience,
                "brand_personality": channel.brand_personality,
                "is_active": channel.is_active
            }
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def delete_channel(self, slug: str) -> bool:
        """删除频道（软删除，设置 is_active=False）"""
        db = self.get_db()
        try:
            channel = db.query(Channel).filter(Channel.slug == slug).first()
            if not channel:
                return False
            
            channel.is_active = False
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    # ========================================================================
    # BrandAsset 操作
    # ========================================================================
    
    def get_blocking_words(self) -> Optional[str]:
        """获取屏蔽词库内容（用于 S8 审校）"""
        db = self.get_db()
        try:
            asset = db.query(BrandAsset).filter(
                BrandAsset.asset_key == "blocking_words"
            ).first()
            return asset.content if asset else None
        finally:
            db.close()
    
    def get_brand_asset(self, asset_key: str) -> Optional[str]:
        """获取指定品牌资产内容"""
        db = self.get_db()
        try:
            asset = db.query(BrandAsset).filter(
                BrandAsset.asset_key == asset_key
            ).first()
            return asset.content if asset else None
        finally:
            db.close()
    
    def get_brand_asset_detail(self, asset_key: str) -> Optional[Dict[str, Any]]:
        """获取指定品牌资产详情"""
        db = self.get_db()
        try:
            asset = db.query(BrandAsset).filter(
                BrandAsset.asset_key == asset_key
            ).first()
            if not asset:
                return None
            return {
                "asset_key": asset.asset_key,
                "content": asset.content,
                "content_type": asset.content_type,
                "description": asset.description,
                "last_updated": asset.last_updated.isoformat() if asset.last_updated else None
            }
        finally:
            db.close()
    
    def get_all_brand_assets(self) -> List[Dict[str, Any]]:
        """获取所有品牌资产"""
        db = self.get_db()
        try:
            assets = db.query(BrandAsset).order_by(BrandAsset.asset_key).all()
            return [
                {
                    "asset_key": a.asset_key,
                    "content": a.content,
                    "content_type": a.content_type,
                    "description": a.description,
                    "last_updated": a.last_updated.isoformat() if a.last_updated else None
                }
                for a in assets
            ]
        finally:
            db.close()
    
    def upsert_brand_asset(
        self,
        asset_key: str,
        content: str,
        content_type: str = "markdown",
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """创建或更新品牌资产"""
        db = self.get_db()
        try:
            asset = db.query(BrandAsset).filter(
                BrandAsset.asset_key == asset_key
            ).first()
            
            if asset:
                asset.content = content
                asset.content_type = content_type
                if description is not None:
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
            
            return {
                "asset_key": asset.asset_key,
                "content": asset.content,
                "content_type": asset.content_type,
                "description": asset.description,
                "last_updated": asset.last_updated.isoformat() if asset.last_updated else None
            }
        finally:
            db.close()
    
    def delete_brand_asset(self, asset_key: str) -> bool:
        """删除品牌资产"""
        db = self.get_db()
        try:
            asset = db.query(BrandAsset).filter(
                BrandAsset.asset_key == asset_key
            ).first()
            if not asset:
                return False
            db.delete(asset)
            db.commit()
            return True
        finally:
            db.close()
    
    # ========================================================================
    # PersonalMaterial 操作 (RAG 核心)
    # ========================================================================
    
    def search_materials_by_keywords(
        self,
        channel_id: str,
        keywords: List[str],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        基于关键词搜索素材（简单文本匹配，备用方案）
        
        关键：必须带 channel_id 过滤，防止跨频道污染
        """
        db = self.get_db()
        try:
            # 构建模糊搜索条件
            query = db.query(PersonalMaterial).filter(
                # 频道隔离：指定频道 + 全局素材
                (PersonalMaterial.channel_id == channel_id) | 
                (PersonalMaterial.channel_id.is_(None))
            )
            
            # 关键词匹配
            if keywords:
                keyword_filters = []
                for kw in keywords:
                    keyword_filters.append(
                        PersonalMaterial.content.ilike(f"%{kw}%")
                    )
                # 任意关键词匹配
                from sqlalchemy import or_
                query = query.filter(or_(*keyword_filters))
            
            materials = query.limit(limit).all()
            
            return [
                {
                    "id": str(m.id),
                    "content": m.content,
                    "material_type": m.material_type,
                    "tags": m.tags,
                    "source": m.source
                }
                for m in materials
            ]
        finally:
            db.close()
    
    def search_materials_by_embedding(
        self,
        channel_id: str,
        query_embedding: List[float],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        基于向量相似度搜索素材（RAG 核心）
        
        关键：必须带 channel_id 过滤，防止跨频道污染
        
        Args:
            channel_id: 频道 UUID 字符串
            query_embedding: 查询向量 (1536 维)
            top_k: 返回最相似的 k 条
        """
        db = self.get_db()
        try:
            # 将向量转换为 pgvector 格式
            embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
            
            # 使用原生 SQL 进行向量检索
            # 关键：WHERE 子句包含 channel_id 过滤
            sql = text("""
                SELECT 
                    id, 
                    content, 
                    material_type, 
                    tags, 
                    source,
                    embedding <=> :embedding::vector AS distance
                FROM personal_materials
                WHERE embedding IS NOT NULL
                  AND (channel_id = :channel_id::uuid OR channel_id IS NULL)
                ORDER BY embedding <=> :embedding::vector
                LIMIT :limit
            """)
            
            result = db.execute(sql, {
                "embedding": embedding_str,
                "channel_id": channel_id,
                "limit": top_k
            })
            
            materials = []
            for row in result:
                materials.append({
                    "id": str(row.id),
                    "content": row.content,
                    "material_type": row.material_type,
                    "tags": row.tags,
                    "source": row.source,
                    "similarity": 1 - row.distance  # 转换为相似度
                })
            
            return materials
        except Exception as e:
            print(f"[WARN] 向量检索失败，回退到关键词搜索: {e}")
            # 回退到关键词搜索
            return self.search_materials_by_keywords(channel_id, [], top_k)
        finally:
            db.close()
    
    def get_materials_by_channel(
        self,
        channel_id: str,
        material_type: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        获取指定频道的素材列表
        
        关键：必须带 channel_id 过滤
        """
        db = self.get_db()
        try:
            query = db.query(PersonalMaterial).filter(
                (PersonalMaterial.channel_id == channel_id) | 
                (PersonalMaterial.channel_id.is_(None))
            )
            
            if material_type:
                query = query.filter(PersonalMaterial.material_type == material_type)
            
            materials = query.order_by(PersonalMaterial.created_at.desc()).limit(limit).all()
            
            return [
                {
                    "id": str(m.id),
                    "content": m.content,
                    "material_type": m.material_type,
                    "tags": m.tags,
                    "source": m.source
                }
                for m in materials
            ]
        finally:
            db.close()
    
    # ========================================================================
    # WritingTask 操作
    # ========================================================================
    
    def create_task(
        self,
        channel_id: str,
        title: Optional[str] = None,
        brief_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        创建新的写作任务
        
        Returns:
            包含 task_id 的任务数据
        """
        db = self.get_db()
        try:
            # 获取频道 UUID
            channel = db.query(Channel).filter(Channel.slug == channel_id).first()
            if not channel:
                raise ValueError(f"频道不存在: {channel_id}")
            
            task = WritingTask(
                channel_id=channel.id,
                title=title,
                current_step=1,
                status="processing",
                brief_data=brief_data or {},
                think_aloud_logs=[]
            )
            
            db.add(task)
            db.commit()
            db.refresh(task)
            
            return {
                "id": str(task.id),
                "channel_id": str(task.channel_id),
                "channel_slug": channel_id,
                "title": task.title,
                "current_step": task.current_step,
                "status": task.status,
                "brief_data": task.brief_data,
                "created_at": task.created_at.isoformat()
            }
        finally:
            db.close()
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务详情"""
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return None
            
            # 获取频道 slug
            channel = db.query(Channel).filter(Channel.id == task.channel_id).first()
            
            return {
                "id": str(task.id),
                "channel_id": str(task.channel_id),
                "channel_slug": channel.slug if channel else None,
                "title": task.title,
                "current_step": task.current_step,
                "status": task.status,
                "brief_data": task.brief_data,
                "knowledge_base_data": task.knowledge_base_data,
                "draft_content": task.draft_content,
                "final_content": task.final_content,
                "think_aloud_logs": task.think_aloud_logs,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat(),
                "completed_at": task.completed_at.isoformat() if task.completed_at else None
            }
        finally:
            db.close()
    
    def update_task_step(
        self,
        task_id: str,
        step: int,
        status: str,
        **extra_fields
    ) -> Optional[Dict[str, Any]]:
        """
        更新任务步骤和状态
        
        支持高并发：使用任务 ID 精确定位，事务保证原子性
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return None
            
            task.current_step = step
            task.status = status
            
            # 更新额外字段
            for key, value in extra_fields.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            
            # 如果任务完成，记录完成时间
            if status == "completed":
                task.completed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(task)
            
            return self.get_task(task_id)
        finally:
            db.close()
    
    def update_task_to_waiting(
        self,
        task_id: str,
        step: int,
        output_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        更新任务为等待确认状态（卡点）
        
        用于 Step 3 选题讨论和 Step 6 数据确认
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return None
            
            task.current_step = step
            task.status = "waiting_confirm"
            
            # 更新 brief_data 中的步骤输出
            current_data = task.brief_data or {}
            current_data[f"step_{step}_output"] = output_data
            task.brief_data = current_data
            flag_modified(task, "brief_data")
            
            db.commit()
            db.refresh(task)
            
            return self.get_task(task_id)
        finally:
            db.close()
    
    def add_think_aloud_log(
        self,
        task_id: str,
        step: int,
        log_content: str
    ) -> bool:
        """
        添加 Think Aloud 日志
        
        实时持久化 AI 思考过程到数据库
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return False
            
            # 获取现有日志
            logs = task.think_aloud_logs or []
            
            # 添加新日志
            logs.append({
                "step": step,
                "timestamp": datetime.utcnow().isoformat(),
                "content": log_content
            })
            
            task.think_aloud_logs = logs
            flag_modified(task, "think_aloud_logs")
            
            db.commit()
            return True
        finally:
            db.close()
    
    def update_brief_data(
        self,
        task_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """
        更新任务的 brief_data（部分更新）
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return False
            
            current_data = task.brief_data or {}
            current_data.update(updates)
            task.brief_data = current_data
            
            # 显式标记 JSONB 字段已修改，确保 SQLAlchemy 能检测到变化
            flag_modified(task, "brief_data")
            
            db.commit()
            return True
        finally:
            db.close()
    
    def confirm_and_continue(
        self,
        task_id: str,
        confirmation_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        用户确认后继续执行
        
        用于前端"确认并继续"按钮
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return None
            
            # 更新状态为处理中
            task.status = "processing"
            
            # 保存确认数据
            current_data = task.brief_data or {}
            current_data["user_confirmation"] = confirmation_data
            task.brief_data = current_data
            flag_modified(task, "brief_data")
            
            db.commit()
            db.refresh(task)
            
            return self.get_task(task_id)
        finally:
            db.close()
    
    def get_all_tasks(
        self,
        channel_slug: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取所有任务列表"""
        db = self.get_db()
        try:
            query = db.query(WritingTask)
            
            # 按频道筛选
            if channel_slug:
                channel = db.query(Channel).filter(Channel.slug == channel_slug).first()
                if channel:
                    query = query.filter(WritingTask.channel_id == channel.id)
            
            # 按状态筛选
            if status:
                query = query.filter(WritingTask.status == status)
            
            tasks = query.order_by(WritingTask.created_at.desc()).limit(limit).all()
            
            result = []
            for task in tasks:
                channel = db.query(Channel).filter(Channel.id == task.channel_id).first()
                result.append({
                    "id": str(task.id),
                    "title": task.title,
                    "channel_slug": channel.slug if channel else None,
                    "current_step": task.current_step,
                    "status": task.status,
                    "created_at": task.created_at.isoformat(),
                    "updated_at": task.updated_at.isoformat(),
                    "brief_data": task.brief_data  # 包含 brief 信息，用于显示任务名称
                })
            
            return result
        finally:
            db.close()
    
    def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            if not task:
                return False
            db.delete(task)
            db.commit()
            return True
        finally:
            db.close()
    
    # ========================================================================
    # PersonalMaterial 扩展操作
    # ========================================================================
    
    def get_all_materials(
        self,
        channel_slug: Optional[str] = None,
        material_type: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """获取所有素材（支持筛选和搜索）"""
        db = self.get_db()
        try:
            query = db.query(PersonalMaterial)
            
            # 按频道筛选
            if channel_slug:
                channel = db.query(Channel).filter(Channel.slug == channel_slug).first()
                if channel:
                    query = query.filter(
                        (PersonalMaterial.channel_id == channel.id) |
                        (PersonalMaterial.channel_id.is_(None))
                    )
            
            # 按类型筛选
            if material_type:
                query = query.filter(PersonalMaterial.material_type == material_type)
            
            # 关键词搜索
            if search:
                query = query.filter(PersonalMaterial.content.ilike(f"%{search}%"))
            
            materials = query.order_by(PersonalMaterial.created_at.desc()).limit(limit).all()
            
            result = []
            for m in materials:
                channel = db.query(Channel).filter(Channel.id == m.channel_id).first() if m.channel_id else None
                result.append({
                    "id": str(m.id),
                    "content": m.content,
                    "material_type": m.material_type,
                    "channel_id": str(m.channel_id) if m.channel_id else None,
                    "channel_slug": channel.slug if channel else None,
                    "tags": m.tags,
                    "source": m.source,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                })
            
            return result
        finally:
            db.close()
    
    def create_material(
        self,
        content: str,
        material_type: str,
        channel_slug: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source: Optional[str] = None
    ) -> Dict[str, Any]:
        """创建新素材"""
        db = self.get_db()
        try:
            channel_id = None
            if channel_slug:
                channel = db.query(Channel).filter(Channel.slug == channel_slug).first()
                if channel:
                    channel_id = channel.id
            
            material = PersonalMaterial(
                content=content,
                material_type=material_type,
                channel_id=channel_id,
                tags=tags or [],
                source=source,
                embedding=None  # 需要后续调用 embedding 接口
            )
            
            db.add(material)
            db.commit()
            db.refresh(material)
            
            return {
                "id": str(material.id),
                "content": material.content,
                "material_type": material.material_type,
                "channel_id": str(material.channel_id) if material.channel_id else None,
                "channel_slug": channel_slug,
                "tags": material.tags,
                "source": material.source,
                "created_at": material.created_at.isoformat() if material.created_at else None
            }
        finally:
            db.close()
    
    def delete_material(self, material_id: str) -> bool:
        """删除素材"""
        db = self.get_db()
        try:
            material = db.query(PersonalMaterial).filter(
                PersonalMaterial.id == material_id
            ).first()
            if not material:
                return False
            db.delete(material)
            db.commit()
            return True
        finally:
            db.close()


# 全局数据库服务实例
db_service = DatabaseService()

