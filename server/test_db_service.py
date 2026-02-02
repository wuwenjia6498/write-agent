# -*- coding: utf-8 -*-
"""
测试数据库服务
"""

from services.db_service import db_service

def test_db_service():
    """测试数据库服务各项功能"""
    
    print("[INFO] 测试数据库服务...")
    
    try:
        # 1. 测试获取频道列表
        print("\n[TEST 1] 获取所有频道...")
        channels = db_service.get_all_channels()
        print(f"[SUCCESS] 找到 {len(channels)} 个频道：")
        for ch in channels:
            print(f"  - {ch['name']} ({ch['slug']})")
        
        # 2. 测试获取品牌资产
        print("\n[TEST 2] 获取品牌资产...")
        blocking_words = db_service.get_blocking_words()
        if blocking_words:
            print(f"[SUCCESS] 找到屏蔽词库，共 {len(blocking_words)} 字符")
        else:
            print("[WARN] 未找到屏蔽词库")
        
        # 3. 测试获取任务列表
        print("\n[TEST 3] 获取任务列表...")
        tasks = db_service.get_all_tasks(limit=5)
        print(f"[SUCCESS] 找到 {len(tasks)} 个任务")
        
        # 4. 测试获取素材列表
        print("\n[TEST 4] 获取素材列表...")
        materials = db_service.get_all_materials(limit=5)
        print(f"[SUCCESS] 找到 {len(materials)} 个素材")
        
        print("\n[SUCCESS] 所有数据库服务测试通过！")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_db_service()
