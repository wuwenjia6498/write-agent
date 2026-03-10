'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { API_BASE } from '@/lib/api-config'

// ============================================================================
// Types
// ============================================================================

interface ArticleEditorProps {
  content: string
  onContentChange?: (newContent: string) => void
  taskId: string
  channelSlug: string
  /** 写入 draft_content 还是 final_content */
  contentType?: 'draft' | 'final'
  /** 只读模式：禁用划词重写（但仍渲染文章） */
  readOnly?: boolean
}

interface SelectionInfo {
  text: string
  startIndex: number
  endIndex: number
  rect: DOMRect
}

// ============================================================================
// 组件
// ============================================================================

export default function ArticleEditor({
  content,
  onContentChange,
  taskId,
  channelSlug,
  contentType = 'final',
  readOnly = false,
}: ArticleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [instruction, setInstruction] = useState('')
  const [isRewriting, setIsRewriting] = useState(false)
  const [suggestedText, setSuggestedText] = useState<string | null>(null)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [copied, setCopied] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 浮层模式：AI 重写 or 手动替换
  const [popoverMode, setPopoverMode] = useState<'ai' | 'manual'>('ai')
  // 手动替换模式下用户编辑的文本（预填为选中原文）
  const [manualText, setManualText] = useState('')

  // 浮层是否处于活跃状态（输入中 / 加载中 / 预览中）
  const isPopoverActive = !!(selection || isRewriting || suggestedText)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  // 一键复制全文（自动剥离审校报告，仅保留纯正文）
  const handleCopy = useCallback(async () => {
    try {
      let textToCopy = content
      const splitRegex = /---\s*\n*#*\s*修改后版本\s*\n*/
      const parts = textToCopy.split(splitRegex)

      if (parts.length > 1) {
        textToCopy = parts[parts.length - 1].trim()
      } else {
        const fallbackParts = textToCopy.split(/修改后版本\s*\n*/)
        if (fallbackParts.length > 1) {
          textToCopy = fallbackParts[fallbackParts.length - 1].trim()
        }
      }

      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      showToast('全文已成功复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('复制失败，请手动选择复制')
    }
  }, [content, showToast])

  // 清空所有浮层相关状态
  const resetPopover = useCallback(() => {
    setSelection(null)
    setInstruction('')
    setIsRewriting(false)
    setSuggestedText(null)
    setHighlightRange(null)
    setPopoverMode('ai')
    setManualText('')
  }, [])

  // ========================================================================
  // 静默保存（防抖 800ms）
  // ========================================================================
  const silentSave = useCallback(
    (newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/ai/update-article`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task_id: taskId,
              content: newContent,
              content_type: contentType,
            }),
          })
          if (res.ok) showToast('修改已自动保存')
        } catch {
          console.error('静默保存失败')
        }
      }, 800)
    },
    [taskId, contentType, showToast],
  )

  // ========================================================================
  // 手动替换：直接用 manualText 替换选区，不调用 AI
  // ========================================================================
  const handleManualAccept = useCallback(() => {
    if (!selection) return
    const trimmed = manualText  // 保留用户输入原样，不做 trim

    const newContent =
      content.slice(0, selection.startIndex) +
      trimmed +
      content.slice(selection.endIndex)

    setHighlightRange({
      start: selection.startIndex,
      end: selection.startIndex + trimmed.length,
    })

    onContentChange?.(newContent)
    setSelection(null)
    setInstruction('')
    setManualText('')
    setPopoverMode('ai')

    setTimeout(() => setHighlightRange(null), 2000)
    silentSave(newContent)
  }, [selection, manualText, content, onContentChange, silentSave])

  // ========================================================================
  // 划词：计算选区在纯文本中的精确索引（TreeWalker）
  // ========================================================================
  const handleMouseUp = useCallback(() => {
    if (readOnly || isRewriting || suggestedText) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelection(null)
      return
    }

    const range = sel.getRangeAt(0)
    const selectedText = sel.toString()
    if (!selectedText.trim() || !articleRef.current) {
      setSelection(null)
      return
    }

    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null)
      return
    }

    const walker = document.createTreeWalker(
      articleRef.current,
      NodeFilter.SHOW_TEXT,
      null,
    )

    let charOffset = 0
    let startIndex = -1
    let endIndex = -1
    let node: Text | null

    while ((node = walker.nextNode() as Text | null)) {
      const nodeLen = node.textContent?.length ?? 0

      if (node === range.startContainer) {
        startIndex = charOffset + range.startOffset
      }
      if (node === range.endContainer) {
        endIndex = charOffset + range.endOffset
        break
      }

      charOffset += nodeLen
    }

    if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) {
      setSelection(null)
      return
    }

    const rect = range.getBoundingClientRect()

    setSelection({ text: selectedText, startIndex, endIndex, rect })
    setInstruction('')
    setSuggestedText(null)
    setManualText(selectedText)  // 手动模式预填原文，方便在原基础上编辑
    setPopoverMode('ai')         // 每次划词重置为默认 AI 模式
  }, [readOnly, isRewriting, suggestedText])

  // 点击其他区域关闭浮层（预览模式下不关闭）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-rewrite-popover]')) return
      if (!isRewriting && !suggestedText) setSelection(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isRewriting, suggestedText])

  // ========================================================================
  // 调用 AI 重写（结果暂存到 suggestedText，不直接替换）
  // extraInstruction: 可选的附加指令，重试时用于要求 AI 给出不同版本
  // ========================================================================
  const handleRewrite = useCallback(async (extraInstruction?: string) => {
    if (!selection || !instruction.trim()) return
    setIsRewriting(true)
    setSuggestedText(null)

    setHighlightRange({ start: selection.startIndex, end: selection.endIndex })

    const ctxStart = Math.max(0, selection.startIndex - 200)
    const ctxEnd = Math.min(content.length, selection.endIndex + 200)
    const surroundingContext = content.slice(ctxStart, ctxEnd)

    const finalInstruction = extraInstruction
      ? `${instruction}（${extraInstruction}）`
      : instruction

    try {
      const res = await fetch(`${API_BASE}/ai/inline-rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          channel_slug: channelSlug,
          selected_text: selection.text,
          surrounding_context: surroundingContext,
          user_instruction: finalInstruction,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '请求失败' }))
        showToast(`重写失败: ${err.detail || '未知错误'}`)
        setHighlightRange(null)
        setIsRewriting(false)
        return
      }

      const data = await res.json()
      setSuggestedText(data.rewritten_text)
    } catch {
      showToast('网络错误，请重试')
      setHighlightRange(null)
    } finally {
      setIsRewriting(false)
    }
  }, [selection, instruction, content, taskId, channelSlug, showToast])

  // ========================================================================
  // 预览模式操作
  // ========================================================================

  // ✅ 替换：执行精确索引切片替换
  const handleAccept = useCallback(() => {
    if (!selection || !suggestedText) return

    const newContent =
      content.slice(0, selection.startIndex) +
      suggestedText +
      content.slice(selection.endIndex)

    setHighlightRange({
      start: selection.startIndex,
      end: selection.startIndex + suggestedText.length,
    })

    onContentChange?.(newContent)
    setSuggestedText(null)
    setSelection(null)
    setInstruction('')

    setTimeout(() => setHighlightRange(null), 2000)
    silentSave(newContent)
  }, [selection, suggestedText, content, onContentChange, silentSave])

  // 🔄 重试：附加"提供不同写法"的隐式指令，强制 AI 给出有别于上次的版本
  const handleRetry = useCallback(() => {
    setSuggestedText(null)
    handleRewrite('请提供与上次完全不同的新写法，换一种角度和表达方式')
  }, [handleRewrite])

  // ❌ 取消：放弃修改，关闭浮层
  const handleDiscard = useCallback(() => {
    resetPopover()
  }, [resetPopover])

  // ========================================================================
  // 渲染文章文本（支持高亮区间）
  // ========================================================================
  const renderContent = () => {
    if (!highlightRange) {
      return <span>{content}</span>
    }

    const { start, end } = highlightRange
    const before = content.slice(0, start)
    const highlighted = content.slice(start, end)
    const after = content.slice(end)

    return (
      <>
        <span>{before}</span>
        <mark
          className={`rounded px-0.5 transition-colors duration-1000 ${
            isRewriting || suggestedText
              ? 'bg-blue-100 animate-pulse'
              : 'bg-emerald-100'
          }`}
        >
          {highlighted}
        </mark>
        <span>{after}</span>
      </>
    )
  }

  // ========================================================================
  // 浮层定位
  // ========================================================================
  const getPopoverStyle = (): React.CSSProperties => {
    if (!selection) return { display: 'none' }

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return { display: 'none' }

    const popoverWidth = suggestedText ? 460 : 460

    return {
      position: 'absolute',
      top: selection.rect.bottom - containerRect.top + 8,
      left: Math.max(
        0,
        Math.min(
          selection.rect.left - containerRect.left,
          containerRect.width - popoverWidth,
        ),
      ),
      zIndex: 50,
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* 吸顶工具栏：提示条 + 复制按钮 */}
      <div className="sticky top-0 z-50 flex items-center gap-2 px-3.5 py-2 mb-2 rounded-lg bg-blue-50/90 border border-blue-200 text-blue-700 text-sm leading-relaxed shadow-sm backdrop-blur">
        {!readOnly && showHint ? (
          <>
            <svg className="w-4 h-4 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15 4-1 1-9 9-3 4 4-3 9-9 1-1m-1 0 2.869-2.869a1.25 1.25 0 0 1 1.765 0l1.235 1.235a1.25 1.25 0 0 1 0 1.765L18 7m-3-3 3 3" /></svg>
            <span className="flex-1"><strong className="font-semibold">划词编辑已启用</strong>：划选任意文字，可选择「AI 重写」或「手动替换」两种方式进行局部修改。</span>
          </>
        ) : (
          <span className="flex-1" />
        )}

        {/* 一键复制按钮 */}
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-200 ${
            copied
              ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
              : 'bg-white/80 border-blue-200 text-blue-600 hover:bg-white hover:border-blue-300'
          }`}
          title="复制全文到剪贴板"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制
            </>
          )}
        </button>

        {/* 关闭提示按钮 */}
        {!readOnly && showHint && (
          <button
            onClick={() => setShowHint(false)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
            title="关闭提示"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 文章正文 */}
      <div
        ref={articleRef}
        className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed p-4 bg-gray-50 rounded-lg select-text cursor-text min-h-[200px]"
        onMouseUp={handleMouseUp}
      >
        {renderContent()}
      </div>

      {/* ================================================================
       * 浮层：状态 A（输入模式）— 划词后弹出，支持 AI 重写 / 手动替换 两种模式
       * ================================================================ */}
      {selection && !isRewriting && !suggestedText && (
        <div
          data-rewrite-popover
          style={getPopoverStyle()}
          className="w-[460px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* 模式切换标签栏 */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setPopoverMode('ai')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                popoverMode === 'ai'
                  ? 'text-[#3a5e98] border-b-2 border-[#3a5e98] bg-blue-50/40'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 4-1 1m0 0-9 9-3 4 4-3 9-9m-1-1 2.869-2.869a1.25 1.25 0 0 1 1.765 0l1.235 1.235a1.25 1.25 0 0 1 0 1.765L18 7m-3-3 3 3" />
              </svg>
              AI 重写
            </button>
            <button
              onClick={() => setPopoverMode('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                popoverMode === 'manual'
                  ? 'text-slate-700 border-b-2 border-slate-600 bg-slate-50/60'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              手动替换
            </button>
          </div>

          {/* AI 重写模式 */}
          {popoverMode === 'ai' && (
            <div className="p-3 flex items-end gap-2.5">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleRewrite()
                  }
                  if (e.key === 'Escape') resetPopover()
                }}
                placeholder="告诉 AI 怎么改，如：换个更口语化的表达..."
                rows={2}
                className="flex-1 text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-gray-50 resize-none leading-relaxed"
                autoFocus
              />
              <button
                onClick={() => handleRewrite()}
                disabled={!instruction.trim()}
                className="flex-shrink-0 w-10 h-10 self-end flex items-center justify-center rounded-lg bg-[#3a5e98] hover:bg-[#2d4a78] text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                title="AI 重写（Enter 快速触发）"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 4-1 1m0 0-9 9-3 4 4-3 9-9m-1-1 2.869-2.869a1.25 1.25 0 0 1 1.765 0l1.235 1.235a1.25 1.25 0 0 1 0 1.765L18 7m-3-3 3 3" />
                  <path d="m6 6 1.5-1.5M2 10l1.5-1.5M10 2l-1.5 1.5" />
                </svg>
              </button>
            </div>
          )}

          {/* 手动替换模式 */}
          {popoverMode === 'manual' && (
            <div className="p-3 flex flex-col gap-2.5">
              <p className="text-xs text-slate-400 leading-relaxed">
                直接修改下方文字，完成后点击「确认替换」即可：
              </p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') resetPopover()
                }}
                rows={4}
                className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-gray-50 resize-none leading-relaxed"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleManualAccept}
                  disabled={manualText === selection?.text}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="直接替换为您输入的文字"
                >
                  ✅ 确认替换
                </button>
                <button
                  onClick={() => {
                    if (!selection) return
                    const newContent =
                      content.slice(0, selection.startIndex) +
                      content.slice(selection.endIndex)
                    onContentChange?.(newContent)
                    setSelection(null)
                    setInstruction('')
                    setManualText('')
                    setPopoverMode('ai')
                    silentSave(newContent)
                  }}
                  className="flex-shrink-0 flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors"
                  title="直接删除选中的文字"
                >
                  🗑️ 删除
                </button>
                <button
                  onClick={resetPopover}
                  className="flex-shrink-0 px-3 py-1.5 text-sm text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
       * 浮层：加载中
       * ================================================================ */}
      {isRewriting && (
        <div
          data-rewrite-popover
          style={getPopoverStyle()}
          className="w-[280px] bg-white border border-blue-200 rounded-xl shadow-xl p-3 flex items-center gap-3"
        >
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-blue-700">AI 正在重写中...</span>
        </div>
      )}

      {/* ================================================================
       * 浮层：状态 B（预览与决策模式）— 展示 AI 建议（可编辑）+ 三按钮
       * ================================================================ */}
      {selection && suggestedText !== null && !isRewriting && (
        <div
          data-rewrite-popover
          style={getPopoverStyle()}
          className="w-[460px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* 可编辑预览区 */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              AI 建议替换为
              <span className="ml-1.5 text-slate-400 font-normal">（可直接编辑后再替换）</span>
            </p>
            <textarea
              value={suggestedText}
              onChange={(e) => setSuggestedText(e.target.value)}
              rows={5}
              className="w-full text-sm px-3 py-2.5 bg-emerald-50 border border-emerald-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none leading-relaxed text-gray-800"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#3a5e98] hover:bg-[#2d4a78] rounded-lg transition-colors"
            >
              <span>✅</span> 替换
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <span>🔄</span> 重试
            </button>
            <button
              onClick={handleDiscard}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors"
            >
              <span>❌</span> 取消
            </button>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] px-4 py-2.5 bg-gray-800 text-white text-sm rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toast}
        </div>
      )}
    </div>
  )
}
