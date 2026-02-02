"""
素材管理路由
负责品牌素材库的管理和检索，支持数据库持久化
支持文件上传（.md/.docx）和链接导入
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import re
import io

from services.db_service import db_service

router = APIRouter()

# 样文风格标签选项
STYLE_TAG_OPTIONS = ['温润', '逻辑', '文学性', '互动感']


class MaterialCreate(BaseModel):
    """创建素材请求"""
    content: str
    material_type: str  # 专业资料/实操案例/心得复盘/学员反馈/其他
    channel_slug: Optional[str] = None  # 归属频道，None 为全局
    tags: Optional[List[str]] = []
    source: Optional[str] = None
    # 样文专属字段
    style_tags: Optional[List[str]] = []  # 风格标签
    quality_weight: Optional[int] = 3  # 质量权重 1-5
    import_source: Optional[str] = "manual"  # 导入来源


class MaterialResponse(BaseModel):
    """素材响应"""
    id: str
    content: str
    material_type: str
    channel_id: Optional[str]
    channel_slug: Optional[str]
    tags: List[str]
    source: Optional[str]
    created_at: Optional[str]
    # 样文专属字段
    style_tags: Optional[List[str]] = []
    quality_weight: Optional[int] = None
    import_source: Optional[str] = None
    original_filename: Optional[str] = None


class BlockedWord(BaseModel):
    """屏蔽词模型"""
    phrase: str
    category: str
    reason: str
    replacement: str


@router.get("/blocked-words")
async def get_blocked_words() -> List[BlockedWord]:
    """获取全局屏蔽词库"""
    import json
    from pathlib import Path
    
    config_file = Path(__file__).parent.parent / "configs" / "global" / "blocked_words.json"
    
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        blocked_words = []
        for category_id, category_data in config["categories"].items():
            for pattern in category_data["patterns"]:
                blocked_words.append(BlockedWord(
                    phrase=pattern["phrase"],
                    category=category_data["name"],
                    reason=pattern["reason"],
                    replacement=pattern["replacement"]
                ))
        
        return blocked_words
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"加载屏蔽词库失败: {str(e)}"
        )


@router.get("/")
async def list_materials(
    channel: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
) -> List[MaterialResponse]:
    """
    获取素材列表
    
    Args:
        channel: 按频道筛选 (slug)
        type: 按类型筛选 (专业资料/实操案例/心得复盘/学员反馈/其他)
        search: 关键词搜索
        limit: 返回数量限制
    """
    materials = db_service.get_all_materials(
        channel_slug=channel,
        material_type=type,
        search=search,
        limit=limit
    )
    
    return [
        MaterialResponse(
            id=m["id"],
            content=m["content"],
            material_type=m["material_type"],
            channel_id=m.get("channel_id"),
            channel_slug=m.get("channel_slug"),
            tags=m.get("tags", []),
            source=m.get("source"),
            created_at=m.get("created_at"),
            style_tags=m.get("style_tags", []),
            quality_weight=m.get("quality_weight"),
            import_source=m.get("import_source"),
            original_filename=m.get("original_filename")
        )
        for m in materials
    ]


@router.post("/")
async def create_material(request: MaterialCreate) -> MaterialResponse:
    """
    创建新素材
    
    注意：创建后需要调用 embedding 接口生成向量
    """
    try:
        material = db_service.create_material(
            content=request.content,
            material_type=request.material_type,
            channel_slug=request.channel_slug,
            tags=request.tags,
            source=request.source,
            style_tags=request.style_tags,
            quality_weight=request.quality_weight,
            import_source=request.import_source
        )
        
        return MaterialResponse(
            id=material["id"],
            content=material["content"],
            material_type=material["material_type"],
            channel_id=material.get("channel_id"),
            channel_slug=material.get("channel_slug"),
            tags=material.get("tags", []),
            source=material.get("source"),
            created_at=material.get("created_at"),
            style_tags=material.get("style_tags", []),
            quality_weight=material.get("quality_weight"),
            import_source=material.get("import_source"),
            original_filename=material.get("original_filename")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_material(
    file: UploadFile = File(...),
    material_type: str = Form(default="样文"),
    channel_slug: Optional[str] = Form(default=None),
    tags: str = Form(default=""),  # 逗号分隔
    style_tags: str = Form(default=""),  # 逗号分隔
    quality_weight: int = Form(default=3)
) -> MaterialResponse:
    """
    通过文件上传创建素材
    支持 .md 和 .docx 格式
    """
    # 验证文件类型
    filename = file.filename or "unknown"
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    
    if ext not in ['md', 'docx']:
        raise HTTPException(
            status_code=400, 
            detail="仅支持 .md 和 .docx 文件格式"
        )
    
    try:
        # 读取文件内容
        file_content = await file.read()
        
        if ext == 'md':
            # Markdown 文件直接读取
            content = file_content.decode('utf-8')
        elif ext == 'docx':
            # Word 文件需要解析
            content = parse_docx(file_content)
        else:
            content = file_content.decode('utf-8')
        
        # 清理内容
        content = content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="文件内容为空")
        
        # 解析标签
        tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []
        style_tag_list = [t.strip() for t in style_tags.split(',') if t.strip()] if style_tags else []
        
        # 创建素材
        material = db_service.create_material(
            content=content,
            material_type=material_type,
            channel_slug=channel_slug if channel_slug else None,
            tags=tag_list,
            source=f"文件导入: {filename}",
            style_tags=style_tag_list,
            quality_weight=quality_weight,
            import_source="file",
            original_filename=filename
        )
        
        return MaterialResponse(
            id=material["id"],
            content=material["content"],
            material_type=material["material_type"],
            channel_id=material.get("channel_id"),
            channel_slug=material.get("channel_slug"),
            tags=material.get("tags", []),
            source=material.get("source"),
            created_at=material.get("created_at"),
            style_tags=material.get("style_tags", []),
            quality_weight=material.get("quality_weight"),
            import_source=material.get("import_source"),
            original_filename=material.get("original_filename")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {str(e)}")


def parse_docx(file_content: bytes) -> str:
    """
    解析 .docx 文件内容
    使用 python-docx 库
    """
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return '\n\n'.join(paragraphs)
    except ImportError:
        # 如果没有安装 python-docx，尝试简单解析
        raise HTTPException(
            status_code=500, 
            detail="服务器未安装 python-docx，无法解析 Word 文件"
        )


@router.post("/import-url")
async def import_from_url(url: str) -> MaterialResponse:
    """
    从 URL 导入内容（如公众号文章）
    
    注意：公众号文章需要特殊处理，模拟浏览器请求
    """
    import httpx
    from bs4 import BeautifulSoup
    
    # 验证 URL
    if not url.startswith('http'):
        raise HTTPException(status_code=400, detail="请提供有效的 URL")
    
    # 模拟浏览器请求头
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
        
        html_content = response.text
        
        # 解析 HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 提取标题
        title = soup.find('title')
        title_text = title.get_text().strip() if title else "导入文章"
        
        content = ""
        
        # 提取正文内容（针对微信公众号做特殊处理）
        if 'mp.weixin.qq.com' in url:
            # 公众号文章 - 尝试多种选择器
            content_div = (
                soup.find('div', id='js_content') or 
                soup.find('div', class_='rich_media_content') or
                soup.find('div', id='page-content') or
                soup.find('div', class_='rich_media_area_primary_inner')
            )
            
            if content_div:
                # 移除脚本、样式、图片说明等
                for tag in content_div.find_all(['script', 'style', 'noscript']):
                    tag.decompose()
                
                # 提取所有段落文本
                paragraphs = []
                for p in content_div.find_all(['p', 'section', 'span']):
                    text = p.get_text(strip=True)
                    if text and len(text) > 2:  # 过滤空白和过短内容
                        paragraphs.append(text)
                
                if paragraphs:
                    content = '\n\n'.join(paragraphs)
                else:
                    # 备选：直接获取所有文本
                    content = content_div.get_text(separator='\n\n').strip()
            
            # 如果仍然没有内容，尝试从整个页面提取
            if not content or len(content) < 50:
                # 可能是需要登录或文章已被删除
                raise HTTPException(
                    status_code=400, 
                    detail="无法解析公众号文章内容。可能原因：1) 文章需要关注后才能查看 2) 文章已被删除 3) 链接无效。建议：复制文章内容后使用手动输入方式添加。"
                )
        else:
            # 通用网页：提取 article 或 main 或 body
            content_tag = soup.find('article') or soup.find('main') or soup.find('body')
            if content_tag:
                for tag in content_tag.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                    tag.decompose()
                content = content_tag.get_text(separator='\n\n').strip()
            else:
                raise HTTPException(status_code=400, detail="无法解析网页内容")
        
        # 清理内容（去除多余空行和空白字符）
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = re.sub(r'[ \t]+', ' ', content)  # 合并多个空格
        content = content.strip()
        
        if not content or len(content) < 50:
            raise HTTPException(
                status_code=400, 
                detail="提取的内容太少或为空。建议：复制文章内容后使用手动输入方式添加。"
            )
        
        # 创建素材
        material = db_service.create_material(
            content=content,
            material_type="样文",
            channel_slug=None,
            tags=[],
            source=f"链接导入: {url[:100]}",
            style_tags=[],
            quality_weight=3,
            import_source="url",
            original_filename=title_text[:255]
        )
        
        return MaterialResponse(
            id=material["id"],
            content=material["content"],
            material_type=material["material_type"],
            channel_id=material.get("channel_id"),
            channel_slug=material.get("channel_slug"),
            tags=material.get("tags", []),
            source=material.get("source"),
            created_at=material.get("created_at"),
            style_tags=material.get("style_tags", []),
            quality_weight=material.get("quality_weight"),
            import_source=material.get("import_source"),
            original_filename=material.get("original_filename")
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"无法访问该 URL: {str(e)}")
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="服务器未安装必要依赖（httpx, beautifulsoup4）"
        )


@router.delete("/{material_id}")
async def delete_material(material_id: str):
    """删除素材"""
    success = db_service.delete_material(material_id)
    if not success:
        raise HTTPException(status_code=404, detail="素材不存在")
    return {"success": True, "message": "素材已删除"}


@router.post("/search")
async def search_materials(
    keywords: List[str],
    channel_slug: Optional[str] = None,
    limit: int = 10
) -> List[MaterialResponse]:
    """
    根据关键词搜索素材
    """
    # 获取频道 ID
    channel_id = None
    if channel_slug:
        channel = db_service.get_channel_by_slug(channel_slug)
        if channel:
            channel_id = channel["id"]
    
    if channel_id:
        materials = db_service.search_materials_by_keywords(
            channel_id=channel_id,
            keywords=keywords,
            limit=limit
        )
    else:
        # 全局搜索
        materials = db_service.get_all_materials(
            search=" ".join(keywords),
            limit=limit
        )
    
    return [
        MaterialResponse(
            id=m["id"],
            content=m["content"],
            material_type=m["material_type"],
            channel_id=m.get("channel_id"),
            channel_slug=m.get("channel_slug"),
            tags=m.get("tags", []),
            source=m.get("source"),
            created_at=m.get("created_at")
        )
        for m in materials
    ]
