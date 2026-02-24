# -*- coding: utf-8 -*-
"""
知识库管理路由 (后台管理)

提供知识库文档上传、向量化入库及记录查询功能。
路由前缀: /api/admin/knowledge
"""

import os
import tempfile
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy import text as sql_text

from services.document_parser import document_parser, SUPPORTED_EXTENSIONS
from database.config import get_db
from database.models import KnowledgeChunk

router = APIRouter()

# 频道范围白名单
VALID_CHANNEL_SCOPES = {"deep_reading", "picture_books", "parenting"}

# 文档类型白名单（与前端 MATERIAL_TYPE_MAP 保持同步）
# deep_reading: lesson_plan, article, course_info, theory_book, anecdote
# picture_books: booklist, qa, guide_book, anecdote
# parenting:     article, parenting_book, anecdote
VALID_MATERIAL_TYPES = {
    "lesson_plan", "article", "course_info", "theory_book",
    "booklist", "qa", "guide_book",
    "parenting_book",
    "anecdote",
}


class UploadResponse(BaseModel):
    """上传成功的响应体"""
    success: bool
    message: str
    chunks_count: int
    source_filename: str
    channel_scope: str
    material_type: str


@router.post("/upload", response_model=UploadResponse)
async def upload_knowledge_file(
    file: UploadFile = File(..., description="待上传的文档 (.docx / .pdf)"),
    channel_scope: str = Form(..., description="频道范围: deep_reading / picture_books"),
    material_type: str = Form(..., description="文档类型: lesson_plan / article / course_info / theory_book / booklist / qa / guide_book / parenting_book"),
):
    """
    上传文档并完成向量化入库

    流程:
      1. 校验参数与文件格式
      2. 将文件保存到临时目录
      3. 调用 DocumentParserService 执行 解析→切片→向量化→入库
      4. 清理临时文件并返回结果
    """
    # ---- 参数校验 ----
    if channel_scope not in VALID_CHANNEL_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"无效的频道范围: {channel_scope}，可选值: {', '.join(VALID_CHANNEL_SCOPES)}",
        )

    if material_type not in VALID_MATERIAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"无效的文档类型: {material_type}，可选值: {', '.join(VALID_MATERIAL_TYPES)}",
        )

    # ---- 文件格式校验 ----
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}，仅支持 {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    # ---- 保存到临时目录 ----
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="上传文件内容为空")
            tmp.write(content)
            tmp_path = tmp.name

        # ---- 执行解析流水线 ----
        result = await document_parser.process_file(
            file_path=tmp_path,
            channel_scope=channel_scope,
            material_type=material_type,
            source_filename=filename,
        )

        return UploadResponse(
            success=True,
            message=f"文件 '{filename}' 处理完成，共生成 {result['chunks_count']} 个知识切片",
            chunks_count=result["chunks_count"],
            source_filename=filename,
            channel_scope=channel_scope,
            material_type=material_type,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[AdminKnowledge] 上传处理异常: {e}")
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")
    finally:
        # ---- 清理临时文件 ----
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ---- 文件列表响应模型 ----

class KnowledgeFileItem(BaseModel):
    """单个已入库文件的聚合信息"""
    source_filename: str
    channel_scope: str
    material_type: str
    chunk_count: int
    created_at: Optional[str]  # ISO 8601 字符串


@router.get("/list", response_model=List[KnowledgeFileItem])
def list_knowledge_files(
    channel_scope: Optional[str] = Query(None, description="按频道范围过滤，留空则返回全部"),
    material_type: Optional[str] = Query(None, description="按资料类型过滤，留空则返回全部"),
    db: Session = Depends(get_db),
):
    """
    查询知识库中所有已入库的文件（按 source_filename 分组聚合）

    返回字段：
      - source_filename: 原始文件名
      - channel_scope:   所属频道
      - material_type:   资料类型
      - chunk_count:     该文件被切分的切片数量
      - created_at:      最新切片的上传时间 (ISO 8601)
    """
    query = db.query(
        KnowledgeChunk.source_filename,
        KnowledgeChunk.channel_scope,
        KnowledgeChunk.material_type,
        func.count(KnowledgeChunk.id).label("chunk_count"),
        func.max(KnowledgeChunk.created_at).label("created_at"),
    ).group_by(
        KnowledgeChunk.source_filename,
        KnowledgeChunk.channel_scope,
        KnowledgeChunk.material_type,
    )

    if channel_scope:
        if channel_scope not in VALID_CHANNEL_SCOPES:
            raise HTTPException(
                status_code=400,
                detail=f"无效的频道范围: {channel_scope}",
            )
        query = query.filter(KnowledgeChunk.channel_scope == channel_scope)

    if material_type:
        if material_type not in VALID_MATERIAL_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"无效的资料类型: {material_type}",
            )
        query = query.filter(KnowledgeChunk.material_type == material_type)

    rows = query.order_by(func.max(KnowledgeChunk.created_at).desc()).all()

    return [
        KnowledgeFileItem(
            source_filename=row.source_filename or "未知文件",
            channel_scope=row.channel_scope,
            material_type=row.material_type,
            chunk_count=row.chunk_count,
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]


# ---- 删除响应模型 ----

class DeleteResponse(BaseModel):
    """删除操作的响应体"""
    success: bool
    source_filename: str
    deleted_chunks: int


@router.delete("/delete", response_model=DeleteResponse)
def delete_knowledge_file(
    source_filename: str = Query(..., description="要删除的文件名"),
    db: Session = Depends(get_db),
):
    """
    删除指定文件名对应的所有知识切片

    通过 source_filename 匹配，一次性清除该文件生成的全部向量切片。
    """
    deleted_count = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.source_filename == source_filename)
        .delete(synchronize_session=False)
    )
    db.commit()

    if deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"未找到文件 '{source_filename}' 的任何切片记录")

    print(f"[AdminKnowledge] 删除文件 '{source_filename}'，共清除 {deleted_count} 个切片")
    return DeleteResponse(
        success=True,
        source_filename=source_filename,
        deleted_chunks=deleted_count,
    )


# ---- 切片详情响应模型 ----

class ChunkItem(BaseModel):
    """单条知识切片"""
    id: int
    content: str
    created_at: Optional[str]


@router.get("/chunks", response_model=List[ChunkItem])
def get_knowledge_chunks(
    source_filename: str = Query(..., description="要查看切片的文件名"),
    db: Session = Depends(get_db),
):
    """
    查询指定文件的所有知识切片内容

    按 id 升序返回，保持与切片时的顺序一致。
    """
    chunks = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.source_filename == source_filename)
        .order_by(KnowledgeChunk.id.asc())
        .all()
    )

    if not chunks:
        raise HTTPException(status_code=404, detail=f"未找到文件 '{source_filename}' 的任何切片记录")

    return [
        ChunkItem(
            id=chunk.id,
            content=chunk.content,
            created_at=chunk.created_at.isoformat() if chunk.created_at else None,
        )
        for chunk in chunks
    ]


# ---- 手动录入文本接口 ----

class UploadTextRequest(BaseModel):
    """手动录入文本的请求体"""
    title: str
    content: str
    channel_scope: str
    material_type: str


@router.post("/upload_text", response_model=UploadResponse)
async def upload_text(body: UploadTextRequest):
    """
    接收手动录入的文本内容，直接执行切片 → 向量化 → 入库流程

    - title:          作为 source_filename（自动加 .txt 后缀）
    - content:        原始文本内容
    - channel_scope:  频道范围
    - material_type:  资料类型
    """
    # ---- 参数校验 ----
    if body.channel_scope not in VALID_CHANNEL_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"无效的频道范围: {body.channel_scope}，可选值: {', '.join(VALID_CHANNEL_SCOPES)}",
        )

    if body.material_type not in VALID_MATERIAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"无效的文档类型: {body.material_type}，可选值: {', '.join(VALID_MATERIAL_TYPES)}",
        )

    title = body.title.strip()
    content = body.content.strip()

    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if not content:
        raise HTTPException(status_code=400, detail="内容不能为空")

    # 将标题作为 source_filename，确保以 .txt 结尾
    source_filename = title if title.endswith(".txt") else f"{title}.txt"

    try:
        result = await document_parser.process_text(
            text=content,
            channel_scope=body.channel_scope,
            material_type=body.material_type,
            source_filename=source_filename,
        )

        return UploadResponse(
            success=True,
            message=f"文本 '{title}' 处理完成，共生成 {result['chunks_count']} 个知识切片",
            chunks_count=result["chunks_count"],
            source_filename=source_filename,
            channel_scope=body.channel_scope,
            material_type=body.material_type,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[AdminKnowledge] 手动录入处理异常: {e}")
        raise HTTPException(status_code=500, detail=f"文本处理失败: {str(e)}")


# ---- 环境诊断接口 ----

@router.get("/diagnose")
def diagnose_knowledge_env(db: Session = Depends(get_db)):
    """
    诊断知识库相关的环境变量与数据库连接状态。
    用于排查生产环境向量检索不可用的问题。
    """
    # 延迟导入，避免模块加载时的循环依赖问题
    from services.knowledge_service import knowledge_service

    result = {}

    # 1. 检查环境变量（列出所有包含 OPENAI 的 key，帮助排查注入问题）
    openai_key = os.getenv("OPENAI_API_KEY", "")
    openai_base = os.getenv("OPENAI_BASE_URL", "")
    openai_api_base = os.getenv("OPENAI_API_BASE", "")

    openai_related_keys = sorted([k for k in os.environ.keys() if "OPENAI" in k.upper()])

    result["env"] = {
        "OPENAI_API_KEY": f"{openai_key[:12]}..." if openai_key else "未配置",
        "OPENAI_BASE_URL": openai_base if openai_base else "未配置",
        "OPENAI_API_BASE": openai_api_base if openai_api_base else "未配置",
        "DATABASE_URL": "已配置" if os.getenv("DATABASE_URL") else "未配置",
        "all_openai_env_keys": openai_related_keys,
    }

    # 2. 检查向量检索服务是否可用
    result["embedding_service"] = "可用" if knowledge_service.is_available() else "不可用（OPENAI_API_KEY 缺失或初始化失败）"

    # 3. 检查数据库中的知识切片数量
    try:
        total_chunks = db.query(func.count(KnowledgeChunk.id)).scalar() or 0
        channel_stats = db.execute(
            sql_text("""
                SELECT channel_scope, COUNT(*) as cnt
                FROM knowledge_chunks
                GROUP BY channel_scope
                ORDER BY channel_scope
            """)
        ).fetchall()
        result["database"] = {
            "total_chunks": total_chunks,
            "by_channel": {row[0]: row[1] for row in channel_stats},
            "status": "连接正常",
        }
    except Exception as e:
        result["database"] = {"status": f"连接失败: {str(e)}"}

    # 4. 尝试一次实际的向量检索（小样本测试）
    if knowledge_service.is_available():
        try:
            test_results = knowledge_service.search_docs(
                query="阅读理解",
                channel_scope="deep_reading",
                limit=1,
            )
            result["search_test"] = {
                "status": "向量检索正常",
                "found": len(test_results),
            }
        except Exception as e:
            result["search_test"] = {"status": f"向量检索失败: {str(e)}"}
    else:
        result["search_test"] = {"status": "跳过（向量服务不可用）"}

    return result
