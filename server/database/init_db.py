# -*- coding: utf-8 -*-
"""
数据库初始化脚本
创建所有表结构并导入初始数据（从现有 JSON 配置迁移）
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

# 添加 server 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from database.config import engine, SessionLocal
from database.models import (
    Base, Channel, BrandAsset, PersonalMaterial,
    create_vector_extension, create_vector_index
)


def init_database():
    """
    初始化数据库：
    1. 创建 pgvector 扩展
    2. 创建所有表
    3. 创建向量索引
    """
    print("[START] 开始初始化数据库...")
    
    # Step 1: 创建 pgvector 扩展
    print("[1/3] 创建 pgvector 扩展...")
    try:
        create_vector_extension(engine)
        print("   [OK] pgvector 扩展已创建")
    except Exception as e:
        print(f"   [WARN] pgvector 扩展创建失败（可能已存在）: {e}")
    
    # Step 2: 创建所有表
    print("[2/3] 创建数据库表...")
    Base.metadata.create_all(bind=engine)
    print("   [OK] 所有表已创建")
    
    # Step 3: 创建向量索引
    print("[3/3] 创建向量索引...")
    try:
        create_vector_index(engine)
        print("   [OK] 向量索引已创建")
    except Exception as e:
        print(f"   [WARN] 向量索引创建失败: {e}")
    
    print("\n[DONE] 数据库初始化完成！")


def migrate_channels_from_json():
    """
    从现有的 JSON 配置文件迁移频道数据到数据库
    """
    print("\n[MIGRATE] 开始迁移频道配置...")
    
    # 配置文件目录
    configs_dir = Path(__file__).parent.parent / "configs" / "channels"
    
    if not configs_dir.exists():
        print(f"   [WARN] 配置目录不存在: {configs_dir}")
        return
    
    db = SessionLocal()
    try:
        # 遍历所有 JSON 配置文件
        for json_file in configs_dir.glob("*.json"):
            print(f"   处理: {json_file.name}")
            
            with open(json_file, "r", encoding="utf-8") as f:
                config = json.load(f)
            
            # 检查是否已存在
            slug = config.get("channel_id", json_file.stem)
            existing = db.query(Channel).filter(Channel.slug == slug).first()
            
            if existing:
                print(f"      [SKIP] 频道 '{slug}' 已存在")
                continue
            
            # 创建新频道
            channel = Channel(
                name=config.get("channel_name", slug),
                slug=slug,
                description=config.get("description", "") + "\n" + 
                           f"目标受众: {config.get('target_audience', '')}\n" +
                           f"品牌调性: {config.get('brand_personality', '')}",
                system_prompt=config.get("system_prompt"),
                style_guide_refs=config.get("sample_articles", []),
                channel_rules={
                    "must_do": config.get("channel_specific_rules", {}).get("must_do", []),
                    "must_not_do": config.get("channel_specific_rules", {}).get("must_not_do", []),
                    "blocked_phrases": config.get("blocked_phrases", []),
                    "material_tags": config.get("material_tags", [])
                },
                is_active=True
            )
            
            db.add(channel)
            print(f"      [OK] 已创建频道: {channel.name}")
        
        db.commit()
        print("   [OK] 频道配置迁移完成")
        
    except Exception as e:
        db.rollback()
        print(f"   [ERROR] 迁移失败: {e}")
        raise
    finally:
        db.close()


def migrate_blocked_words_from_json():
    """
    从 Markdown 配置文件迁移屏蔽词库到 brand_assets 表
    优先使用 Markdown 格式（更易编辑），备选 JSON 格式
    """
    print("\n[MIGRATE] 开始迁移屏蔽词库...")
    
    # 优先使用 Markdown 格式
    blocked_words_md = Path(__file__).parent.parent / "configs" / "global" / "blocked_words.md"
    blocked_words_json = Path(__file__).parent.parent / "configs" / "global" / "blocked_words.json"
    
    # 选择配置文件
    if blocked_words_md.exists():
        blocked_words_file = blocked_words_md
        content_type = "markdown"
        print(f"   [INFO] 使用 Markdown 格式: {blocked_words_file}")
    elif blocked_words_json.exists():
        blocked_words_file = blocked_words_json
        content_type = "json"
        print(f"   [INFO] 使用 JSON 格式: {blocked_words_file}")
    else:
        print(f"   [WARN] 屏蔽词文件不存在")
        return
    
    db = SessionLocal()
    try:
        # 检查是否已存在
        existing = db.query(BrandAsset).filter(
            BrandAsset.asset_key == "blocking_words"
        ).first()
        
        if existing:
            print("   [SKIP] blocking_words 已存在")
            return
        
        # 读取内容
        with open(blocked_words_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        # 创建 brand_asset
        asset = BrandAsset(
            asset_key="blocking_words",
            content=content,
            content_type=content_type,
            description="全局屏蔽词库 - 用于去除AI腔调，提升内容真实感。在 S8 审校步骤使用。"
        )
        
        db.add(asset)
        db.commit()
        print(f"   [OK] 屏蔽词库迁移完成 (格式: {content_type})")
        
    except Exception as e:
        db.rollback()
        print(f"   [ERROR] 迁移失败: {e}")
        raise
    finally:
        db.close()


def seed_brand_assets():
    """
    填充品牌资产的初始数据
    """
    print("\n[SEED] 填充品牌资产初始数据...")
    
    db = SessionLocal()
    try:
        # 定义初始资产
        initial_assets = [
            {
                "asset_key": "personal_intro",
                "content": """# 老约翰儿童阅读品牌简介

老约翰儿童阅读，深耕儿童阅读推广15年。

我们相信：
- 阅读是打开世界的钥匙
- 每个孩子都值得被优质内容滋养
- 陪伴比教导更重要

我们的使命是让每一个孩子都能在阅读中找到乐趣和成长。
""",
                "content_type": "markdown",
                "description": "品牌个人简介，用于写作时注入品牌调性"
            },
            {
                "asset_key": "core_values",
                "content": """# 核心价值观

1. **真实至上**：不编造虚假案例，所有故事必须基于真实经历
2. **尊重读者**：用平等姿态对话，不居高临下
3. **有温度的专业**：专业但不冷冰，有深度但不晦涩
4. **去工业化**：拒绝AI腔，追求"人味"表达
5. **长期主义**：不追热点，专注深度内容
""",
                "content_type": "markdown",
                "description": "品牌核心价值观，指导所有写作方向"
            },
            {
                "asset_key": "writing_principles",
                "content": """# 写作原则

## 语言风格
- 短句优先，长句拆分
- 少用"的地得"叠加
- 禁用套话和废话

## 结构要求
- 开头直入主题，不要绕弯
- 每段不超过200字
- 用具体案例说明观点

## 禁忌清单
- 不说"干货"、"必看"、"收藏"
- 不用"首先、其次、最后"这类程式化结构
- 不制造焦虑
""",
                "content_type": "markdown",
                "description": "写作原则指南，确保输出风格统一"
            }
        ]
        
        for asset_data in initial_assets:
            # 检查是否已存在
            existing = db.query(BrandAsset).filter(
                BrandAsset.asset_key == asset_data["asset_key"]
            ).first()
            
            if existing:
                print(f"   [SKIP] {asset_data['asset_key']} 已存在")
                continue
            
            asset = BrandAsset(**asset_data)
            db.add(asset)
            print(f"   [OK] 已创建: {asset_data['asset_key']}")
        
        db.commit()
        print("   [OK] 品牌资产填充完成")
        
    except Exception as e:
        db.rollback()
        print(f"   [ERROR] 填充失败: {e}")
        raise
    finally:
        db.close()


def seed_sample_materials():
    """
    填充示例素材数据（用于演示和测试）
    """
    print("\n[SEED] 填充示例素材数据...")
    
    db = SessionLocal()
    try:
        # 获取深度阅读频道
        channel = db.query(Channel).filter(Channel.slug == "deep_reading").first()
        
        if not channel:
            print("   [WARN] 未找到 deep_reading 频道，跳过素材填充")
            return
        
        # 示例素材
        sample_materials = [
            {
                "content": "那天在课堂上，一个三年级的孩子读完《夏洛的网》后说：'老师，夏洛死的时候，我哭了。但我又觉得它没有真的死，因为它的孩子们还在。'这个孩子用自己的方式理解了生命的延续。",
                "material_type": "案例",
                "tags": ["夏洛的网", "生命教育", "课堂实录", "三年级"],
                "source": "2024年春季阅读课"
            },
            {
                "content": "阅读不是为了让孩子变得多么'厉害'，而是让他在未来遇到困难时，能想起某本书里的某个人物，然后对自己说：'我也可以的。'",
                "material_type": "金句",
                "tags": ["阅读价值", "教育理念"],
                "source": "家长会分享"
            },
            {
                "content": "有家长问我：'孩子只爱看漫画，不看文字书怎么办？'我说：'那就先看漫画啊。《父与子》看完了，自然会想知道更多故事。阅读兴趣，不是逼出来的。'",
                "material_type": "反馈",
                "tags": ["阅读兴趣", "漫画", "家长沟通"],
                "source": "微信家长群"
            },
            {
                "content": "教孩子读书，就像揉馒头。你得等面醒好了，才能揉。揉早了，馒头硬；揉晚了，面又塌了。时机很重要，急不得。",
                "material_type": "感悟",
                "tags": ["教育比喻", "阅读节奏", "揉馒头"],
                "source": "个人随笔"
            }
        ]
        
        for mat_data in sample_materials:
            # 检查是否已存在相似内容（简单判断）
            existing = db.query(PersonalMaterial).filter(
                PersonalMaterial.content.like(f"%{mat_data['content'][:50]}%")
            ).first()
            
            if existing:
                print(f"   [SKIP] 相似素材已存在")
                continue
            
            material = PersonalMaterial(
                content=mat_data["content"],
                channel_id=channel.id,
                material_type=mat_data["material_type"],
                tags=mat_data["tags"],
                source=mat_data.get("source"),
                embedding=None  # 向量需要后续通过 AI 服务生成
            )
            
            db.add(material)
            print(f"   [OK] 已创建素材: [{mat_data['material_type']}] {mat_data['content'][:30]}...")
        
        db.commit()
        print("   [OK] 示例素材填充完成")
        
    except Exception as e:
        db.rollback()
        print(f"   [ERROR] 填充失败: {e}")
        raise
    finally:
        db.close()


def run_full_migration():
    """
    执行完整的数据库初始化和数据迁移
    """
    print("=" * 60)
    print("  Old John Writing Agent - Database Init Tool")
    print("=" * 60)
    
    # 1. 初始化数据库结构
    init_database()
    
    # 2. 迁移频道配置
    migrate_channels_from_json()
    
    # 3. 迁移屏蔽词库
    migrate_blocked_words_from_json()
    
    # 4. 填充品牌资产
    seed_brand_assets()
    
    # 5. 填充示例素材
    seed_sample_materials()
    
    print("\n" + "=" * 60)
    print("  [SUCCESS] All migrations completed!")
    print("=" * 60)
    
    # 打印统计信息
    db = SessionLocal()
    try:
        channel_count = db.query(Channel).count()
        asset_count = db.query(BrandAsset).count()
        material_count = db.query(PersonalMaterial).count()
        
        print(f"\n[STATS] Data Summary:")
        print(f"   - Channels: {channel_count}")
        print(f"   - Brand Assets: {asset_count}")
        print(f"   - Materials: {material_count}")
    finally:
        db.close()


if __name__ == "__main__":
    run_full_migration()
