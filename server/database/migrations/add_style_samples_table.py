# -*- coding: utf-8 -*-
"""
迁移脚本：创建 style_samples 独立表
v3.5 升级 - 样文矩阵与自定义标签系统

功能：
1. 创建 style_samples 独立表
2. 从 Channel.style_samples (JSONB) 迁移现有数据
3. 添加预设行业标签

运行方式：
    python -m database.migrations.add_style_samples_table
"""

import os
import sys
import uuid
import json
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from database.config import engine, SessionLocal
from database.models import Base, Channel, StyleSample


# 预设的行业标签（初始集）
DEFAULT_INDUSTRY_TAGS = [
    "#绘本解析",
    "#整本书阅读",
    "#深度精读",
    "#主题书单",
    "#理性专业"
]


def run_migration():
    """执行迁移"""
    print("=" * 60)
    print("开始迁移：创建 style_samples 独立表")
    print("=" * 60)
    
    with engine.connect() as conn:
        # ================================================================
        # Step 1: 创建新表（如果不存在）
        # ================================================================
        print("\n[Step 1] 创建 style_samples 表...")
        
        # 检查表是否已存在
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'style_samples'
            )
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            # 创建表
            conn.execute(text("""
                CREATE TABLE style_samples (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NOT NULL,
                    source VARCHAR(200),
                    custom_tags JSONB DEFAULT '[]'::jsonb,
                    ai_suggested_tags JSONB DEFAULT '[]'::jsonb,
                    style_profile JSONB,
                    is_analyzed BOOLEAN DEFAULT FALSE,
                    word_count INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # 创建索引
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_style_samples_channel 
                ON style_samples(channel_id)
            """))
            
            conn.commit()
            print("  [OK] style_samples 表创建成功")
        else:
            print("  - style_samples 表已存在，跳过创建")
            
            # 检查并添加可能缺失的列
            columns_to_check = [
                ("custom_tags", "JSONB DEFAULT '[]'::jsonb"),
                ("ai_suggested_tags", "JSONB DEFAULT '[]'::jsonb"),
                ("is_analyzed", "BOOLEAN DEFAULT FALSE"),
                ("word_count", "INTEGER")
            ]
            
            for col_name, col_def in columns_to_check:
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'style_samples' AND column_name = '{col_name}'
                    )
                """))
                if not result.scalar():
                    print(f"  + 添加缺失列: {col_name}")
                    conn.execute(text(f"ALTER TABLE style_samples ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
        
        # ================================================================
        # Step 2: 从 Channel.style_samples 迁移数据
        # ================================================================
        print("\n[Step 2] 迁移现有样文数据...")
        
        # 获取所有频道
        result = conn.execute(text("""
            SELECT id, slug, style_samples 
            FROM channels 
            WHERE style_samples IS NOT NULL AND style_samples != '[]'::jsonb
        """))
        channels = result.fetchall()
        
        migrated_count = 0
        for channel_id, channel_slug, old_samples in channels:
            if not old_samples:
                continue
                
            print(f"\n  处理频道: {channel_slug}")
            
            for sample in old_samples:
                # 检查是否已迁移
                existing = conn.execute(text("""
                    SELECT id FROM style_samples 
                    WHERE channel_id = :channel_id AND title = :title
                """), {"channel_id": channel_id, "title": sample.get("title", "")})
                
                if existing.fetchone():
                    print(f"    - 跳过已存在: {sample.get('title', 'Untitled')[:30]}")
                    continue
                
                # 插入新记录
                sample_id = sample.get("id") or str(uuid.uuid4())
                title = sample.get("title", "无标题")
                content = sample.get("content", "")
                source = sample.get("source", "")
                features = sample.get("features", {})
                
                # 计算字数
                word_count = len(content) if content else 0
                
                # 检查是否已分析
                is_analyzed = bool(features)
                
                # 准备 JSONB 数据
                style_profile_json = json.dumps(features) if features else None
                custom_tags_json = json.dumps([])
                
                conn.execute(text("""
                    INSERT INTO style_samples 
                    (id, channel_id, title, content, source, style_profile, is_analyzed, word_count, custom_tags)
                    VALUES 
                    (:id, :channel_id, :title, :content, :source, 
                     CAST(:style_profile AS jsonb), :is_analyzed, :word_count, CAST(:custom_tags AS jsonb))
                """), {
                    "id": sample_id,
                    "channel_id": channel_id,
                    "title": title,
                    "content": content,
                    "source": source,
                    "style_profile": style_profile_json,
                    "is_analyzed": is_analyzed,
                    "word_count": word_count,
                    "custom_tags": custom_tags_json
                })
                
                migrated_count += 1
                print(f"    [OK] 迁移: {title[:30]}...")
        
        conn.commit()
        print(f"\n  共迁移 {migrated_count} 篇样文")
        
        # ================================================================
        # Step 3: 完成
        # ================================================================
        print("\n" + "=" * 60)
        print("迁移完成！")
        print("=" * 60)
        print(f"\n预设行业标签（可在 UI 中选择）：")
        for tag in DEFAULT_INDUSTRY_TAGS:
            print(f"  - {tag}")
        print("\n注意：原 Channel.style_samples 字段保留，可手动清理")


def rollback_migration():
    """回滚迁移（谨慎使用）"""
    print("警告：此操作将删除 style_samples 表及其所有数据！")
    confirm = input("确认回滚？输入 'YES' 继续: ")
    
    if confirm != "YES":
        print("取消回滚")
        return
    
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS style_samples CASCADE"))
        conn.commit()
        print("[OK] style_samples 表已删除")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="样文表迁移脚本")
    parser.add_argument("--rollback", action="store_true", help="回滚迁移")
    args = parser.parse_args()
    
    if args.rollback:
        rollback_migration()
    else:
        run_migration()
