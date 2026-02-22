# -*- coding: utf-8 -*-
"""
知识库检索服务 (RAG 核心)

提供基于 pgvector 的向量语义检索和结构化书籍模糊匹配，
实现频道级知识隔离，为工作流引擎注入内部知识。
"""

import os
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from langchain_openai import OpenAIEmbeddings
from database.config import SessionLocal

# 频道 slug → channel_scope 的合法映射
VALID_SCOPES = {"deep_reading", "picture_books", "parenting"}

# parenting 频道暂无专属资料，采用"虚拟借用"策略：检索全部三个频道
PARENTING_FALLBACK_SCOPES = ("parenting", "picture_books", "deep_reading")


class KnowledgeService:
    """
    知识库检索服务

    核心能力:
    1. search_docs  — 向量相似度检索 (KnowledgeChunk)
    2. search_books — 课标书籍模糊匹配 (CurriculumBook)
    3. format_knowledge_for_prompt — 将检索结果格式化为 LLM Prompt
    """

    def __init__(self):
        self._embeddings: Optional[OpenAIEmbeddings] = None
        self._available: Optional[bool] = None

    # ------------------------------------------------------------------
    # 初始化 & 可用性检查
    # ------------------------------------------------------------------
    def _get_embeddings(self) -> Optional[OpenAIEmbeddings]:
        """懒加载 OpenAI Embeddings 实例"""
        if self._embeddings is None:
            api_key = os.getenv("OPENAI_API_KEY", "")
            if api_key:
                self._embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
            else:
                print("[RAG] ⚠ OPENAI_API_KEY 未配置，向量检索不可用")
        return self._embeddings

    def is_available(self) -> bool:
        """检查知识库检索服务是否可用"""
        if self._available is None:
            self._available = self._get_embeddings() is not None
        return self._available

    # ------------------------------------------------------------------
    # 1. 向量相似度检索 (KnowledgeChunk)
    # ------------------------------------------------------------------
    def search_docs(
        self,
        query: str,
        channel_scope: str,
        limit: int = 5,
        material_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        在 knowledge_chunks 表中进行向量相似度搜索 (Cosine Distance)

        parenting 频道采用"虚拟借用"策略：同时检索三个频道中最匹配的 chunk。

        Args:
            query: 用户查询文本
            channel_scope: 频道范围 ('deep_reading' / 'picture_books' / 'parenting')
            limit: 返回结果数量上限
            material_type: 可选，进一步按文档类型过滤

        Returns:
            匹配的知识切片列表，每项含 content / material_type / source_filename / score
        """
        if not self.is_available():
            print(f"[RAG] ⚠ 向量检索不可用，跳过 | scope={channel_scope}")
            return []

        if channel_scope not in VALID_SCOPES:
            print(f"[RAG] ⚠ 无效的 channel_scope: {channel_scope}，跳过检索")
            return []

        try:
            embedding = self._get_embeddings().embed_query(query)
        except Exception as e:
            print(f"[RAG] ⚠ Query 向量化失败: {e}")
            return []

        # parenting 频道：跨三个频道检索（虚拟借用）
        if channel_scope == "parenting":
            sql = """
                SELECT
                    content,
                    material_type,
                    source_filename,
                    1 - (embedding <=> :embedding) AS score
                FROM knowledge_chunks
                WHERE channel_scope IN :scopes
            """
            params: Dict[str, Any] = {
                "embedding": str(embedding),
                "scopes": PARENTING_FALLBACK_SCOPES,
            }
        else:
            sql = """
                SELECT
                    content,
                    material_type,
                    source_filename,
                    1 - (embedding <=> :embedding) AS score
                FROM knowledge_chunks
                WHERE channel_scope = :scope
            """
            params: Dict[str, Any] = {
                "embedding": str(embedding),
                "scope": channel_scope,
            }

        if material_type:
            sql += " AND material_type = :mtype"
            params["mtype"] = material_type

        sql += " ORDER BY embedding <=> :embedding LIMIT :lim"
        params["lim"] = limit

        db = SessionLocal()
        try:
            rows = db.execute(text(sql), params).fetchall()
        except Exception as e:
            print(f"[RAG] ⚠ 向量检索 SQL 执行失败: {e}")
            return []
        finally:
            db.close()

        results = [
            {
                "content": r[0],
                "material_type": r[1],
                "source_filename": r[2],
                "score": round(float(r[3]), 4),
            }
            for r in rows
        ]

        print(
            f"[RAG] Channel: {channel_scope} | Query: {query[:40]}... "
            f"| Found: {len(results)} docs"
        )
        return results

    # ------------------------------------------------------------------
    # 2. 课标书籍模糊匹配 (CurriculumBook)
    # ------------------------------------------------------------------
    def search_books(
        self,
        query: str,
        grade: Optional[str] = None,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        在 curriculum_books 表中进行模糊匹配 (书名/作者/内容简介)

        Args:
            query: 搜索关键词
            grade: 可选，按年级过滤
            limit: 返回结果数量上限

        Returns:
            匹配的书籍列表，每项含 title / author / grade / content_intro / reading_suggestion
        """
        conditions = []
        params: Dict[str, Any] = {"query": f"%{query}%", "lim": limit}

        conditions.append(
            "(title ILIKE :query OR author ILIKE :query OR content_intro ILIKE :query)"
        )

        if grade:
            conditions.append("grade = :grade")
            params["grade"] = grade

        where_clause = " AND ".join(conditions)
        sql = f"""
            SELECT title, author, grade, content_intro, reading_suggestion
            FROM curriculum_books
            WHERE {where_clause}
            LIMIT :lim
        """

        db = SessionLocal()
        try:
            rows = db.execute(text(sql), params).fetchall()
        except Exception as e:
            print(f"[RAG] ⚠ 书籍检索 SQL 执行失败: {e}")
            return []
        finally:
            db.close()

        results = [
            {
                "title": r[0],
                "author": r[1],
                "grade": r[2],
                "content_intro": r[3],
                "reading_suggestion": r[4],
            }
            for r in rows
        ]

        print(
            f"[RAG] BookSearch | Query: {query[:30]} "
            f"| Grade: {grade or 'ALL'} | Found: {len(results)} books"
        )
        return results

    # ------------------------------------------------------------------
    # 3. 格式化检索结果为 LLM Prompt 片段
    # ------------------------------------------------------------------
    def format_knowledge_for_prompt(
        self,
        chunks: List[Dict[str, Any]],
        books: List[Dict[str, Any]],
    ) -> str:
        """
        将检索到的知识切片和书籍信息格式化为可直接注入 Prompt 的文本

        Args:
            chunks: search_docs 返回的知识切片列表
            books: search_books 返回的书籍列表

        Returns:
            格式化后的参考文本，如果无结果则返回空字符串
        """
        if not chunks and not books:
            return ""

        sections = []
        idx = 1

        if chunks:
            for chunk in chunks:
                source = chunk.get("source_filename", "")
                source_hint = f"（来源: {source}）" if source else ""
                sections.append(f"[参考{idx}] {chunk['content']}{source_hint}")
                idx += 1

        if books:
            for book in books:
                line = f"[参考{idx}] 推荐书目：《{book['title']}》"
                if book.get("author"):
                    line += f" — {book['author']}"
                if book.get("grade"):
                    line += f" [{book['grade']}]"
                if book.get("content_intro"):
                    intro = book["content_intro"][:120]
                    line += f"\n  简介: {intro}..."
                if book.get("reading_suggestion"):
                    suggestion = book["reading_suggestion"][:150]
                    line += f"\n  阅读建议: {suggestion}..."
                sections.append(line)
                idx += 1

        return "\n\n".join(sections)

    # ------------------------------------------------------------------
    # 便捷方法：一键检索 + 格式化
    # ------------------------------------------------------------------
    def retrieve_for_topic(
        self,
        topic: str,
        channel_scope: str,
        include_books: bool = True,
        doc_limit: int = 5,
        book_limit: int = 3,
    ) -> str:
        """
        便捷方法：根据主题和频道，一键检索知识并格式化

        Args:
            topic: 创作主题
            channel_scope: 频道范围
            include_books: 是否同时检索课标书目（仅 deep_reading 频道有效）
            doc_limit: 知识切片返回数量
            book_limit: 书籍返回数量

        Returns:
            格式化后的知识参考文本，可直接注入 Prompt
        """
        chunks = self.search_docs(topic, channel_scope, limit=doc_limit)

        books = []
        if include_books and channel_scope == "deep_reading":
            books = self.search_books(topic, limit=book_limit)

        return self.format_knowledge_for_prompt(chunks, books)


# 模块级单例（与项目其他 Service 保持一致）
knowledge_service = KnowledgeService()
