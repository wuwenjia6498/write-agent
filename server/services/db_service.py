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
from sqlalchemy.exc import OperationalError, DisconnectionError

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.config import SessionLocal
from database.models import Channel, BrandAsset, PersonalMaterial, WritingTask, StyleSample


class DatabaseService:
    """数据库服务类"""
    
    def get_db(self) -> Session:
        """
        获取数据库会话
        
        注意：pool_pre_ping 已在 engine 配置中启用，
        SQLAlchemy 会自动检测并重建失效连接。
        
        Returns:
            Session: 数据库会话
        """
        try:
            return SessionLocal()
        except (OperationalError, DisconnectionError) as e:
            print(f"[ERROR] 数据库连接失败: {e}")
            raise
    
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
                "is_active": channel.is_active,
                # 样文与风格画像 (v3.0)
                "style_samples": getattr(channel, 'style_samples', []) or [],
                "style_profile": getattr(channel, 'style_profile', None)
            }
        finally:
            db.close()
    
    def update_channel_style_profile(self, channel_id: str, style_profile: Dict[str, Any]) -> bool:
        """更新频道的风格画像"""
        db = self.get_db()
        try:
            from sqlalchemy.orm.attributes import flag_modified
            channel = db.query(Channel).filter(Channel.id == channel_id).first()
            if not channel:
                return False
            
            channel.style_profile = style_profile
            flag_modified(channel, 'style_profile')
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"更新风格画像失败: {e}")
            return False
        finally:
            db.close()
    
    def update_channel_style_samples(self, channel_id: str, style_samples: List[Dict[str, Any]]) -> bool:
        """更新频道的标杆样文"""
        db = self.get_db()
        try:
            from sqlalchemy.orm.attributes import flag_modified
            channel = db.query(Channel).filter(Channel.id == channel_id).first()
            if not channel:
                return False
            
            channel.style_samples = style_samples
            flag_modified(channel, 'style_samples')
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"更新标杆样文失败: {e}")
            return False
        finally:
            db.close()
    
    def get_all_channels(self) -> List[Dict[str, Any]]:
        """
        获取所有活跃频道（优化版）
        
        使用原生 SQL 只查询必要字段，避免 ORM 加载大型 JSONB 字段
        """
        db = self.get_db()
        try:
            sql = text("""
                SELECT id::text, name, slug, description
                FROM channels
                WHERE is_active = true
                ORDER BY created_at
            """)
            result = db.execute(sql)
            return [
                {
                    "id": row.id,
                    "name": row.name,
                    "slug": row.slug,
                    "description": row.description
                }
                for row in result
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
                "knowledge_summary": getattr(task, 'knowledge_summary', None),
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
    
    def update_knowledge_data(
        self,
        task_id: str,
        knowledge_base_data: str,
        knowledge_summary: str
    ) -> bool:
        """
        更新任务的调研数据（Step 2 专用）
        
        Args:
            task_id: 任务 ID
            knowledge_base_data: 调研全文（Markdown 格式）
            knowledge_summary: 核心要点摘要（300字以内）
        """
        db = self.get_db()
        try:
            task = db.query(WritingTask).filter(
                WritingTask.id == task_id
            ).first()
            
            if not task:
                return False
            
            task.knowledge_base_data = knowledge_base_data
            task.knowledge_summary = knowledge_summary
            
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 更新调研数据失败: {e}")
            return False
        finally:
            db.close()
    
    def get_all_tasks(
        self,
        channel_slug: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        获取所有任务列表（深度优化版）
        
        优化点：
        1. 使用原生 SQL，避免 ORM 加载完整对象
        2. 只查询必要字段，不加载大型 JSONB
        3. 使用 brief_data->>'brief' 直接在数据库提取子字段
        """
        db = self.get_db()
        try:
            # 构建参数化查询
            params = {"limit": limit}
            
            # 动态构建 WHERE 子句
            where_clauses = []
            if channel_slug:
                where_clauses.append("c.slug = :channel_slug")
                params["channel_slug"] = channel_slug
            if status:
                where_clauses.append("t.status = :status")
                params["status"] = status
            
            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)
            
            # 原生 SQL：只查询必要字段，使用 JSONB 操作符直接提取 brief
            sql = text(f"""
                SELECT 
                    t.id::text,
                    t.title,
                    c.slug as channel_slug,
                    t.current_step,
                    t.status,
                    t.created_at,
                    t.updated_at,
                    t.brief_data->>'brief' as brief
                FROM writing_tasks t
                JOIN channels c ON t.channel_id = c.id
                {where_sql}
                ORDER BY t.created_at DESC
                LIMIT :limit
            """)
            
            result = db.execute(sql, params)
            
            return [
                {
                    "id": row.id,
                    "title": row.title,
                    "channel_slug": row.channel_slug,
                    "current_step": row.current_step,
                    "status": row.status,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                    "brief": row.brief
                }
                for row in result
            ]
        finally:
            db.close()
    
    def delete_task(self, task_id: str) -> bool:
        """
        删除任务（优化版）
        
        使用原生 SQL 直接删除，避免先加载整个任务对象
        """
        db = self.get_db()
        try:
            # 直接使用 DELETE 语句，不需要先加载对象
            result = db.execute(
                text("DELETE FROM writing_tasks WHERE id = :task_id"),
                {"task_id": task_id}
            )
            db.commit()
            # rowcount 表示受影响的行数，0 表示任务不存在
            return result.rowcount > 0
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 删除任务失败: {e}")
            return False
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
        """
        获取所有素材（优化版）
        
        使用原生 SQL + LEFT JOIN 避免 N+1 查询问题
        """
        db = self.get_db()
        try:
            # 构建参数化查询
            params = {"limit": limit}
            
            # 动态构建 WHERE 子句
            where_clauses = []
            
            # 按频道筛选
            if channel_slug:
                where_clauses.append("(c.slug = :channel_slug OR m.channel_id IS NULL)")
                params["channel_slug"] = channel_slug
            
            # 按类型筛选
            if material_type:
                where_clauses.append("m.material_type = :material_type")
                params["material_type"] = material_type
            
            # 关键词搜索
            if search:
                where_clauses.append("m.content ILIKE :search")
                params["search"] = f"%{search}%"
            
            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)
            
            # 原生 SQL：使用 LEFT JOIN 一次性获取频道信息
            sql = text(f"""
                SELECT 
                    m.id::text,
                    m.content,
                    m.material_type,
                    m.channel_id::text,
                    c.slug as channel_slug,
                    m.tags,
                    m.source,
                    m.created_at,
                    m.style_tags,
                    m.quality_weight,
                    m.import_source,
                    m.original_filename
                FROM personal_materials m
                LEFT JOIN channels c ON m.channel_id = c.id
                {where_sql}
                ORDER BY m.created_at DESC
                LIMIT :limit
            """)
            
            result = db.execute(sql, params)
            
            return [
                {
                    "id": row.id,
                    "content": row.content,
                    "material_type": row.material_type,
                    "channel_id": row.channel_id,
                    "channel_slug": row.channel_slug,
                    "tags": row.tags,
                    "source": row.source,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "style_tags": row.style_tags or [],
                    "quality_weight": row.quality_weight,
                    "import_source": row.import_source,
                    "original_filename": row.original_filename
                }
                for row in result
            ]
        finally:
            db.close()
    
    def create_material(
        self,
        content: str,
        material_type: str,
        channel_slug: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source: Optional[str] = None,
        style_tags: Optional[List[str]] = None,
        quality_weight: Optional[int] = 3,
        import_source: Optional[str] = "manual",
        original_filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        创建新素材
        
        Args:
            content: 素材内容
            material_type: 素材类型（专业资料/实操案例/心得复盘/学员反馈/其他）
            channel_slug: 归属频道
            tags: 关键词标签
            source: 素材来源
            style_tags: 风格标签（样文专用）
            quality_weight: 质量权重 1-5（样文专用）
            import_source: 导入来源（manual/file/url）
            original_filename: 原始文件名
        """
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
                embedding=None,  # 需要后续调用 embedding 接口
                style_tags=style_tags or [],
                quality_weight=quality_weight,
                import_source=import_source,
                original_filename=original_filename
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
                "created_at": material.created_at.isoformat() if material.created_at else None,
                "style_tags": material.style_tags or [],
                "quality_weight": material.quality_weight,
                "import_source": material.import_source,
                "original_filename": material.original_filename
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


    # ========================================================================
    # StyleSample 操作 (v3.5 - 独立表)
    # ========================================================================
    
    def get_style_samples_by_channel(self, channel_id: str) -> List[Dict[str, Any]]:
        """
        获取频道的所有标杆样文（从独立表）
        
        Args:
            channel_id: 频道 UUID 字符串
        """
        db = self.get_db()
        try:
            samples = db.query(StyleSample).filter(
                StyleSample.channel_id == channel_id
            ).order_by(StyleSample.created_at.desc()).all()
            
            return [
                {
                    "id": s.id,
                    "title": s.title,
                    "content": s.content,
                    "source": s.source,
                    "custom_tags": s.custom_tags or [],
                    "ai_suggested_tags": s.ai_suggested_tags or [],
                    "style_profile": s.style_profile,
                    "is_analyzed": s.is_analyzed,
                    "word_count": s.word_count,
                    "created_at": s.created_at,
                    "updated_at": s.updated_at
                }
                for s in samples
            ]
        except Exception as e:
            print(f"[WARN] 获取样文失败: {e}")
            return []
        finally:
            db.close()
    
    def get_style_sample_by_id(self, sample_id: str) -> Optional[Dict[str, Any]]:
        """获取单篇样文详情"""
        db = self.get_db()
        try:
            sample = db.query(StyleSample).filter(
                StyleSample.id == sample_id
            ).first()
            
            if not sample:
                return None
            
            return {
                "id": str(sample.id),
                "channel_id": str(sample.channel_id),
                "title": sample.title,
                "content": sample.content,
                "source": sample.source,
                "custom_tags": sample.custom_tags or [],
                "ai_suggested_tags": sample.ai_suggested_tags or [],
                "style_profile": sample.style_profile,
                "is_analyzed": sample.is_analyzed,
                "word_count": sample.word_count,
                "created_at": sample.created_at.isoformat() if sample.created_at else None,
                "updated_at": sample.updated_at.isoformat() if sample.updated_at else None
            }
        except Exception as e:
            print(f"[WARN] 获取样文详情失败: {e}")
            return None
        finally:
            db.close()
    
    def count_style_samples_by_channel(self, channel_id: str) -> int:
        """统计频道的样文数量"""
        db = self.get_db()
        try:
            count = db.query(StyleSample).filter(
                StyleSample.channel_id == channel_id
            ).count()
            return count
        except Exception as e:
            print(f"[WARN] 统计样文数量失败: {e}")
            return 0
        finally:
            db.close()
    
    def create_style_sample(
        self,
        id: str,
        channel_id: str,
        title: str,
        content: str,
        source: Optional[str] = None,
        custom_tags: Optional[List[str]] = None,
        ai_suggested_tags: Optional[List[str]] = None,
        style_profile: Optional[Dict[str, Any]] = None,
        is_analyzed: bool = False,
        word_count: Optional[int] = None
    ) -> bool:
        """
        创建新的标杆样文
        
        Args:
            id: 样文 UUID
            channel_id: 频道 UUID
            title: 样文标题
            content: 样文内容
            source: 来源说明
            custom_tags: 主编定义的标签
            ai_suggested_tags: AI 建议的标签
            style_profile: 6 维特征分析结果
            is_analyzed: 是否已分析
            word_count: 字数
        """
        db = self.get_db()
        try:
            sample = StyleSample(
                id=id,
                channel_id=channel_id,
                title=title,
                content=content,
                source=source,
                custom_tags=custom_tags or [],
                ai_suggested_tags=ai_suggested_tags or [],
                style_profile=style_profile,
                is_analyzed=is_analyzed,
                word_count=word_count or len(content)
            )
            
            db.add(sample)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 创建样文失败: {e}")
            return False
        finally:
            db.close()
    
    def update_style_sample(
        self,
        sample_id: str,
        title: Optional[str] = None,
        source: Optional[str] = None,
        custom_tags: Optional[List[str]] = None
    ) -> bool:
        """
        更新样文基本信息（标题、来源、自定义标签）
        """
        db = self.get_db()
        try:
            sample = db.query(StyleSample).filter(
                StyleSample.id == sample_id
            ).first()
            
            if not sample:
                return False
            
            if title is not None:
                sample.title = title
            if source is not None:
                sample.source = source
            if custom_tags is not None:
                sample.custom_tags = custom_tags
                flag_modified(sample, 'custom_tags')
            
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 更新样文失败: {e}")
            return False
        finally:
            db.close()
    
    def update_style_sample_analysis(
        self,
        sample_id: str,
        style_profile: Dict[str, Any],
        ai_suggested_tags: Optional[List[str]] = None
    ) -> bool:
        """
        更新样文的 6 维特征分析结果
        """
        db = self.get_db()
        try:
            sample = db.query(StyleSample).filter(
                StyleSample.id == sample_id
            ).first()
            
            if not sample:
                return False
            
            sample.style_profile = style_profile
            sample.is_analyzed = True
            flag_modified(sample, 'style_profile')
            
            if ai_suggested_tags is not None:
                sample.ai_suggested_tags = ai_suggested_tags
                flag_modified(sample, 'ai_suggested_tags')
            
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 更新样文分析失败: {e}")
            return False
        finally:
            db.close()
    
    def delete_style_sample(self, sample_id: str) -> bool:
        """删除标杆样文"""
        db = self.get_db()
        try:
            sample = db.query(StyleSample).filter(
                StyleSample.id == sample_id
            ).first()
            
            if not sample:
                return False
            
            db.delete(sample)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"[ERROR] 删除样文失败: {e}")
            return False
        finally:
            db.close()
    
    def get_style_samples_for_matching(
        self,
        channel_id: str,
        keywords: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        获取样文用于智能匹配 (Step 5 Smart Match)
        
        返回包含 custom_tags 和 style_profile 的样文列表
        """
        db = self.get_db()
        try:
            samples = db.query(StyleSample).filter(
                StyleSample.channel_id == channel_id,
                StyleSample.is_analyzed == True  # 只返回已分析的样文
            ).all()
            
            result = []
            for s in samples:
                # 计算匹配分数（如果提供了关键词）
                match_score = 0
                matched_tags = []
                
                if keywords and s.custom_tags:
                    for tag in s.custom_tags:
                        for kw in keywords:
                            if kw in tag or tag.replace('#', '') in kw:
                                match_score += 10  # custom_tags 权重最高
                                matched_tags.append(tag)
                                break
                
                # 从 style_profile 中提取特征关键词
                if keywords and s.style_profile:
                    profile_keywords = []
                    
                    # 提取高频词
                    if s.style_profile.get('expressions', {}).get('high_freq_words'):
                        profile_keywords.extend(s.style_profile['expressions']['high_freq_words'])
                    
                    # 提取特色短语
                    if s.style_profile.get('expressions', {}).get('characteristic_phrases'):
                        profile_keywords.extend(s.style_profile['expressions']['characteristic_phrases'])
                    
                    for pk in profile_keywords:
                        for kw in keywords:
                            if kw in pk or pk in kw:
                                match_score += 2  # 特征关键词权重较低
                                break
                
                result.append({
                    "id": str(s.id),
                    "title": s.title,
                    "content": s.content,  # 保存完整内容，用于任务详情页查看
                    "source": s.source,
                    "custom_tags": s.custom_tags or [],
                    "ai_suggested_tags": s.ai_suggested_tags or [],
                    "style_profile": s.style_profile,
                    "word_count": s.word_count,
                    "match_score": match_score,
                    "matched_tags": matched_tags
                })
            
            # 按匹配分数降序排列
            result.sort(key=lambda x: x['match_score'], reverse=True)
            
            return result
        except Exception as e:
            print(f"[WARN] 获取匹配样文失败: {e}")
            return []
        finally:
            db.close()


# 全局数据库服务实例
db_service = DatabaseService()

