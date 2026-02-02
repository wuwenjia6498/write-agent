# -*- coding: utf-8 -*-
"""
测试数据库连接
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# 加载环境变量
load_dotenv()

def test_db_connection():
    """测试数据库连接"""
    
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("[ERROR] 未找到 DATABASE_URL 环境变量")
        return False
    
    print(f"[INFO] 数据库连接地址：{database_url[:50]}...")
    
    try:
        # 创建数据库引擎
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            connect_args={
                "connect_timeout": 10
            }
        )
        
        # 尝试连接
        print("\n[INFO] 正在尝试连接数据库...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"[SUCCESS] 数据库连接成功！")
            print(f"[INFO] PostgreSQL 版本：{version}")
            
            # 检查是否有 pgvector 扩展
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                )
            """))
            has_pgvector = result.fetchone()[0]
            
            if has_pgvector:
                print("[SUCCESS] pgvector 扩展已安装")
            else:
                print("[WARN] pgvector 扩展未安装")
            
            # 检查表是否存在
            print("\n[INFO] 检查数据库表...")
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            
            if tables:
                print(f"[SUCCESS] 找到 {len(tables)} 个表：")
                for table in tables:
                    print(f"   - {table}")
            else:
                print("[WARN] 数据库中没有表，需要运行数据库初始化脚本")
                return False
            
            return True
            
    except Exception as e:
        print(f"\n[ERROR] 数据库连接失败：{e}")
        print(f"\n[INFO] 可能的原因：")
        print("   1. 数据库地址或密码错误")
        print("   2. 网络连接问题")
        print("   3. Supabase 连接池配置问题")
        print("   4. 防火墙阻止连接")
        return False

if __name__ == "__main__":
    success = test_db_connection()
    sys.exit(0 if success else 1)
