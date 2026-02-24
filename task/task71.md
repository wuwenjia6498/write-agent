# Role
前端开发工程师 (UX 与数据处理专家)

# Task
修复 `components/ArticleEditor.tsx` 中“一键复制”功能的两个严重 Bug：1. 复制按钮滚动后不可见；2. 复制内容错误地包含了“审校报告”。

# Action
请对 `ArticleEditor` 组件进行以下精准修复：

## 1. 按钮吸顶悬浮 (解决被滚掉的问题)
- **UI 调整**：不要将复制按钮使用 `absolute` 定位在整个长文章容器的右上角。
- **最佳方案**：将复制按钮移动到咱们之前创建的**吸顶悬浮提示条（Hint Bar）的右侧**。由于提示条已经是 `sticky top-0` 且在滚动时始终可见，复制按钮放在它里面（使用 `flex justify-between` 或绝对定位在提示条内部）就能完美实现全局可见。

## 2. 文本清洗拦截器 (解决复制了审校报告的问题)
- **逻辑调整**：在 `handleCopy` 函数中，绝不能直接 `navigator.clipboard.writeText(content)`。
- **新增清洗函数**：在写入剪贴板之前，利用正则或字符串分割，截取真正的文章正文。
- **代码参考**（请将此逻辑加入 `handleCopy`）：
  ```javascript
  // 识别拼盘结构：通常以 "---" 或 "# 修改后版本" 或两者结合来分割
  let textToCopy = content;
  const splitRegex = /---\s*\n*#*\s*修改后版本\s*\n*/; 
  const parts = textToCopy.split(splitRegex);
  
  if (parts.length > 1) {
    // 如果存在分割线，取分割线后面的最后一部分作为纯正文
    textToCopy = parts[parts.length - 1].trim();
  } else {
    // 如果没有标准的分割线，尝试仅匹配 "修改后版本"
    const fallbackParts = textToCopy.split(/修改后版本\s*\n*/);
    if (fallbackParts.length > 1) {
        textToCopy = fallbackParts[fallbackParts.length - 1].trim();
    }
  }
  
  // 最后执行复制
  navigator.clipboard.writeText(textToCopy);