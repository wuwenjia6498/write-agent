#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Excel 合并脚本
功能：读取小学生读书会书目.xlsx 的所有 Sheets，合并成一个 CSV 文件
作者：AI Assistant
日期：2026-02-13
"""

import pandas as pd
import os
from pathlib import Path


def merge_excel_to_csv():
    """
    合并 Excel 文件的所有 Sheets 到一个 CSV 文件
    """
    # 定义文件路径
    excel_file = Path("data_source/primary_school/小学生读书会书目.xlsx")
    output_csv = Path("data_source/primary_school/books_merged.csv")
    
    # 检查输入文件是否存在
    if not excel_file.exists():
        print(f"错误：找不到文件 {excel_file}")
        return
    
    print(f"正在读取文件：{excel_file}")
    
    try:
        # 读取 Excel 文件
        excel_file_obj = pd.ExcelFile(excel_file)
        
        # 获取所有 Sheet 名称
        sheet_names = excel_file_obj.sheet_names
        print(f"发现 {len(sheet_names)} 个 Sheets：{sheet_names}")
        
        # 存储所有 DataFrame
        all_dataframes = []
        
        # 遍历每个 Sheet
        for sheet_name in sheet_names:
            print(f"\n处理 Sheet: {sheet_name}")
            
            # 读取当前 Sheet
            df = pd.read_excel(excel_file_obj, sheet_name=sheet_name)
            
            # 统一列名：将"序号"改为"编号"
            if '序号' in df.columns:
                df.rename(columns={'序号': '编号'}, inplace=True)
            
            # 添加年级列
            df['grade'] = sheet_name
            
            # 显示当前 Sheet 的信息
            print(f"  - 读取到 {len(df)} 行数据")
            print(f"  - 列名：{df.columns.tolist()}")
            
            # 添加到列表
            all_dataframes.append(df)
        
        # 合并所有 DataFrame
        print("\n正在合并所有数据...")
        merged_df = pd.concat(all_dataframes, ignore_index=True)
        
        # 确保输出目录存在
        output_csv.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存为 CSV 文件（使用 utf-8-sig 编码防止中文乱码）
        merged_df.to_csv(output_csv, index=False, encoding='utf-8-sig')
        
        # 打印统计信息
        print(f"\n{'='*60}")
        print(f"[成功] 合并完成！")
        print(f"{'='*60}")
        print(f"总共处理了 {len(merged_df)} 本书")
        print(f"合并了 {len(sheet_names)} 个年级的数据")
        print(f"输出文件：{output_csv.absolute()}")
        print(f"文件大小：{output_csv.stat().st_size / 1024:.2f} KB")
        print(f"{'='*60}")
        
        # 显示每个年级的书籍数量
        print("\n各年级书籍数量统计：")
        grade_counts = merged_df['grade'].value_counts().sort_index()
        for grade, count in grade_counts.items():
            print(f"  {grade}: {count} 本")
        
        # 显示前几行数据预览
        print("\n数据预览（前 5 行）：")
        print(merged_df.head())
        
    except Exception as e:
        print(f"\n错误：处理文件时出现异常")
        print(f"详细信息：{e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("="*60)
    print("小学生读书会书目 Excel 合并工具")
    print("="*60)
    merge_excel_to_csv()
