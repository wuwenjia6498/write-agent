# -*- coding: utf-8 -*-
"""
数据库迁移脚本：添加 channels 表索引
用于优化频道列表查询性能
"""

import sys
from pathlib import Path

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from database.config import engine


def add_channels_indexes():
    """
    为 channels 表添加性能索引
    """
    print("[MIGRATION] 开始添加 channels 表索引...")
    
    indexes = [
        # is_active 索引（用于筛选活跃频道）
        {
            "name": "idx_channels_is_active",
            "sql": "CREATE INDEX IF NOT EXISTS idx_channels_is_active ON channels (is_active);"
        },
        # slug 索引（用于按 slug 查询，可能已存在）
        {
            "name": "idx_channels_slug",
            "sql": "CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels (slug);"
        },
        # 联合索引：is_active + created_at（用于排序查询）
        {
            "name": "idx_channels_active_created",
            "sql": "CREATE INDEX IF NOT EXISTS idx_channels_active_created ON channels (is_active, created_at);"
        }
    ]
    
    try:
        with engine.connect() as conn:
            for index_def in indexes:
                try:
                    conn.execute(text(index_def["sql"]))
                    print(f"   [OK] 索引 {index_def['name']} 创建成功")
                except Exception as e:
                    print(f"   [WARN] 索引 {index_def['name']} 创建失败: {e}")
            
            conn.commit()
            
        print("\n[SUCCESS] 频道索引迁移完成！")
        return True
        
    except Exception as e:
        print(f"   [ERROR] 迁移失败: {e}")
        return False


if __name__ == "__main__":
    add_channels_indexes()
