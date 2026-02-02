'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 胶囊标签输入组件
 * - 输入后按回车或逗号生成标签
 * - 点击 x 删除标签
 * - 蓝色胶囊状视觉效果
 */
interface TagInputProps {
  value: string[]                    // 当前标签数组
  onChange: (tags: string[]) => void // 标签变化回调
  placeholder?: string               // 输入框占位符
  className?: string                 // 容器类名
  disabled?: boolean                 // 禁用状态
  variant?: 'blue' | 'gray' | 'red'  // 颜色变体
}

const TagInput = React.forwardRef<HTMLDivElement, TagInputProps>(
  ({ value = [], onChange, placeholder = "输入后按回车添加", className, disabled, variant = 'blue' }, ref) => {
    const [inputValue, setInputValue] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    // 颜色变体配置
    const variantStyles = {
      blue: {
        tag: 'bg-[#3a5e98] text-white',
        tagHover: 'hover:bg-[#2d4a78]',
        deleteBtn: 'hover:bg-white/20'
      },
      gray: {
        tag: 'bg-gray-200 text-gray-700',
        tagHover: 'hover:bg-gray-300',
        deleteBtn: 'hover:bg-gray-400/30'
      },
      red: {
        tag: 'bg-red-100 text-red-700 border border-red-200',
        tagHover: 'hover:bg-red-200',
        deleteBtn: 'hover:bg-red-300/30'
      }
    }

    const styles = variantStyles[variant]

    // 添加标签
    const addTag = (tag: string) => {
      const normalizedTag = tag.trim()
      if (!normalizedTag) return
      
      // 避免重复
      if (!value.includes(normalizedTag)) {
        onChange([...value, normalizedTag])
      }
      setInputValue('')
    }

    // 删除标签
    const removeTag = (tagToRemove: string) => {
      onChange(value.filter(tag => tag !== tagToRemove))
    }

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        // 输入框为空时，按退格删除最后一个标签
        removeTag(value[value.length - 1])
      }
    }

    // 处理粘贴（支持逗号分隔的批量粘贴）
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text')
      if (pastedText.includes(',') || pastedText.includes('，')) {
        e.preventDefault()
        const newTags = pastedText
          .split(/[,，]/)
          .map(t => t.trim())
          .filter(t => t && !value.includes(t))
        onChange([...value, ...newTags])
      }
    }

    // 点击容器时聚焦输入框
    const handleContainerClick = () => {
      inputRef.current?.focus()
    }

    return (
      <div
        ref={ref}
        onClick={handleContainerClick}
        className={cn(
          // 容器基础样式
          "flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[42px]",
          // 轻量边框
          "border border-gray-200 hover:border-gray-300",
          // 背景
          "bg-white",
          // 聚焦样式（通过 focus-within 实现）
          "focus-within:ring-2 focus-within:ring-[#3a5e98]/20 focus-within:border-[#3a5e98]",
          // 过渡
          "transition-colors duration-200",
          // 禁用
          disabled && "opacity-50 cursor-not-allowed bg-gray-50",
          className
        )}
      >
        {/* 已添加的标签 */}
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className={cn(
              // 胶囊基础样式
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
              // 颜色变体
              styles.tag,
              styles.tagHover,
              // 过渡
              "transition-colors duration-150"
            )}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center",
                  "transition-colors duration-150",
                  styles.deleteBtn
                )}
                aria-label={`删除标签 ${tag}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* 输入框 */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => {
              // 失焦时如果有内容，自动添加为标签
              if (inputValue.trim()) {
                addTag(inputValue)
              }
            }}
            placeholder={value.length === 0 ? placeholder : ''}
            className={cn(
              "flex-1 min-w-[120px] bg-transparent outline-none text-sm",
              "placeholder:text-gray-400"
            )}
          />
        )}
      </div>
    )
  }
)

TagInput.displayName = "TagInput"

export { TagInput }
