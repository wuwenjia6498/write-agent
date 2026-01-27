"""
频道管理路由
负责频道配置的加载、切换和管理
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os
from pathlib import Path

router = APIRouter()

# 配置文件路径
CONFIGS_DIR = Path(__file__).parent.parent / "configs" / "channels"

class ChannelInfo(BaseModel):
    """频道基础信息"""
    channel_id: str
    channel_name: str
    description: str
    target_audience: str
    brand_personality: str

class ChannelConfig(BaseModel):
    """完整频道配置"""
    channel_id: str
    channel_name: str
    description: str
    target_audience: str
    brand_personality: str
    system_prompt: Dict[str, Any]
    sample_articles: List[str]
    material_tags: List[str]
    channel_specific_rules: Dict[str, List[str]]
    blocked_phrases: List[str]

def load_channel_config(channel_id: str) -> Dict[str, Any]:
    """加载频道配置文件"""
    config_file = CONFIGS_DIR / f"{channel_id}.json"
    
    if not config_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"频道配置文件不存在: {channel_id}"
        )
    
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"加载配置文件失败: {str(e)}"
        )

@router.get("/")
async def list_channels() -> List[ChannelInfo]:
    """
    获取所有可用频道列表
    """
    channels = []
    
    # 扫描配置目录
    for config_file in CONFIGS_DIR.glob("*.json"):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                channels.append(ChannelInfo(
                    channel_id=config["channel_id"],
                    channel_name=config["channel_name"],
                    description=config["description"],
                    target_audience=config["target_audience"],
                    brand_personality=config["brand_personality"]
                ))
        except Exception as e:
            print(f"警告: 加载 {config_file.name} 失败: {e}")
            continue
    
    return channels

@router.get("/{channel_id}")
async def get_channel_config(channel_id: str) -> ChannelConfig:
    """
    获取指定频道的完整配置
    
    Args:
        channel_id: 频道ID (deep_reading / picture_books / parenting)
    
    Returns:
        完整的频道配置信息
    """
    config = load_channel_config(channel_id)
    return ChannelConfig(**config)

@router.get("/{channel_id}/system-prompt")
async def get_system_prompt(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的 System Prompt
    用于初始化 AI 写作人格
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "channel_name": config["channel_name"],
        "system_prompt": config["system_prompt"]
    }

@router.get("/{channel_id}/samples")
async def get_sample_articles(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的样文路径列表
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "sample_articles": config["sample_articles"],
        "material_tags": config["material_tags"]
    }

@router.get("/{channel_id}/rules")
async def get_channel_rules(channel_id: str) -> Dict[str, Any]:
    """
    获取频道的特定规则和屏蔽词
    """
    config = load_channel_config(channel_id)
    return {
        "channel_id": channel_id,
        "channel_specific_rules": config["channel_specific_rules"],
        "blocked_phrases": config["blocked_phrases"]
    }

