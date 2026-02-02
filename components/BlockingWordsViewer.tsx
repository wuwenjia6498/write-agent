'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'

/**
 * 屏蔽词可视化组件
 * 支持表格、列表、子标题等多种格式
 */

interface TableData {
  headers: string[]
  rows: string[][]
}

interface Section {
  title: string
  description?: string
  tables?: TableData[]
  subSections?: { title: string, table?: TableData, content?: string[] }[]
  listItems?: string[]
  examples?: { bad: string, good: string }[]
}

interface BlockingWordsViewerProps {
  content: string
  onSwitchToEdit?: () => void
}


// 解析表格
function parseTable(lines: string[]): TableData | null {
  const tableLines = lines.filter(l => l.trim().startsWith('|') && !l.includes('---'))
  if (tableLines.length < 2) return null
  
  const parseRow = (line: string) => 
    line.split('|').map(c => c.trim()).filter(c => c.length > 0)
  
  const headers = parseRow(tableLines[0])
  const rows = tableLines.slice(1).map(parseRow).filter(r => r.length > 0)
  
  return { headers, rows }
}

// 解析整个内容
function parseContent(markdown: string): { sections: Section[], checklist: string[] } {
  const sections: Section[] = []
  const checklist: string[] = []
  
  // 按二级标题分割
  const parts = markdown.split(/\n## /)
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const lines = part.split('\n')
    const title = lines[0].trim()
    
    // 处理审校 Checklist
    if (title.includes('审校') || title.includes('Checklist')) {
      for (const line of lines) {
        if (line.trim().startsWith('- [')) {
          const text = line.replace(/- \[.\]\s*/, '').trim()
          if (text) checklist.push(text)
        }
      }
      continue
    }
    
    const section: Section = { title }
    
    // 提取描述（加粗文本）
    for (const line of lines.slice(1, 5)) {
      if (line.startsWith('**') && line.endsWith('**')) {
        section.description = line.replace(/\*\*/g, '')
        break
      }
    }
    
    // 检查是否有子标题（###）
    const subSectionMatches = part.split(/\n### /)
    if (subSectionMatches.length > 1) {
      section.subSections = []
      for (let j = 1; j < subSectionMatches.length; j++) {
        const subLines = subSectionMatches[j].split('\n')
        const subTitle = subLines[0].trim()
        const subTable = parseTable(subLines)
        
        // 检查是否有示例（❌ 和 ✅）
        const content: string[] = []
        for (const line of subLines) {
          if (line.includes('❌') || line.includes('✅')) {
            content.push(line.replace(/^\*\s*/, '').trim())
          }
        }
        
        section.subSections.push({ 
          title: subTitle, 
          table: subTable || undefined,
          content: content.length > 0 ? content : undefined
        })
      }
    } else {
      // 尝试解析主表格
      const table = parseTable(lines)
      if (table) {
        section.tables = [table]
      }
      
      // 检查列表项
      const listItems: string[] = []
      for (const line of lines) {
        if (line.trim().startsWith('* **') || line.trim().startsWith('- **')) {
          listItems.push(line.replace(/^[\*\-]\s*/, '').trim())
        }
      }
      if (listItems.length > 0) {
        section.listItems = listItems
      }
    }
    
    sections.push(section)
  }
  
  return { sections, checklist }
}

// 渲染表格
function TableView({ table }: { table: TableData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {table.headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-medium text-gray-600">
                {h.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
              {row.map((cell, j) => (
                <td 
                  key={j} 
                  className={`px-4 py-3 ${
                    j === 0 ? 'text-gray-900 font-medium' : 
                    j === row.length - 1 ? 'text-emerald-600' : 'text-gray-500'
                  }`}
                >
                  {cell.replace(/\*\*/g, '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BlockingWordsViewer({ content, onSwitchToEdit }: BlockingWordsViewerProps) {
  const { sections, checklist } = useMemo(() => parseContent(content), [content])
  
  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          共 {sections.length} 个阶段
        </span>
        {onSwitchToEdit && (
          <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
            切换到源码编辑
          </Button>
        )}
      </div>
      
      {/* 阶段卡片 */}
      <div className="space-y-4">
        {sections.map((section, idx) => (
            <div 
              key={idx} 
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
            >
              {/* 标题区 */}
              <div className="px-5 py-4 border-b border-gray-300 bg-gray-200">
                <h3 className="text-base font-semibold text-gray-900">
                  {section.title.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*/u, '')}
                </h3>
                {section.description && (
                  <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                )}
              </div>
              
              {/* 内容区 */}
              <div className="divide-y divide-gray-100">
                {/* 主表格 */}
                {section.tables?.map((table, i) => (
                  <TableView key={i} table={table} />
                ))}
                
                {/* 子标题区块 */}
                {section.subSections?.map((sub, i) => (
                  <div key={i} className="px-5 py-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">{sub.title}</h4>
                    {sub.table && <TableView table={sub.table} />}
                    {sub.content && (
                      <div className="space-y-2 mt-2">
                        {sub.content.map((line, j) => (
                          <p key={j} className={`text-sm ${
                            line.includes('❌') ? 'text-red-600' : 
                            line.includes('✅') ? 'text-emerald-600' : 'text-gray-600'
                          }`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* 列表项 */}
                {section.listItems && (
                  <div className="px-5 py-4">
                    <ul className="space-y-2">
                      {section.listItems.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          <span dangerouslySetInnerHTML={{ 
                            __html: item
                              .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                              .replace(/：/g, '：<span class="text-gray-500">')
                              + '</span>'
                          }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
        ))}
      </div>
      
      {/* 审校检查清单 */}
      {checklist.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-100">
            <h3 className="text-base font-semibold text-blue-900 flex items-center gap-2">
              📝 审校 Checklist（执行清单）
            </h3>
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-2">
              {checklist.map((item, idx) => (
                <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
