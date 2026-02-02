# -*- coding: utf-8 -*-
"""
数据库迁移脚本：添加 knowledge_summary 字段
用于支持 Step 2 调研结论摘要功能
"""

import sys
from pathlib import Path

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from database.config import engine


def add_knowledge_summary_column():
    """
    为 writing_tasks 表添加 knowledge_summary 字段
    """
    print("[MIGRATION] 开始添加 knowledge_summary 字段...")
    
    # ALTER TABLE SQL
    alter_sql = text("""
        ALTER TABLE writing_tasks 
        ADD COLUMN IF NOT EXISTS knowledge_summary TEXT;
    """)
    
    # 添加列注释（PostgreSQL 语法）
    comment_sql = text("""
        COMMENT ON COLUMN writing_tasks.knowledge_summary IS '调研结论摘要（300字以内），用于快速概览';
    """)
    
    try:
        with engine.connect() as conn:
            # 执行 ALTER TABLE
            conn.execute(alter_sql)
            print("   [OK] knowledge_summary 字段添加成功")
            
            # 添加注释
            conn.execute(comment_sql)
            print("   [OK] 列注释添加成功")
            
            # 提交事务
            conn.commit()
            
        print("\n[SUCCESS] 迁移完成！")
        return True
        
    except Exception as e:
        print(f"   [ERROR] 迁移失败: {e}")
        return False


if __name__ == "__main__":
    add_knowledge_summary_column()

