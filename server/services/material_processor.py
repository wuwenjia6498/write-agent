# -*- coding: utf-8 -*-
"""
素材处理工具：去重与噪声过滤

功能说明：
1. 按 source 字段去重 - 同一来源保留相似度最高的素材
2. 按内容相似度去重 - 合并内容几乎完全重复的素材片段
3. 噪声过滤 - 剔除营销性脏数据（点击购买、加盟等）

设计原则：低计算开销，利用现有数据
"""

import re
from typing import List, Dict, Any


# ============================================================================
# 营销性脏数据模式列表
# ============================================================================
SPAM_PATTERNS = [
    # 购买引导
    r'点击购买', r'立即下单', r'立即购买', r'马上下单',
    r'限时优惠', r'限时特价', r'优惠券', r'满减',
    
    # 加盟/代理
    r'加盟', r'代理', r'招商', r'合作伙伴招募',
    
    # 社交引流
    r'扫码', r'添加微信', r'私信', r'关注公众号',
    r'微信[号]?[:：]?\s*\d{5,}', r'QQ[号]?[:：]?\s*\d{5,}',
    r'领取.*红包', r'免费领', r'0元领',
    
    # 链接引导
    r'点击链接', r'复制.*淘宝', r'下单.*优惠',
    r'戳.*链接', r'点击.*详情', r'查看.*原文',
    
    # 营销话术
    r'错过.*后悔', r'名额有限', r'仅限今天',
    r'最后.*机会', r'手慢无'
]

# 编译正则表达式（性能优化）
_SPAM_REGEX = re.compile('|'.join(SPAM_PATTERNS), re.IGNORECASE)


# ============================================================================
# 核心处理函数
# ============================================================================

def filter_spam_materials(materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    过滤营销性脏数据
    
    Args:
        materials: 素材列表
        
    Returns:
        过滤后的素材列表
    """
    filtered = []
    for mat in materials:
        content = mat.get('content', '')
        if not _SPAM_REGEX.search(content):
            filtered.append(mat)
        else:
            print(f"[材料过滤] 已过滤营销内容: {content[:50]}...")
    
    return filtered


def dedupe_by_source(materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    按来源去重，同一来源保留相似度/评分最高的素材
    
    Args:
        materials: 素材列表
        
    Returns:
        去重后的素材列表
    """
    if not materials:
        return []
    
    source_map: Dict[str, Dict[str, Any]] = {}
    
    for mat in materials:
        # 获取来源标识，无来源的用 ID 作为唯一标识
        source = mat.get('source') or mat.get('id') or 'unknown'
        score = mat.get('similarity', 0)
        
        if source not in source_map:
            source_map[source] = mat
        else:
            # 保留相似度更高的
            existing_score = source_map[source].get('similarity', 0)
            if score > existing_score:
                source_map[source] = mat
    
    result = list(source_map.values())
    
    if len(result) < len(materials):
        print(f"[来源去重] {len(materials)} -> {len(result)} 条素材")
    
    return result


def dedupe_by_content_similarity(
    materials: List[Dict[str, Any]], 
    threshold: float = 0.85
) -> List[Dict[str, Any]]:
    """
    基于内容相似度去重（低开销实现）
    
    使用 Jaccard 相似度判断文本重复，对于 N 条素材的复杂度为 O(N²)，
    在典型场景（N < 20）下性能可接受。
    
    Args:
        materials: 素材列表
        threshold: 相似度阈值，超过此值视为重复（默认 0.85）
        
    Returns:
        去重后的素材列表
    """
    if len(materials) <= 1:
        return materials
    
    result: List[Dict[str, Any]] = []
    
    for mat in materials:
        content = mat.get('content', '')
        is_duplicate = False
        
        for existing in result:
            existing_content = existing.get('content', '')
            sim = _calculate_jaccard_similarity(content, existing_content)
            
            if sim > threshold:
                is_duplicate = True
                # 如果新素材评分更高，替换旧素材
                if mat.get('similarity', 0) > existing.get('similarity', 0):
                    result.remove(existing)
                    result.append(mat)
                break
        
        if not is_duplicate:
            result.append(mat)
    
    if len(result) < len(materials):
        print(f"[内容去重] {len(materials)} -> {len(result)} 条素材")
    
    return result


def _calculate_jaccard_similarity(text_a: str, text_b: str) -> float:
    """
    计算两段文本的 Jaccard 相似度（字符级别）
    
    Args:
        text_a: 文本 A
        text_b: 文本 B
        
    Returns:
        相似度 (0-1)
    """
    if not text_a or not text_b:
        return 0.0
    
    # 使用 2-gram 字符集合提高准确度
    set_a = set(_get_char_ngrams(text_a, 2))
    set_b = set(_get_char_ngrams(text_b, 2))
    
    if not set_a or not set_b:
        return 0.0
    
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    
    return intersection / union if union > 0 else 0.0


def _get_char_ngrams(text: str, n: int = 2) -> List[str]:
    """
    获取文本的 n-gram 字符序列
    
    Args:
        text: 输入文本
        n: n-gram 长度
        
    Returns:
        n-gram 列表
    """
    # 移除空白字符
    text = re.sub(r'\s+', '', text)
    return [text[i:i+n] for i in range(len(text) - n + 1)]


# ============================================================================
# 主处理流程
# ============================================================================

def process_materials(
    materials: List[Dict[str, Any]],
    enable_spam_filter: bool = True,
    enable_source_dedupe: bool = True,
    enable_content_dedupe: bool = True,
    content_similarity_threshold: float = 0.85
) -> List[Dict[str, Any]]:
    """
    完整的素材处理流程
    
    处理顺序：
    1. 噪声过滤（移除营销内容）
    2. 来源去重（同一来源保留最优）
    3. 内容去重（合并相似片段）
    
    Args:
        materials: 原始素材列表
        enable_spam_filter: 是否启用噪声过滤
        enable_source_dedupe: 是否启用来源去重
        enable_content_dedupe: 是否启用内容去重
        content_similarity_threshold: 内容相似度阈值
        
    Returns:
        处理后的素材列表
    """
    if not materials:
        return []
    
    original_count = len(materials)
    result = materials.copy()
    
    # Step 1: 噪声过滤
    if enable_spam_filter:
        result = filter_spam_materials(result)
    
    # Step 2: 来源去重
    if enable_source_dedupe:
        result = dedupe_by_source(result)
    
    # Step 3: 内容去重
    if enable_content_dedupe:
        result = dedupe_by_content_similarity(result, content_similarity_threshold)
    
    final_count = len(result)
    if final_count < original_count:
        print(f"[素材处理] 完成: {original_count} -> {final_count} 条 (减少 {original_count - final_count} 条)")
    
    return result


# ============================================================================
# 素材分类工具（用于前端分级展示）
# ============================================================================

def classify_materials(materials: List[Dict[str, Any]], long_threshold: int = 200) -> Dict[str, List[Dict[str, Any]]]:
    """
    将素材分为长文和短碎两类，用于前端分级展示
    
    Args:
        materials: 素材列表
        long_threshold: 长文阈值（字符数）
        
    Returns:
        {
            "long": [...],   # 长文素材
            "short": [...]   # 短碎素材（灵感卡片）
        }
    """
    long_materials = []
    short_materials = []
    
    for mat in materials:
        content = mat.get('content', '')
        content_length = len(content)
        
        # 添加长度信息
        mat['content_length'] = content_length
        
        # 生成摘要（前100字）
        if content_length > 100:
            mat['summary'] = content[:100] + '...'
        else:
            mat['summary'] = content
        
        # 分类
        if content_length > long_threshold:
            long_materials.append(mat)
        else:
            short_materials.append(mat)
    
    return {
        "long": long_materials,
        "short": short_materials
    }

