# -*- coding: utf-8 -*-
"""
批量洗稿脚本：将 PDF 教学详案转化为 RAG 友好的高密度知识文档（.md）

处理流程:
  1. 从 raw_docs/ 读取 .pdf 文件
  2. 提取纯文本
  3. 调用 AI 进行"洗稿"重写
  4. 按智能重命名规则保存到 cleaned_docs/

使用方式:
  cd server
  python -m scripts.batch_clean_docs
"""

import sys
import os
import asyncio

# 将 server/ 加入模块搜索路径，使 services 等包可被正确导入
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pypdf import PdfReader
from services.ai_service import AIService

# ─── 路径常量 ────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(SCRIPT_DIR, "..")
RAW_DIR = os.path.join(SERVER_DIR, "data_source", "raw_docs")
CLEANED_DIR = os.path.join(SERVER_DIR, "data_source", "cleaned_docs")

# ─── AI 提示词 ───────────────────────────────────────────────
SYSTEM_PROMPT = '''\
你是一个教育知识图谱萃取专家。请阅读我提供的\u201c儿童阅读教学详案\u201d，将其中的教学过程转化为面向\u201c家长阅读指导\u201d的高密度知识文档。
【过滤规则】
1. 彻底删除所有教学指令噪音（如：PPT换页、教师操作提示、分组讨论步骤等）。
2. 彻底删除师生对话的剧本式格式。
3. 绝对禁止输出任何\u201c好的，这是为您整理的...\u201d等开场白或结尾寒暄，直接输出 Markdown 正文。
4. 抹除所有类似\u201c第X章\u201d、\u201c第X页\u201d的教辅标记，将其替换为具体的事件背景描述。
5. 列表内容必须使用标准的 Markdown 无序列表格式（即以 '- ' 开头）。'''

USER_MESSAGE_TEMPLATE = '''\
【请严格按照以下格式输出，不要有任何多余的话】：

# 书目：《[提取书名]》阅读指导核心价值

## 一、 核心教育价值

## 二、 核心阅读策略

## 三、 经典细节与启示

【原始详案内容如下】：

{text}'''


def ensure_directories():
    """检查并创建所需的目录结构"""
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(CLEANED_DIR, exist_ok=True)
    print(f"[INFO] 原始文档目录: {os.path.abspath(RAW_DIR)}")
    print(f"[INFO] 清洗输出目录: {os.path.abspath(CLEANED_DIR)}")


def extract_text_from_pdf(pdf_path: str) -> str:
    """使用 pypdf 提取 PDF 文件中的全部纯文本"""
    reader = PdfReader(pdf_path)
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text)
    return "\n".join(pages_text)


def smart_rename(original_filename: str) -> str:
    """
    智能重命名：去掉扩展名后，将"教学设计-详案"/"教学设计"替换为"阅读指导卡片"，
    最终输出 .md 扩展名。
    例: 二年级_《"歪脑袋"木头桩》教学设计-详案.pdf → 二年级_《"歪脑袋"木头桩》阅读指导卡片.md
    """
    stem = os.path.splitext(original_filename)[0]
    # 先替换带横杠的长版本，再替换短版本，避免残留
    stem = stem.replace("教学设计-详案", "阅读指导卡片")
    stem = stem.replace("教学设计", "阅读指导卡片")
    return f"{stem}.md"


async def process_single_file(
    ai: AIService,
    pdf_path: str,
    output_path: str,
) -> bool:
    """调用 AI 对单个 PDF 进行洗稿并保存结果，返回是否成功"""
    raw_text = extract_text_from_pdf(pdf_path)
    if not raw_text.strip():
        print("    [SKIP] PDF 未提取到有效文本，跳过。")
        return False

    user_message = USER_MESSAGE_TEMPLATE.format(text=raw_text)

    result = await ai.generate_content(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=4000,
        temperature=0.2,
    )

    # 如果返回的是错误信息则视为失败
    if result.startswith("[ERROR]") or result.startswith("[WARNING]"):
        print(f"    [ERROR] AI 返回异常: {result[:120]}")
        return False

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result)

    return True


async def main():
    print("=" * 60)
    print("  批量洗稿：教学详案 → RAG 阅读指导卡片")
    print("=" * 60)

    # 1. 目录准备
    ensure_directories()

    # 2. 扫描原始 PDF 列表
    pdf_files = sorted(
        f for f in os.listdir(RAW_DIR) if f.lower().endswith(".pdf")
    )
    total = len(pdf_files)

    if total == 0:
        print(f"\n[WARN] raw_docs 目录下未找到任何 .pdf 文件，请将文件放入:\n  {os.path.abspath(RAW_DIR)}")
        return

    print(f"\n[INFO] 共发现 {total} 个 PDF 文件，开始串行处理...\n")

    # 3. 初始化 AI 服务（脚本独立实例，避免干扰线上服务）
    ai = AIService()

    success_count = 0
    fail_count = 0

    # 4. 串行处理每个文件
    for idx, filename in enumerate(pdf_files, start=1):
        new_name = smart_rename(filename)
        pdf_path = os.path.join(RAW_DIR, filename)
        output_path = os.path.join(CLEANED_DIR, new_name)

        print(f"[{idx}/{total}] 正在处理: {filename} -> {new_name} ...", end=" ")

        try:
            ok = await process_single_file(ai, pdf_path, output_path)
            if ok:
                success_count += 1
                print("完成!")
            else:
                fail_count += 1
        except Exception as e:
            fail_count += 1
            print(f"失败! ({e})")

        # 限流保护：每处理完一个文件等待 2 秒
        if idx < total:
            await asyncio.sleep(2)

    # 5. 汇总
    print("\n" + "=" * 60)
    print(f"  [DONE] 处理完毕  成功: {success_count}  失败: {fail_count}  总计: {total}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
