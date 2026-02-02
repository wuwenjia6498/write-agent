'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 自适应高度的文本框组件
 * - 默认显示指定行数（minRows）
 * - 随内容自动向下延伸
 * - 支持最大行数限制（maxRows）
 */
interface AutoResizeTextareaProps extends React.ComponentProps<"textarea"> {
  minRows?: number  // 最小行数，默认3
  maxRows?: number  // 最大行数，默认10
}

const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, minRows = 3, maxRows = 10, onChange, value, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const combinedRef = (node: HTMLTextAreaElement) => {
    textareaRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  // 计算行高（约20px每行）
  const lineHeight = 20
  const minHeight = minRows * lineHeight + 16 // 16px for padding
  const maxHeight = maxRows * lineHeight + 16

  // 自动调整高度
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 先重置高度以获取正确的scrollHeight
    textarea.style.height = 'auto'
    
    // 计算新高度
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [minHeight, maxHeight])

  // 监听值变化
  React.useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // 初始化时调整高度
  React.useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight()
    onChange?.(e)
  }

  return (
    <textarea
      ref={combinedRef}
      value={value}
      onChange={handleChange}
      className={cn(
        // 基础样式 - 减弱边框存在感
        "flex w-full rounded-lg bg-white px-3 py-2 text-sm text-gray-900",
        // 轻量边框 - 降噪设计
        "border border-gray-200 hover:border-gray-300",
        // 聚焦样式
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5e98]/20 focus-visible:border-[#3a5e98]",
        // 禁用状态
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
        // 占位符
        "placeholder:text-gray-400",
        // 过渡动画
        "transition-colors duration-200",
        // 禁用手动调整大小（由组件自动控制）
        "resize-none",
        className
      )}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        overflow: 'auto'
      }}
      {...props}
    />
  )
})

AutoResizeTextarea.displayName = "AutoResizeTextarea"

export { AutoResizeTextarea }
