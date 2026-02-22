# -*- coding: utf-8 -*-
"""
脚本 A: 导入课标推荐书目 (CSV → CurriculumBook)
数据源: data_source/primary_school/books.csv
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
from sqlalchemy import text
from database.config import engine, SessionLocal
from database.models import Base, CurriculumBook

# 数据源路径（相对于项目根目录）
CSV_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data_source", "primary_school", "books.csv"
)


def init_table():
    """确保 curriculum_books 表存在"""
    Base.metadata.create_all(bind=engine)
    print("[INFO] 数据库表已就绪")


def load_and_clean_csv(path: str) -> pd.DataFrame:
    """
    读取并清洗 CSV 数据

    字段映射:
      title          <- 书名
      author         <- 作者
      grade          <- grade
      content_intro  <- 内容简介
      reading_suggestion <- 阅读要点 + 阅读建议（合并）
    """
    print(f"[INFO] 正在读取 CSV: {path}")
    df = pd.read_csv(path, encoding="utf-8")
    print(f"[INFO] 原始行数: {len(df)}")

    # 只保留有书名的行
    df = df.dropna(subset=["书名"])
    df = df[df["书名"].str.strip() != ""]

    # 清洗各列
    for col in ["书名", "作者", "grade", "内容简介", "阅读要点", "阅读建议"]:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()

    # 合并 阅读要点 + 阅读建议
    df["reading_suggestion"] = df.apply(
        lambda row: _merge_suggestions(row.get("阅读要点", ""), row.get("阅读建议", "")),
        axis=1,
    )

    print(f"[INFO] 清洗后有效行数: {len(df)}")
    return df


def _merge_suggestions(points: str, advice: str) -> str:
    """将阅读要点和阅读建议合并为一个字段"""
    parts = []
    if points:
        parts.append(points)
    if advice:
        parts.append(advice)
    return "\n\n".join(parts) if parts else ""


def import_books(df: pd.DataFrame):
    """批量插入数据到 curriculum_books 表"""
    db = SessionLocal()
    try:
        # 先清空旧数据（幂等导入）
        db.execute(text("DELETE FROM curriculum_books"))
        print("[INFO] 已清空 curriculum_books 表旧数据")

        count = 0
        for _, row in df.iterrows():
            book = CurriculumBook(
                title=row["书名"],
                author=row["作者"] if row["作者"] else None,
                grade=row["grade"] if row["grade"] else None,
                content_intro=row["内容简介"] if row["内容简介"] else None,
                reading_suggestion=row["reading_suggestion"] if row["reading_suggestion"] else None,
            )
            db.add(book)
            count += 1

        db.commit()
    finally:
        db.close()

    # 统计年级分布
    grades = sorted(df["grade"].unique().tolist())
    grades = [g for g in grades if g]
    print(f"[SUCCESS] 成功导入 {count} 本书，涵盖年级: {grades}")


def main():
    csv_path = os.path.abspath(CSV_PATH)
    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV 文件不存在: {csv_path}")
        sys.exit(1)

    init_table()
    df = load_and_clean_csv(csv_path)
    import_books(df)
    print("[INFO] 导入完成")


if __name__ == "__main__":
    main()
