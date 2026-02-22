# -*- coding: utf-8 -*-
"""
文档解析与向量化服务

负责将上传的 .docx / .pdf 文件完成以下流水线：
  1. DocumentLoader  — 提取纯文本
  2. TextSplitter    — 按 chunk_size=600 / overlap=100 切片
  3. Embedding       — 调用 OpenAI text-embedding-3-small 生成 1536 维向量
  4. 持久化          — 批量写入 knowledge_chunks 表
"""

import os
import re
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from sqlalchemy import text as sql_text

from database.config import SessionLocal

# 支持的文件后缀 → Loader 映射
SUPPORTED_EXTENSIONS = {".docx", ".pdf"}


class DocumentParserService:
    """
    文档解析 → 切片 → 向量化 → 入库 一站式服务

    用法:
        result = await document_parser.process_file(
            file_path="/tmp/xxx.docx",
            channel_scope="deep_reading",
            material_type="lesson_plan",
            source_filename="课程详案-三年级.docx",
        )
    """

    def __init__(self):
        self._embeddings: Optional[OpenAIEmbeddings] = None
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=100,
            length_function=len,
            separators=["\n\n", "\n", "。", "！", "？", ".", " ", ""],
        )

    # ------------------------------------------------------------------
    # Embedding 懒加载
    # ------------------------------------------------------------------
    def _get_embeddings(self) -> OpenAIEmbeddings:
        if self._embeddings is None:
            self._embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        return self._embeddings

    # ------------------------------------------------------------------
    # 1. 加载文档
    # ------------------------------------------------------------------
    def _load_document(self, file_path: str) -> List[str]:
        """根据文件后缀选择对应 Loader，返回纯文本列表"""
        ext = Path(file_path).suffix.lower()

        if ext == ".docx":
            loader = Docx2txtLoader(file_path)
        elif ext == ".pdf":
            loader = PyPDFLoader(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}，仅支持 .docx / .pdf")

        docs = loader.load()
        texts = [doc.page_content for doc in docs if doc.page_content.strip()]
        if not texts:
            raise ValueError("文件内容为空，无法解析出有效文本")
        return texts

    # ------------------------------------------------------------------
    # 2. 切片
    # ------------------------------------------------------------------
    @staticmethod
    def _clean_text(raw_text: str) -> str:
        """
        在切片前对原始文本做稳健清洗：
        1. 统一换行符（\r\n / \r → \n）
        2. 逐行去除行尾空格/制表符
        3. 合并连续空行——最多保留 1 个空行作为段落分隔
        4. 去除首尾空白
        """
        # Step 1: 统一换行符
        text = raw_text.replace('\r\n', '\n').replace('\r', '\n')
        # Step 2: 逐行 rstrip，消除行尾隐藏空白
        lines = [line.rstrip() for line in text.splitlines()]
        # Step 3: 合并连续空行，最多保留 1 个
        cleaned_lines: List[str] = []
        prev_blank = False
        for line in lines:
            is_blank = (line == '')
            if is_blank and prev_blank:
                continue   # 跳过多余的连续空行
            cleaned_lines.append(line)
            prev_blank = is_blank
        return '\n'.join(cleaned_lines).strip()

    def _split_texts(self, texts: List[str]) -> List[str]:
        """将原始文本列表拆分为小型文本块"""
        all_chunks: List[str] = []
        for raw_text in texts:
            cleaned_text = self._clean_text(raw_text)
            chunks = self._splitter.split_text(cleaned_text)
            all_chunks.extend(chunks)
        # 去掉切片后产生的空白块
        return [c.strip() for c in all_chunks if c.strip()]

    # ------------------------------------------------------------------
    # 3. 向量化
    # ------------------------------------------------------------------
    def _embed_chunks(self, chunks: List[str]) -> List[List[float]]:
        """批量生成 embedding 向量"""
        embeddings_model = self._get_embeddings()
        return embeddings_model.embed_documents(chunks)

    # ------------------------------------------------------------------
    # 4. 批量写入数据库
    # ------------------------------------------------------------------
    def _save_to_db(
        self,
        chunks: List[str],
        embeddings: List[List[float]],
        channel_scope: str,
        material_type: str,
        source_filename: str,
    ) -> int:
        """将切片和向量批量插入 knowledge_chunks 表，返回插入行数"""
        db = SessionLocal()
        try:
            for content, emb in zip(chunks, embeddings):
                db.execute(
                    sql_text("""
                        INSERT INTO knowledge_chunks
                            (content, embedding, channel_scope, material_type, source_filename)
                        VALUES
                            (:content, :embedding, :scope, :mtype, :fname)
                    """),
                    {
                        "content": content,
                        "embedding": str(emb),
                        "scope": channel_scope,
                        "mtype": material_type,
                        "fname": source_filename,
                    },
                )
            db.commit()
            return len(chunks)
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # ------------------------------------------------------------------
    # 对外主入口 B：纯文本直接入库（手动录入场景）
    # ------------------------------------------------------------------
    async def process_text(
        self,
        text: str,
        channel_scope: str,
        material_type: str,
        source_filename: str,
    ) -> Dict[str, Any]:
        """
        将纯文本直接执行 清洗 → 切片 → 向量化 → 入库 流程

        Args:
            text:            原始文本内容
            channel_scope:   频道范围
            material_type:   资料类型
            source_filename: 来源标识（如 "三年级课堂实录.txt"）

        Returns:
            {"chunks_count": int, "source_filename": str}
        """
        print(f"[DocParser] 手动录入: {source_filename} | scope={channel_scope} | type={material_type}")

        cleaned = self._clean_text(text)
        if not cleaned:
            raise ValueError("文本内容为空，无法处理")

        chunks = self._splitter.split_text(cleaned)
        chunks = [c.strip() for c in chunks if c.strip()]
        if not chunks:
            raise ValueError("切片后无有效内容")
        print(f"[DocParser] 切片完成，共 {len(chunks)} 个切片")

        embeddings = self._embed_chunks(chunks)
        print(f"[DocParser] 向量化完成，维度: {len(embeddings[0])}")

        saved = self._save_to_db(chunks, embeddings, channel_scope, material_type, source_filename)
        print(f"[DocParser] 入库完成，成功写入 {saved} 条记录")

        return {"chunks_count": saved, "source_filename": source_filename}

    # ------------------------------------------------------------------
    # 对外主入口 A：完整文件流水线
    # ------------------------------------------------------------------
    async def process_file(
        self,
        file_path: str,
        channel_scope: str,
        material_type: str,
        source_filename: str,
    ) -> Dict[str, Any]:
        """
        执行完整的 解析 → 切片 → 向量化 → 入库 流程

        Args:
            file_path: 临时文件的本地路径
            channel_scope: 频道范围 (deep_reading / picture_books)
            material_type: 文档类型 (lesson_plan / article / booklist / qa)
            source_filename: 原始文件名（用于溯源）

        Returns:
            {"chunks_count": int, "source_filename": str}

        Raises:
            ValueError: 文件格式不支持或内容为空
        """
        print(f"[DocParser] 开始处理: {source_filename} | scope={channel_scope} | type={material_type}")

        # Step 1: 加载
        texts = self._load_document(file_path)
        print(f"[DocParser] 加载完成，共 {len(texts)} 段原始文本")

        # Step 2: 切片
        chunks = self._split_texts(texts)
        if not chunks:
            raise ValueError("切片后无有效内容")
        print(f"[DocParser] 切片完成，共 {len(chunks)} 个切片")

        # Step 3: 向量化
        embeddings = self._embed_chunks(chunks)
        print(f"[DocParser] 向量化完成，维度: {len(embeddings[0])}")

        # Step 4: 入库
        saved = self._save_to_db(chunks, embeddings, channel_scope, material_type, source_filename)
        print(f"[DocParser] 入库完成，成功写入 {saved} 条记录")

        return {
            "chunks_count": saved,
            "source_filename": source_filename,
        }


# 模块级单例
document_parser = DocumentParserService()
