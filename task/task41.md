# Role
资深 Python/后端开发工程师

# Task
优化知识库文档上传的文本清洗逻辑，解决解析出的切片 (chunk) 中存在大量连续空行（空白）的问题。

# Logic Requirements
1. 找到负责处理文档解析和切片的后端代码（应该是 `server/services/document_parser.py` 或 `server/routers/admin_knowledge.py` 中的上传逻辑）。
2. 在通过 Loader 加载出纯文本后、且在传入 `RecursiveCharacterTextSplitter` 进行切片**之前**，对长文本内容进行一次正则清洗。
3. 引入 `re` 模块，使用正则表达式将连续的 3 个及以上的换行符（包括可能夹杂的空格或制表符的空行）替换为最多 2 个换行符。
   示例代码思路：
   ```python
   import re
   # 将多个连续的换行/空白行，替换为标准的双换行（段落分隔）
   cleaned_text = re.sub(r'\n\s*\n+', '\n\n', raw_text)
   # 去除首尾空白
   cleaned_text = cleaned_text.strip()
4. 将清洗后的 cleaned_text 再交给 Splitter 去进行分块（chunking）。