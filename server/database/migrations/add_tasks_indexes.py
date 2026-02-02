# -*- coding: utf-8 -*-
"""
数据库迁移脚本：添加 writing_tasks 表索引
用于优化任务列表查询性能

优化项：
1. status 索引：加速状态筛选
2. created_at 索引：加速时间排序
3. 联合索引 (status, created_at)：加速带筛选的排序查询
"""

import sys
from pathlib import Path

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from database.config import engine


def add_tasks_indexes():
    """
    为 writing_tasks 表添加性能索引
    """
    print("[MIGRATION] 开始添加 writing_tasks 表索引...")
    
    # 索引定义列表
    indexes = [
        # 状态索引
        {
            "name": "idx_writing_tasks_status",
            "sql": "CREATE INDEX IF NOT EXISTS idx_writing_tasks_status ON writing_tasks (status);"
        },
        # 创建时间索引（降序，用于排序）
        {
            "name": "idx_writing_tasks_created_at",
            "sql": "CREATE INDEX IF NOT EXISTS idx_writing_tasks_created_at ON writing_tasks (created_at DESC);"
        },
        # 联合索引：状态 + 创建时间（用于带筛选的排序查询）
        {
            "name": "idx_writing_tasks_status_created",
            "sql": "CREATE INDEX IF NOT EXISTS idx_writing_tasks_status_created ON writing_tasks (status, created_at DESC);"
        },
        # channel_id 索引（用于 JOIN 和频道筛选）
        {
            "name": "idx_writing_tasks_channel_id",
            "sql": "CREATE INDEX IF NOT EXISTS idx_writing_tasks_channel_id ON writing_tasks (channel_id);"
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
            
            # 提交事务
            conn.commit()
            
        print("\n[SUCCESS] 索引迁移完成！")
        print("\n性能优化说明：")
        print("  - 状态筛选查询将使用 idx_writing_tasks_status")
        print("  - 时间排序查询将使用 idx_writing_tasks_created_at")
        print("  - 状态筛选+时间排序将使用 idx_writing_tasks_status_created")
        print("  - 频道关联查询将使用 idx_writing_tasks_channel_id")
        return True
        
    except Exception as e:
        print(f"   [ERROR] 迁移失败: {e}")
        return False


if __name__ == "__main__":
    add_tasks_indexes()
