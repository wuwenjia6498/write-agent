# -*- coding: utf-8 -*-
"""
脚本 B: 导入小学段文档到 RAG 知识库

数据源目录:
  - server/data_source/cleaned_docs/  → 清洗后的阅读指导卡片 (.md)
    channel_scope='deep_reading', material_type='lesson_plan'

处理流程: 读取 MD 文本 → RecursiveCharacterTextSplitter 切片 → OpenAI Embedding → 入库
"""

import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from database.config import engine, SessionLocal
from database.models import Base, KnowledgeChunk

# 项目根目录（server 的上级）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# 需要扫描的目录及其对应的 tag 配置
DIRECTORY_CONFIG = [
    {
        "path": os.path.join(PROJECT_ROOT, "server", "data_source", "cleaned_docs"),
        "channel_scope": "deep_reading",
        "material_type": "lesson_plan",
        "extensions": (".md",),
    },
]

# 切片参数
CHUNK_SIZE = 600
CHUNK_OVERLAP = 100

# 向量化批大小
EMBEDDING_BATCH_SIZE = 20


def init_table():
    """确保 knowledge_chunks 表存在"""
    Base.metadata.create_all(bind=engine)
    print("[INFO] 数据库表已就绪")


def load_document(filepath: str) -> str:
    """
    根据文件扩展名选择对应方式提取文本
    支持 .md / .docx / .pdf
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".md":
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    elif ext == ".docx":
        from langchain_community.document_loaders import Docx2txtLoader
        loader = Docx2txtLoader(filepath)
        docs = loader.load()
        return "\n".join(doc.page_content for doc in docs)

    elif ext == ".pdf":
        from langchain_community.document_loaders import PyPDFLoader
        loader = PyPDFLoader(filepath)
        docs = loader.load()
        return "\n".join(doc.page_content for doc in docs)

    else:
        print(f"  [SKIP] 不支持的文件格式: {filepath}")
        return ""


def split_text(text_content: str) -> list[str]:
    """使用 RecursiveCharacterTextSplitter 切片"""
    if not text_content.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", "。", "！", "？", "；", " ", ""],
    )
    chunks = splitter.split_text(text_content)
    return [c for c in chunks if c.strip()]


def embed_and_store(
    chunks: list[str],
    channel_scope: str,
    material_type: str,
    source_filename: str,
    embeddings_model: OpenAIEmbeddings,
) -> int:
    """批量向量化并存入数据库"""
    total = len(chunks)
    stored = 0

    for i in range(0, total, EMBEDDING_BATCH_SIZE):
        batch = chunks[i : i + EMBEDDING_BATCH_SIZE]
        try:
            vectors = embeddings_model.embed_documents(batch)
        except Exception as e:
            print(f"  [ERROR] Embedding 失败 (batch {i}~{i+len(batch)}): {e}")
            continue

        db = SessionLocal()
        try:
            for text_chunk, vector in zip(batch, vectors):
                chunk_record = KnowledgeChunk(
                    content=text_chunk,
                    embedding=vector,
                    channel_scope=channel_scope,
                    material_type=material_type,
                    tags={"source": source_filename},
                    source_filename=source_filename,
                )
                db.add(chunk_record)
            db.commit()
        finally:
            db.close()

        stored += len(batch)
        print(f"  [PROGRESS] {source_filename}: {stored}/{total} chunks 已入库")

    return stored


def process_directory(config: dict, embeddings_model: OpenAIEmbeddings) -> int:
    """处理单个目录下的所有文档"""
    dir_path = config["path"]
    channel_scope = config["channel_scope"]
    material_type = config["material_type"]
    extensions = config.get("extensions", (".md", ".docx", ".pdf"))

    if not os.path.isdir(dir_path):
        print(f"[WARN] 目录不存在，跳过: {dir_path}")
        return 0

    files = [
        f for f in os.listdir(dir_path)
        if os.path.splitext(f)[1].lower() in extensions
    ]

    if not files:
        print(f"[WARN] 目录为空（无匹配文件）: {dir_path}")
        return 0

    print(f"\n[INFO] 扫描目录: {dir_path}")
    print(f"       scope={channel_scope}, type={material_type}, 文件数={len(files)}")

    total_chunks = 0
    for filename in files:
        filepath = os.path.join(dir_path, filename)
        print(f"\n  [FILE] 处理: {filename}")
        try:
            raw_text = load_document(filepath)
            if not raw_text:
                print(f"  [SKIP] 无有效文本: {filename}")
                continue

            chunks = split_text(raw_text)
            print(f"  [INFO] 切片数: {len(chunks)}")

            stored = embed_and_store(
                chunks, channel_scope, material_type, filename, embeddings_model
            )
            total_chunks += stored

        except Exception:
            print(f"  [ERROR] 处理失败: {filename}")
            traceback.print_exc()
            print("  [INFO] 跳过此文件，继续处理下一个")

    return total_chunks


def main():
    print("=" * 60)
    print("  小学段文档导入 (deep_reading)")
    print("=" * 60)

    init_table()

    # 初始化 OpenAI Embeddings（从环境变量读取 OPENAI_API_KEY / OPENAI_BASE_URL）
    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")

    grand_total = 0
    for config in DIRECTORY_CONFIG:
        count = process_directory(config, embeddings_model)
        grand_total += count

    print("\n" + "=" * 60)
    print(f"  [DONE] 总计导入 {grand_total} 个知识切片 (deep_reading)")
    print("=" * 60)


if __name__ == "__main__":
    main()
