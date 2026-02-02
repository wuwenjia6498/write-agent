"""
频道管理路由
负责频道配置的加载、切换和管理
支持从数据库获取频道（优先）或 JSON 文件（回退）
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
from pathlib import Path

from services.db_service import db_service

router = APIRouter()

# 配置文件路径（回退使用）
CONFIGS_DIR = Path(__file__).parent.parent / "configs" / "channels"

class ChannelInfo(BaseModel):
    """频道基础信息"""
    channel_id: str
    channel_name: str
    slug: str
    name: str
    description: str
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""

class ChannelConfig(BaseModel):
    """完整频道配置"""
    channel_id: str
    channel_name: str
    description: str
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""
    system_prompt: Optional[Dict[str, Any]] = None
    sample_articles: Optional[List[str]] = []
    material_tags: Optional[List[str]] = []
    channel_specific_rules: Optional[Dict[str, List[str]]] = None
    blocked_phrases: Optional[List[str]] = []

class ChannelCreateRequest(BaseModel):
    """创建频道请求"""
    name: str
    slug: str
    description: str = ""
    system_prompt: Optional[Dict[str, Any]] = None
    style_guide_refs: Optional[List[str]] = None
    channel_rules: Optional[Dict[str, Any]] = None
    blocked_phrases: Optional[List[str]] = None
    material_tags: Optional[List[str]] = None
    target_audience: Optional[str] = ""
    brand_personality: Optional[str] = ""

class ChannelUpdateRequest(BaseModel):
    """更新频道请求"""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[Dict[str, Any]] = None
    style_guide_refs: Optional[List[str]] = None
    channel_rules: Optional[Dict[str, Any]] = None
    blocked_phrases: Optional[List[str]] = None
    material_tags: Optional[List[str]] = None
    target_audience: Optional[str] = None
    brand_personality: Optional[str] = None
    is_active: Optional[bool] = None

def load_channel_config(channel_id: str) -> Dict[str, Any]:
    """加载频道配置文件（从 JSON）"""
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
    优先从数据库获取，失败时回退到 JSON 文件
    """
    channels = []
    
    # 尝试从数据库获取
    try:
        db_channels = db_service.get_all_channels()
        if db_channels:
            for ch in db_channels:
                channels.append(ChannelInfo(
                    channel_id=ch["slug"],
                    channel_name=ch["name"],
                    slug=ch["slug"],
                    name=ch["name"],
                    description=ch.get("description", ""),
                    target_audience="",
                    brand_personality=""
                ))
            return channels
    except Exception as e:
        print(f"[WARN] 从数据库获取频道失败，回退到 JSON: {e}")
    
    # 回退：扫描 JSON 配置目录
    for config_file in CONFIGS_DIR.glob("*.json"):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                channels.append(ChannelInfo(
                    channel_id=config["channel_id"],
                    channel_name=config["channel_name"],
                    slug=config["channel_id"],
                    name=config["channel_name"],
                    description=config["description"],
                    target_audience=config.get("target_audience", ""),
                    brand_personality=config.get("brand_personality", "")
                ))
        except Exception as e:
            print(f"警告: 加载 {config_file.name} 失败: {e}")
            continue
    
    return channels

@router.get("/{channel_id}")
async def get_channel_config(channel_id: str) -> ChannelConfig:
    """
    获取指定频道的完整配置
    优先从数据库读取，失败时回退到 JSON 文件
    
    Args:
        channel_id: 频道ID (deep_reading / picture_books / parenting)
    
    Returns:
        完整的频道配置信息
    """
    # 优先从数据库读取
    try:
        db_channel = db_service.get_channel_by_slug(channel_id)
        if db_channel:
            system_prompt = db_channel.get("system_prompt") or {}
            channel_rules = db_channel.get("channel_rules") or {}
            
            return ChannelConfig(
                channel_id=db_channel["slug"],
                channel_name=db_channel["name"],
                description=db_channel.get("description") or "",
                # 优先从独立字段读取，回退到 system_prompt
                target_audience=db_channel.get("target_audience") or system_prompt.get("target_audience", ""),
                brand_personality=db_channel.get("brand_personality") or system_prompt.get("brand_personality", ""),
                system_prompt=system_prompt,
                sample_articles=db_channel.get("style_guide_refs") or [],
                # 优先从独立字段读取，回退到 system_prompt
                material_tags=db_channel.get("material_tags") or system_prompt.get("material_tags") or [],
                channel_specific_rules=channel_rules,
                blocked_phrases=db_channel.get("blocked_phrases") or system_prompt.get("blocked_phrases") or []
            )
    except Exception as e:
        print(f"[WARN] 从数据库获取频道 {channel_id} 失败，回退到 JSON: {e}")
    
    # 回退到 JSON 文件
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

@router.post("/")
async def create_channel(request: ChannelCreateRequest) -> Dict[str, Any]:
    """
    创建新频道
    """
    try:
        result = db_service.create_channel(
            name=request.name,
            slug=request.slug,
            description=request.description,
            system_prompt=request.system_prompt,
            style_guide_refs=request.style_guide_refs,
            channel_rules=request.channel_rules,
            blocked_phrases=request.blocked_phrases,
            material_tags=request.material_tags,
            target_audience=request.target_audience,
            brand_personality=request.brand_personality
        )
        
        if result is None:
            raise HTTPException(
                status_code=400,
                detail=f"频道标识符 '{request.slug}' 已存在"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建频道失败: {str(e)}"
        )

@router.put("/{channel_id}")
async def update_channel(channel_id: str, request: ChannelUpdateRequest) -> Dict[str, Any]:
    """
    更新频道信息
    """
    try:
        result = db_service.update_channel(
            slug=channel_id,
            name=request.name,
            description=request.description,
            system_prompt=request.system_prompt,
            style_guide_refs=request.style_guide_refs,
            channel_rules=request.channel_rules,
            blocked_phrases=request.blocked_phrases,
            material_tags=request.material_tags,
            target_audience=request.target_audience,
            brand_personality=request.brand_personality,
            is_active=request.is_active
        )
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"频道 '{channel_id}' 不存在"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新频道失败: {str(e)}"
        )

@router.delete("/{channel_id}")
async def delete_channel(channel_id: str) -> Dict[str, str]:
    """
    删除频道（软删除）
    """
    try:
        success = db_service.delete_channel(channel_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"频道 '{channel_id}' 不存在"
            )
        
        return {"message": f"频道 '{channel_id}' 已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除频道失败: {str(e)}"
        )


# ============================================================================
# 标杆样文管理 API (v3.5 - 独立表 + custom_tags)
# ============================================================================

# 预设的风格标签库（按频道分类）
# 结构：{ 频道名: { "内容标签": [...], "调性标签": [...] } }
PRESET_TAG_LIBRARY = {
    "绘本阅读": {
        "内容": ["#绘本解析", "#绘本阅读指导", "#亲子阅读", "#主题书单"],
        "调性": ["#暖心治愈", "#趣味生动", "#情感共鸣", "#轻松种草"]
    },
    "深度阅读": {
        "内容": ["#整本书阅读", "#读写结合", "#阅读策略与技巧"],
        "调性": ["#理性专业", "#硬核干货", "#逻辑严密", "#教育前沿", "#思辨培养"]
    },
    "育儿随笔": {
        "内容": ["#科学育儿", "#情绪管理", "#亲子沟通", "#习惯养成", "#避坑建议"],
        "调性": ["#教育理念", "#实用指导", "#焦虑粉碎", "#观点犀利", "#温暖陪伴"]
    }
}

# 扁平化的所有标签列表（兼容旧API）
DEFAULT_INDUSTRY_TAGS = []
for category in PRESET_TAG_LIBRARY.values():
    DEFAULT_INDUSTRY_TAGS.extend(category.get("内容", []))
    DEFAULT_INDUSTRY_TAGS.extend(category.get("调性", []))
# 去重并保持顺序
DEFAULT_INDUSTRY_TAGS = list(dict.fromkeys(DEFAULT_INDUSTRY_TAGS))


class StyleSampleCreate(BaseModel):
    """创建样文请求"""
    title: str
    content: str
    source: Optional[str] = None
    custom_tags: Optional[List[str]] = None  # v3.5 新增


class StyleSampleUpdate(BaseModel):
    """更新样文请求 (v3.5)"""
    title: Optional[str] = None
    source: Optional[str] = None
    custom_tags: Optional[List[str]] = None  # 主编定义的标签


class SampleFeatures(BaseModel):
    """样文 6 维特征"""
    analyzed_at: Optional[str] = None
    opening_style: Optional[Dict[str, Any]] = None
    sentence_pattern: Optional[Dict[str, Any]] = None
    paragraph_rhythm: Optional[Dict[str, Any]] = None
    expressions: Optional[Dict[str, Any]] = None
    tone: Optional[Dict[str, Any]] = None
    ending_style: Optional[Dict[str, Any]] = None


class StyleSampleResponse(BaseModel):
    """样文响应 (v3.5 升级)"""
    id: str
    title: str
    content: str
    source: Optional[str]
    added_at: str
    word_count: Optional[int] = None
    is_analyzed: bool = False
    custom_tags: List[str] = []  # 主编定义的标签（蓝色）
    ai_suggested_tags: List[str] = []  # AI 建议的标签（灰色）
    features: Optional[Dict[str, Any]] = None  # 6 维特征分析结果（style_profile）


@router.get("/{channel_slug}/style-samples")
async def get_style_samples(channel_slug: str) -> List[StyleSampleResponse]:
    """
    获取频道的标杆样文列表 (v3.5)
    
    优先从独立表读取，回退到 JSONB 字段
    """
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # v3.5: 优先从独立表读取
    samples_from_table = db_service.get_style_samples_by_channel(channel['id'])
    
    if samples_from_table:
        return [
            StyleSampleResponse(
                id=str(s['id']),
                title=s['title'],
                content=s['content'],
                source=s.get('source'),
                added_at=s.get('created_at', '').isoformat() if s.get('created_at') else '',
                word_count=s.get('word_count'),
                is_analyzed=s.get('is_analyzed', False),
                custom_tags=s.get('custom_tags') or [],
                ai_suggested_tags=s.get('ai_suggested_tags') or [],
                features=s.get('style_profile')  # 独立表中叫 style_profile
            )
            for s in samples_from_table
        ]
    
    # 回退：从旧的 JSONB 字段读取
    samples = channel.get('style_samples', []) or []
    return [
        StyleSampleResponse(
            id=s.get('id', ''),
            title=s.get('title', ''),
            content=s.get('content', ''),
            source=s.get('source'),
            added_at=s.get('added_at', ''),
            word_count=len(s.get('content', '')),
            is_analyzed=bool(s.get('features')),
            custom_tags=[],  # 旧数据没有标签
            ai_suggested_tags=[],
            features=s.get('features')
        )
        for s in samples
    ]


@router.get("/{channel_slug}/style-samples/preset-tags")
async def get_preset_tags(channel_slug: str) -> Dict[str, Any]:
    """
    获取预设的风格标签库
    
    根据频道返回对应的标签分类，或返回全部标签
    """
    # 频道 slug 到标签分类的映射
    channel_tag_mapping = {
        "picture_books": "绘本阅读",
        "deep_reading": "深度阅读", 
        "parenting": "育儿随笔"
    }
    
    category_name = channel_tag_mapping.get(channel_slug)
    
    if category_name and category_name in PRESET_TAG_LIBRARY:
        # 返回该频道对应的标签
        return {
            "channel": channel_slug,
            "category": category_name,
            "tags": PRESET_TAG_LIBRARY[category_name],
            "all_tags": DEFAULT_INDUSTRY_TAGS
        }
    else:
        # 返回全部标签
        return {
            "channel": channel_slug,
            "category": "全部",
            "tags": {"内容": DEFAULT_INDUSTRY_TAGS, "调性": []},
            "all_tags": DEFAULT_INDUSTRY_TAGS
        }


async def analyze_single_sample(content: str, title: str) -> tuple:
    """
    单篇样文 6 维特征提取 (v3.5 - 增强版)
    
    返回结构化的特征分析结果 + AI 建议标签
    自动处理中文引号等 JSON 格式问题
    
    Returns:
        tuple: (features_dict, error_message) - 成功时 error_message 为 None
    """
    from services.ai_service import ai_service
    from datetime import datetime
    import re
    
    analysis_prompt = """你是一位资深的文风分析专家。请对这篇文章进行深度扫描，完成以下两项任务：

【任务一：6 维特征提取】
1. **开头习惯 (opening_style)**：分析是故事引入、开门见山、设问开场还是场景描写，给出一个典型例句。
2. **句式特征 (sentence_pattern)**：分析长短句比例、偏爱的标点符号、平均句长估算。
3. **段落节奏 (paragraph_rhythm)**：分析段落长短分布、呼吸感。
4. **常用表达 (expressions)**：提取高频词汇、转折语、特色短语。
5. **语气特点 (tone)**：分析是温润、专业、文学还是对话式，评估正式度。
6. **结尾风格 (ending_style)**：分析是引导思考、提问、情感升华还是实用总结，给出典型例句。

【任务二：标签建议】
根据文章内容，建议 2-4 个风格标签（如：#绘本解析、#深度精读、#主题书单、#理性专业、#情感共鸣、#实用指导）

【输出要求】
请严格按照以下 JSON 格式输出。注意：所有字符串值必须用双引号括起来，数字不需要引号。

```json
{
  "opening_style": {
    "type": "story_intro",
    "description": "以故事场景引入主题",
    "example": "那天下午，孩子放学回来..."
  },
  "sentence_pattern": {
    "avg_length": 18,
    "short_ratio": 0.4,
    "favorite_punctuation": ["，", "。", "？"],
    "description": "长短句交错，节奏明快"
  },
  "paragraph_rhythm": {
    "avg_length": 80,
    "variation": "medium",
    "description": "段落适中，呼吸感强"
  },
  "expressions": {
    "high_freq_words": ["其实", "说实话", "你会发现"],
    "transition_phrases": ["但是", "不过", "然而"],
    "characteristic_phrases": ["有没有发现"]
  },
  "tone": {
    "type": "warm_friend",
    "formality": 0.3,
    "description": "温润亲切，像朋友聊天"
  },
  "ending_style": {
    "type": "emotional",
    "description": "情感升华，引发共鸣",
    "example": "或许，这就是阅读的意义。"
  },
  "suggested_tags": ["#深度精读", "#情感共鸣", "#教育理念"]
}
```

【重要提醒】
- type 字段只能是以下值之一（必须用双引号）：
  - opening_style.type: "story_intro", "direct", "question", "scene"
  - paragraph_rhythm.variation: "low", "medium", "high"
  - tone.type: "warm_friend", "professional", "literary", "conversational"
  - ending_style.type: "reflection", "question", "emotional", "practical"
- 数字字段（avg_length, short_ratio, formality）直接写数字，不加引号
- 【特别重要】example 字段中如果原文包含引号，请用书名号《》或省略号...替代，不要使用任何形式的引号（包括中文引号""''）
- 只输出 JSON，不要有任何其他文字"""
    
    # 检查内容是否有效
    if not content or len(content.strip()) < 100:
        return None, "样文内容太短，无法进行特征分析（至少需要100字）"
    
    try:
        print(f"[INFO] 开始分析样文特征: 《{title}》 (内容长度: {len(content)}字)")
        
        result = await ai_service.generate_content(
            system_prompt=analysis_prompt,
            user_message=f"请分析这篇文章《{title}》的写作特征：\n\n{content[:4000]}",
            temperature=0.2
        )
        
        # 检查 AI 返回是否有错误
        if result.startswith("[ERROR]") or result.startswith("[WARNING]"):
            print(f"[ERROR] AI 服务返回错误: {result}")
            return None, f"AI 服务错误: {result}"
        
        print(f"[DEBUG] AI 返回内容长度: {len(result)} 字符")
        
        # 尝试从 markdown 代码块中提取 JSON
        code_block_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', result)
        if code_block_match:
            json_str = code_block_match.group(1)
        else:
            # 回退：直接匹配 JSON 对象（贪婪匹配最外层）
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                json_str = json_match.group()
            else:
                print(f"[ERROR] 无法从 AI 返回中提取 JSON: {result[:500]}...")
                return None, "AI 返回格式异常，无法提取 JSON"
        
        # 核心修复：先全局替换所有中文引号为安全字符
        # 中文双引号替换为【】，中文单引号替换为『』
        json_str_safe = json_str.replace('\u201c', '\u3010').replace('\u201d', '\u3011')  # "" -> 【】
        json_str_safe = json_str_safe.replace('\u2018', '\u300e').replace('\u2019', '\u300f')  # '' -> 『』
        
        try:
            features = json.loads(json_str_safe)
            features['analyzed_at'] = datetime.utcnow().isoformat()
            print(f"[INFO] 样文特征分析成功: 《{title}》")
            return features, None
        except json.JSONDecodeError as je:
            print(f"[WARN] JSON 解析失败: {je}")
            print(f"[DEBUG] 原始 JSON: {json_str[:300]}...")
            
            # 尝试其他修复方法
            try:
                # 1. 移除可能的注释
                cleaned = re.sub(r'//.*?\n', '\n', json_str_safe)
                # 2. 修复数字后面直接跟字母的情况（如 0-1 应该是 "0-1"）
                cleaned = re.sub(r':\s*(\d+)-(\d+)', r': "\1-\2"', cleaned)
                # 3. 修复没有引号的值
                cleaned = re.sub(r':\s*([a-zA-Z_][a-zA-Z0-9_/]*)\s*([,\}])', r': "\1"\2', cleaned)
                
                features = json.loads(cleaned)
                features['analyzed_at'] = datetime.utcnow().isoformat()
                print(f"[INFO] 样文特征分析成功（修复后）: 《{title}》")
                return features, None
            except json.JSONDecodeError as je2:
                print(f"[ERROR] JSON 解析彻底失败: {je2}")
                return None, f"JSON 解析失败: {str(je)}"
            
    except Exception as e:
        print(f"[ERROR] 样文特征分析异常: {e}")
        import traceback
        traceback.print_exc()
        return None, f"分析异常: {str(e)}"


@router.post("/{channel_slug}/style-samples")
async def add_style_sample(channel_slug: str, request: StyleSampleCreate) -> StyleSampleResponse:
    """
    添加样文并自动分析 6 维特征 (v3.5)
    
    - 保存到独立表 style_samples
    - 自动分析 6 维特征并生成 AI 建议标签
    """
    import uuid
    from datetime import datetime
    
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # 检查样文数量（最多 5 篇）
    existing_count = db_service.count_style_samples_by_channel(channel['id'])
    if existing_count >= 5:
        raise HTTPException(status_code=400, detail="样文最多 5 篇，请先删除旧样文")
    
    # 自动分析 6 维特征
    analysis_result, analysis_error = await analyze_single_sample(request.content, request.title)
    
    # 提取 AI 建议的标签
    ai_suggested_tags = []
    if analysis_result:
        ai_suggested_tags = analysis_result.pop('suggested_tags', [])
    elif analysis_error:
        print(f"[WARN] 样文特征分析失败（将继续保存样文）: {analysis_error}")
    
    # 计算字数
    word_count = len(request.content) if request.content else 0
    
    # 保存到独立表
    sample_id = str(uuid.uuid4())
    success = db_service.create_style_sample(
        id=sample_id,
        channel_id=channel['id'],
        title=request.title,
        content=request.content,
        source=request.source,
        custom_tags=request.custom_tags or [],
        ai_suggested_tags=ai_suggested_tags,
        style_profile=analysis_result,
        is_analyzed=bool(analysis_result),
        word_count=word_count
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="保存样文失败")
    
    return StyleSampleResponse(
        id=sample_id,
        title=request.title,
        content=request.content,
        source=request.source,
        added_at=datetime.utcnow().isoformat(),
        word_count=word_count,
        is_analyzed=bool(analysis_result),
        custom_tags=request.custom_tags or [],
        ai_suggested_tags=ai_suggested_tags,
        features=analysis_result
    )


@router.put("/{channel_slug}/style-samples/{sample_id}")
async def update_style_sample(
    channel_slug: str, 
    sample_id: str, 
    request: StyleSampleUpdate
) -> Dict[str, Any]:
    """
    更新样文信息（标题、来源、自定义标签）(v3.5)
    
    用于主编编辑自定义标签
    """
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    success = db_service.update_style_sample(
        sample_id=sample_id,
        title=request.title,
        source=request.source,
        custom_tags=request.custom_tags
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="样文不存在或更新失败")
    
    return {
        "message": "样文已更新",
        "sample_id": sample_id,
        "custom_tags": request.custom_tags
    }


@router.post("/{channel_slug}/style-samples/{sample_id}/analyze")
async def reanalyze_sample(channel_slug: str, sample_id: str) -> Dict[str, Any]:
    """
    重新分析单篇样文的 6 维特征 (v3.5)
    """
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # 从独立表获取样文
    sample = db_service.get_style_sample_by_id(sample_id)
    
    if not sample:
        # 回退：从旧 JSONB 获取
        samples = channel.get('style_samples', []) or []
        sample = next((s for s in samples if s.get('id') == sample_id), None)
        
        if not sample:
            raise HTTPException(status_code=404, detail="样文不存在")
    
    # 重新分析
    analysis_result, analysis_error = await analyze_single_sample(
        sample.get('content', ''), 
        sample.get('title', '')
    )
    
    if not analysis_result:
        error_detail = analysis_error or "特征分析失败（未知原因）"
        raise HTTPException(status_code=500, detail=error_detail)
    
    # 提取 AI 建议标签
    ai_suggested_tags = analysis_result.pop('suggested_tags', [])
    
    # 更新到独立表
    success = db_service.update_style_sample_analysis(
        sample_id=sample_id,
        style_profile=analysis_result,
        ai_suggested_tags=ai_suggested_tags
    )
    
    if not success:
        # 回退：更新旧 JSONB 字段
        samples = channel.get('style_samples', []) or []
        for s in samples:
            if s.get('id') == sample_id:
                s['features'] = analysis_result
                break
        db_service.update_channel_style_samples(channel['id'], samples)
    
    return {
        "message": "特征分析完成",
        "sample_id": sample_id,
        "features": analysis_result,
        "ai_suggested_tags": ai_suggested_tags
    }


@router.delete("/{channel_slug}/style-samples/{sample_id}")
async def delete_style_sample(channel_slug: str, sample_id: str) -> Dict[str, str]:
    """删除标杆样文 (v3.5)"""
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # 从独立表删除
    success = db_service.delete_style_sample(sample_id)
    
    if not success:
        # 回退：从旧 JSONB 删除
        samples = channel.get('style_samples', []) or []
        new_samples = [s for s in samples if s.get('id') != sample_id]
        
        if len(new_samples) == len(samples):
            raise HTTPException(status_code=404, detail="样文不存在")
        
        db_service.update_channel_style_samples(channel['id'], new_samples)
        
        if len(new_samples) == 0:
            db_service.update_channel_style_profile(channel['id'], None)
    
    return {"message": "样文已删除"}


@router.get("/{channel_slug}/style-profile")
async def get_style_profile(channel_slug: str) -> Optional[Dict[str, Any]]:
    """获取频道的风格画像"""
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    return channel.get('style_profile')


@router.post("/{channel_slug}/analyze-style")
async def analyze_style(channel_slug: str) -> Dict[str, Any]:
    """
    频道 DNA 合成：基于各篇样文的 6 维特征报告，合成频道整体风格画像
    
    注意：v3.5 切换为"样文矩阵"模式后，此接口仍可用于生成频道整体画像，
    但在 Step 7 创作时会优先使用所选单篇样文的独立 style_profile。
    """
    from services.ai_service import ai_service
    import re
    
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # v3.5: 优先从独立表获取样文
    samples_from_table = db_service.get_style_samples_by_channel(channel['id'])
    
    if samples_from_table:
        style_samples = [
            {
                'id': str(s['id']),
                'title': s['title'],
                'content': s['content'],
                'features': s.get('style_profile')
            }
            for s in samples_from_table
        ]
    else:
        style_samples = channel.get('style_samples', [])
    
    if not style_samples:
        raise HTTPException(status_code=400, detail="请先添加样文")
    
    # 检查是否有样文缺少特征分析
    samples_without_features = [s for s in style_samples if not s.get('features')]
    
    # 自动为缺少特征的样文进行分析
    if samples_without_features:
        for sample in samples_without_features:
            features, error = await analyze_single_sample(sample.get('content', ''), sample.get('title', ''))
            if features:
                features.pop('suggested_tags', None)  # 移除标签建议
                sample['features'] = features
                # 更新到独立表
                if samples_from_table:
                    db_service.update_style_sample_analysis(sample['id'], features, [])
            elif error:
                print(f"[WARN] 样文 {sample.get('title')} 分析失败: {error}")
    
    # 收集所有样文的特征报告
    feature_reports = []
    for i, sample in enumerate(style_samples, 1):
        if sample.get('features'):
            feature_reports.append({
                "sample_index": i,
                "title": sample.get('title', '无标题'),
                "features": sample['features']
            })
    
    if not feature_reports:
        raise HTTPException(status_code=400, detail="样文特征分析失败，请重新添加样文")
    
    # 构建特征报告文本
    reports_text = json.dumps(feature_reports, ensure_ascii=False, indent=2)
    
    # AI 合成 prompt
    synthesis_prompt = """你是一位资深的文风分析专家。请综合多篇样文的特征报告，输出一份《频道风格画像》。

【分析要点】
1. 找出各维度中一致出现的特征（强一致性特征）
2. 提炼共性，归纳创作指南

【输出要求】
请直接输出一个 JSON 对象，格式如下：

{
  "style_portrait": "用一句话概括作者的写作风格",
  "consistency_score": 85,
  "structural_logic": ["场景切入", "问题引出", "观点展开", "案例支撑", "总结升华"],
  "tone_features": ["温润", "亲切", "有深度"],
  "stable_features": {
    "opening_style": {
      "type": "story_intro",
      "consistency": "strong",
      "description": "以生活场景或故事引入"
    },
    "sentence_pattern": {
      "avg_length": 18,
      "short_ratio": 0.4,
      "description": "长短句交错，节奏明快"
    },
    "paragraph_rhythm": {
      "variation": "medium",
      "description": "段落适中，呼吸感强"
    },
    "expressions": {
      "high_freq_words": ["其实", "说实话", "你有没有发现"],
      "transition_phrases": ["但是", "不过"],
      "avoid_words": ["必须", "一定要"]
    },
    "tone": {
      "type": "warm_friend",
      "formality": 0.3,
      "description": "温润亲切，像朋友聊天"
    },
    "ending_style": {
      "type": "reflection",
      "description": "引导思考，留有余味"
    }
  },
  "writing_guidelines": [
    "使用故事或场景开头",
    "保持温润亲切的语气",
    "多用短句，避免长句堆砌"
  ]
}

注意：
- consistency_score 是 0-100 的数字
- avg_length 和 short_ratio 是数字
- formality 是 0-1 之间的小数
- 只输出 JSON，不要其他文字"""
    
    try:
        # 调用 AI 合成
        result = await ai_service.generate_content(
            system_prompt=synthesis_prompt,
            user_message=f"请综合以下 {len(feature_reports)} 篇样文的特征报告，合成频道风格画像：\n\n{reports_text}",
            temperature=0.3
        )
        
        # 解析 JSON
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            style_profile = json.loads(json_match.group())
            
            # 添加元数据
            style_profile['meta'] = {
                'analyzed_samples': len(feature_reports),
                'analyzed_at': __import__('datetime').datetime.utcnow().isoformat()
            }
            
            # 保存到数据库
            db_service.update_channel_style_profile(channel['id'], style_profile)
            
            return {
                "message": "频道风格画像合成完成",
                "style_profile": style_profile
            }
        else:
            raise HTTPException(status_code=500, detail="AI 输出格式异常，请重试")
            
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON 解析失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")

