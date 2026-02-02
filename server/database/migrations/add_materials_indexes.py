# -*- coding: utf-8 -*-
"""
数据库迁移脚本：添加 personal_materials 表索引
用于优化素材列表查询性能
"""

import sys
from pathlib import Path

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from database.config import engine


def add_materials_indexes():
    """
    为 personal_materials 表添加性能索引
    """
    print("[MIGRATION] 开始添加 personal_materials 表索引...")
    
    indexes = [
        # channel_id 索引（用于频道筛选和 JOIN）
        {
            "name": "idx_materials_channel_id",
            "sql": "CREATE INDEX IF NOT EXISTS idx_materials_channel_id ON personal_materials (channel_id);"
        },
        # material_type 索引（用于类型筛选）
        {
            "name": "idx_materials_type",
            "sql": "CREATE INDEX IF NOT EXISTS idx_materials_type ON personal_materials (material_type);"
        },
        # created_at 索引（用于排序）
        {
            "name": "idx_materials_created_at",
            "sql": "CREATE INDEX IF NOT EXISTS idx_materials_created_at ON personal_materials (created_at DESC);"
        },
        # 联合索引：channel_id + created_at（用于频道筛选+排序）
        {
            "name": "idx_materials_channel_created",
            "sql": "CREATE INDEX IF NOT EXISTS idx_materials_channel_created ON personal_materials (channel_id, created_at DESC);"
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
            
        print("\n[SUCCESS] 素材索引迁移完成！")
        return True
        
    except Exception as e:
        print(f"   [ERROR] 迁移失败: {e}")
        return False


if __name__ == "__main__":
    add_materials_indexes()
