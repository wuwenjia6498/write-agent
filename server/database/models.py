# -*- coding: utf-8 -*-
"""
数据库模型定义
老约翰自动化写作AGENT 核心数据表

包含以下核心表：
- channels: 内容频道表
- brand_assets: 品牌全局资产表  
- personal_materials: 个人素材库 (支持向量检索)
- writing_tasks: 写作任务流表
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Text, DateTime, Integer, 
    ForeignKey, Index, Enum, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import Vector

# 声明基类
Base = declarative_base()


# ============================================================================
# A. channels (内容频道表)
# 用于管理"深度阅读"、"绘本"、"育儿"等频道配置
# ============================================================================
class Channel(Base):
    """
    内容频道表
    
    每个频道代表一个垂直内容领域，具有独立的：
    - 读者画像 (description)
    - AI 写作人格 (system_prompt)
    - 样文参考 (style_guide_refs)
    
    Attributes:
        id: 唯一标识 (UUID)
        name: 频道名称 (如：深度阅读)
        slug: 频道标识符 (如：deep_reading)，用于 URL 和 API
        description: 读者画像与核心目标定义
        system_prompt: 该频道的专用 AI 写作指令 (JSONB 格式，支持复杂结构)
        style_guide_refs: 关联的样文路径或 ID (JSONB 数组)
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    __tablename__ = "channels"
    
    # 主键：UUID 类型，自动生成
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        comment="频道唯一标识"
    )
    
    # 频道基本信息
    name = Column(
        String(100), 
        nullable=False, 
        unique=True,
        comment="频道名称，如：深度阅读（小学段）"
    )
    
    slug = Column(
        String(50), 
        nullable=False, 
        unique=True,
        index=True,
        comment="频道标识符，用于 URL，如：deep_reading"
    )
    
    description = Column(
        Text, 
        nullable=True,
        comment="读者画像与核心目标定义"
    )
    
    # AI 写作配置 (使用 JSONB 支持复杂结构)
    system_prompt = Column(
        JSONB, 
        nullable=True,
        comment="频道专用 AI 写作指令，包含 role、writing_style、tone_guidelines 等"
    )
    
    # 样文参考 (JSONB 数组)
    style_guide_refs = Column(
        JSONB, 
        nullable=True,
        default=list,
        comment="关联的样文路径或 ID 列表"
    )
    
    # 频道特定规则
    channel_rules = Column(
        JSONB,
        nullable=True,
        comment="频道特定规则，包含 must_do 和 must_not_do"
    )
    
    # 频道屏蔽词
    blocked_phrases = Column(
        JSONB,
        nullable=True,
        default=list,
        comment="频道屏蔽词列表"
    )
    
    # 素材标签
    material_tags = Column(
        JSONB,
        nullable=True,
        default=list,
        comment="频道素材标签列表"
    )
    
    # 目标读者
    target_audience = Column(
        Text,
        nullable=True,
        comment="目标读者描述"
    )
    
    # 品牌人格
    brand_personality = Column(
        Text,
        nullable=True,
        comment="品牌人格描述"
    )
    
    # 状态与时间戳
    is_active = Column(
        Boolean, 
        default=True,
        comment="是否启用该频道"
    )
    
    created_at = Column(
        DateTime, 
        default=datetime.utcnow,
        comment="创建时间"
    )
    
    updated_at = Column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        comment="最后更新时间"
    )
    
    # 关系：一个频道有多个写作任务
    writing_tasks = relationship("WritingTask", back_populates="channel")
    
    # 关系：一个频道有多个素材
    materials = relationship("PersonalMaterial", back_populates="channel")
    
    def __repr__(self):
        return f"<Channel(id={self.id}, name='{self.name}', slug='{self.slug}')>"


# ============================================================================
# B. brand_assets (品牌全局资产表)
# 存储品牌灵魂资料，采用 Key-Value 结构以便扩展
# ============================================================================
class BrandAsset(Base):
    """
    品牌全局资产表
    
    存储品牌的核心资产，采用 Key-Value 结构便于灵活扩展。
    
    典型 asset_key 包括：
    - personal_intro: 个人简介/品牌介绍
    - blocking_words: 屏蔽词库配置
    - core_values: 核心价值观
    - writing_principles: 写作原则
    
    Attributes:
        asset_key: 标识符，作为主键
        content: 具体的文本内容（支持 Markdown 格式）
        content_type: 内容类型 (text/json/markdown)
        description: 资产描述
        last_updated: 最后更新时间
    """
    __tablename__ = "brand_assets"
    
    # 主键：使用 asset_key 作为主键，便于直接查询
    asset_key = Column(
        String(100), 
        primary_key=True,
        comment="资产标识符，如：personal_intro, blocking_words, core_values"
    )
    
    # 资产内容
    content = Column(
        Text, 
        nullable=False,
        comment="具体的文本内容，支持 Markdown 格式"
    )
    
    # 内容类型（便于前端渲染和后端解析）
    content_type = Column(
        String(20),
        default="markdown",
        comment="内容类型：text/json/markdown"
    )
    
    # 资产描述
    description = Column(
        String(500),
        nullable=True,
        comment="资产用途说明"
    )
    
    # 时间戳
    last_updated = Column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        comment="最后更新时间"
    )
    
    created_at = Column(
        DateTime, 
        default=datetime.utcnow,
        comment="创建时间"
    )
    
    def __repr__(self):
        return f"<BrandAsset(asset_key='{self.asset_key}')>"


# ============================================================================
# C. personal_materials (个人素材库 - 核心 RAG 表)
# 存储 15 年来的"人味碎片"，支持向量检索
# ============================================================================

# 素材类型枚举
MATERIAL_TYPES = ["金句", "案例", "反馈", "感悟", "其他"]


class PersonalMaterial(Base):
    """
    个人素材库表 (核心 RAG 表)
    
    存储 15 年来积累的"人味碎片"，支持向量语义检索。
    
    关键设计：
    1. channel_id 为 NULL 时表示全频道通用
    2. embedding 字段存储 1536 维向量（兼容 OpenAI embeddings）
    3. 查询时必须带 channel_id 过滤，防止跨频道污染
    
    Attributes:
        id: 唯一标识 (UUID)
        content: 原始素材文本
        channel_id: 归属频道 (外键，NULL 表示全频道通用)
        material_type: 类型（金句/案例/反馈/感悟）
        embedding: 向量字段 (pgvector 存储 1536 维向量)
        tags: 关键词标签 (JSONB 格式)
        source: 素材来源
        created_at: 创建时间
    """
    __tablename__ = "personal_materials"
    
    # 主键
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        comment="素材唯一标识"
    )
    
    # 素材内容
    content = Column(
        Text, 
        nullable=False,
        comment="原始素材文本，如：揉馒头感悟、课堂金句等"
    )
    
    # 所属频道 (外键，NULL 表示全频道通用)
    channel_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("channels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="归属频道ID，NULL 表示全频道通用"
    )
    
    # 素材类型
    material_type = Column(
        String(20),
        nullable=False,
        default="其他",
        comment="素材类型：金句/案例/反馈/感悟/其他"
    )
    
    # 向量嵌入字段 (pgvector，1536 维度 - 兼容 OpenAI embeddings)
    embedding = Column(
        Vector(1536),
        nullable=True,
        comment="语义向量，用于相似度检索"
    )
    
    # 标签 (JSONB 数组)
    tags = Column(
        JSONB,
        nullable=True,
        default=list,
        comment="关键词标签列表，如：['整本书阅读', '思考力']"
    )
    
    # 素材来源
    source = Column(
        String(200),
        nullable=True,
        comment="素材来源，如：2024年春季课堂"
    )
    
    # 时间戳
    created_at = Column(
        DateTime, 
        default=datetime.utcnow,
        comment="创建时间"
    )
    
    updated_at = Column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        comment="更新时间"
    )
    
    # 关系
    channel = relationship("Channel", back_populates="materials")
    
    # 创建索引：向量相似度搜索索引 (使用 ivfflat 或 hnsw)
    __table_args__ = (
        # 复合索引：channel_id + material_type，用于带频道过滤的查询
        Index("ix_materials_channel_type", "channel_id", "material_type"),
    )
    
    def __repr__(self):
        return f"<PersonalMaterial(id={self.id}, type='{self.material_type}')>"


# ============================================================================
# D. writing_tasks (写作任务流表)
# 记录 9 步 SOP 的全过程状态
# ============================================================================

# 任务状态枚举
TASK_STATUSES = [
    "draft",           # 草稿，刚创建
    "processing",      # 处理中
    "waiting_confirm", # 等待用户确认（S3选题、S6数据就绪）
    "completed",       # 已完成
    "cancelled"        # 已取消
]


class WritingTask(Base):
    """
    写作任务流表
    
    记录 9 步 SOP 的全过程状态，是整个系统的核心数据表。
    
    9 步 SOP 对应的数据存储：
    - S1 需求保存 → brief_data
    - S2 智能调研 → knowledge_base_data
    - S3 选题决策 → brief_data.selected_topic
    - S4 协作清单 → brief_data.collaboration_list
    - S5 素材注入 → brief_data.injected_materials
    - S6 挂起等待 → status = waiting_confirm
    - S7 初稿创作 → draft_content + think_aloud_logs
    - S8 三遍审校 → final_content
    - S9 配图方案 → brief_data.image_suggestions
    
    Attributes:
        id: 任务唯一 ID (UUID)
        channel_id: 所选频道 (外键)
        current_step: 当前步骤 (1-9 整数)
        status: 状态
        brief_data: 需求简报内容 (JSONB)
        knowledge_base_data: 调研结果
        draft_content: S7 生成的初稿
        final_content: S8 审校后的成稿
        think_aloud_logs: AI 思考过程记录
        created_at: 创建时间
        completed_at: 完成时间
    """
    __tablename__ = "writing_tasks"
    
    # 主键
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        comment="任务唯一标识"
    )
    
    # 所属频道 (外键)
    channel_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="所选频道ID"
    )
    
    # 任务标题（便于用户识别）
    title = Column(
        String(200),
        nullable=True,
        comment="任务标题，如：《窗边的小豆豆》阅读指南"
    )
    
    # 当前步骤 (1-9)
    current_step = Column(
        Integer,
        nullable=False,
        default=1,
        comment="当前所在步骤，1-9 对应 S1-S9"
    )
    
    # 任务状态
    status = Column(
        String(20),
        nullable=False,
        default="draft",
        index=True,
        comment="任务状态：draft/processing/waiting_confirm/completed/cancelled"
    )
    
    # S1: 需求简报数据 (JSONB，存储灵活的 Brief 内容)
    brief_data = Column(
        JSONB,
        nullable=True,
        default=dict,
        comment="需求简报及各步骤扩展数据"
    )
    
    # S2: 调研结果
    knowledge_base_data = Column(
        Text,
        nullable=True,
        comment="智能调研结果，支持 TEXT 或 JSON 格式"
    )
    
    # S7: 初稿内容
    draft_content = Column(
        Text,
        nullable=True,
        comment="S7 生成的初稿内容"
    )
    
    # S8: 审校后的最终稿
    final_content = Column(
        Text,
        nullable=True,
        comment="S8 三遍审校后的成稿"
    )
    
    # AI 思考过程记录 (Think Aloud)
    think_aloud_logs = Column(
        JSONB,
        nullable=True,
        default=list,
        comment="AI 思考过程记录，数组格式存储每步的思考日志"
    )
    
    # 时间戳
    created_at = Column(
        DateTime, 
        default=datetime.utcnow,
        comment="创建时间"
    )
    
    updated_at = Column(
        DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        comment="更新时间"
    )
    
    completed_at = Column(
        DateTime,
        nullable=True,
        comment="完成时间"
    )
    
    # 关系
    channel = relationship("Channel", back_populates="writing_tasks")
    
    # 索引
    __table_args__ = (
        # 复合索引：channel_id + status，用于列表查询
        Index("ix_tasks_channel_status", "channel_id", "status"),
        # 复合索引：channel_id + current_step，用于进度追踪
        Index("ix_tasks_channel_step", "channel_id", "current_step"),
    )
    
    def __repr__(self):
        return f"<WritingTask(id={self.id}, step={self.current_step}, status='{self.status}')>"


# ============================================================================
# 辅助函数：创建 pgvector 扩展和索引
# ============================================================================
def create_vector_extension(engine):
    """
    创建 pgvector 扩展（需要在创建表之前执行）
    
    Args:
        engine: SQLAlchemy 引擎
    """
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()


def create_vector_index(engine):
    """
    为 personal_materials.embedding 创建向量索引
    使用 ivfflat 索引加速相似度搜索
    
    Args:
        engine: SQLAlchemy 引擎
    """
    from sqlalchemy import text
    with engine.connect() as conn:
        # 创建 ivfflat 索引（适合中等规模数据）
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_materials_embedding 
            ON personal_materials 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        """))
        conn.commit()

