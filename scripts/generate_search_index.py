#!/usr/bin/env python3
"""
生成搜索索引文件。

用法:
    python scripts/generate_search_index.py

运行后会提示输入经文 JSON 文件夹路径，例如:
    D:\dev\bibleflow\oss\json\zh_sigao
    D:\dev\bibleflow\oss\json\zh_cuv2010

输出:
    在输入文件夹的父目录下的 _global/search/ 目录中生成 {version}.json
    例如输入 oss/json/zh_sigao/ → 输出 oss/json/_global/search/zh_sigao.json
"""

import json
import os
import sys
import glob


def generate_index(verses_dir, output_dir):
    """根据经文 JSON 文件夹生成搜索索引。"""
    index = []
    json_files = sorted(glob.glob(os.path.join(verses_dir, "*.json")))

    if not json_files:
        print(f"⚠️ 未在 {verses_dir} 找到任何 JSON 文件")
        return index

    print(f"📂 找到 {len(json_files)} 个经文 JSON 文件，开始解析...")

    for filepath in json_files:
        filename = os.path.basename(filepath)
        # 文件名格式: {bookId}_{chapter}.json，如 01_001.json
        try:
            book_id_str, chapter_str = filename.replace(".json", "").split("_")
            book_id = int(book_id_str)
            chapter = int(chapter_str)
        except ValueError:
            print(f"  ⚠️ 跳过无法解析的文件: {filename}")
            continue

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  ⚠️ 读取失败 {filename}: {e}")
            continue

        verses = data.get("verses", [])
        for verse in verses:
            text = verse.get("text", "").strip()
            verse_id = verse.get("verse_id") or verse.get("verse")
            if text and verse_id is not None:
                index.append({
                    "b": book_id,
                    "c": chapter,
                    "v": verse_id,
                    "t": text
                })

    print(f"✅ 共提取 {len(index)} 条经文")
    return index


def main():
    print("=" * 60)
    print("  搜索索引生成器")
    print("=" * 60)
    print()

    # 输入经文文件夹路径
    verses_dir = input("请输入经文 JSON 文件夹路径（例如 D:\\dev\\bibleflow\\oss\\json\\zh_sigao）:\n> ").strip()
    verses_dir = verses_dir.strip('"').strip("'")

    if not os.path.isdir(verses_dir):
        print(f"❌ 目录不存在: {verses_dir}")
        sys.exit(1)

    # 提取版本名称（文件夹名）
    version_name = os.path.basename(verses_dir)
    print(f"\n📌 版本: {version_name}")

    # 输出目录: 输入目录的父目录下的 _global/search/
    parent_dir = os.path.dirname(verses_dir)
    output_dir = os.path.join(parent_dir, "_global", "search")
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, f"{version_name}.json")

    # 生成索引
    index = generate_index(verses_dir, output_dir)

    if not index:
        print("❌ 没有生成任何索引数据")
        sys.exit(1)

    # 写入文件
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_file)
    print(f"\n💾 索引已保存: {output_file}")
    print(f"   文件大小: {file_size:,} bytes ({file_size / 1024:.1f} KB)")
    print(f"   条目数量: {len(index)}")
    print()


if __name__ == "__main__":
    main()
