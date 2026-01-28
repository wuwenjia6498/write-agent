'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DiffViewerProps {
  draftContent: string
  finalContent: string
  title?: string
}

export default function DiffViewer({ draftContent, finalContent, title = '初稿 vs 终稿' }: DiffViewerProps) {
  const stats = useMemo(() => {
    const draftChars = draftContent.length
    const finalChars = finalContent.length
    const charDiff = finalChars - draftChars
    
    return {
      draftChars,
      finalChars,
      charDiff,
      charDiffPercent: draftChars > 0 ? Math.round((charDiff / draftChars) * 100) : 0
    }
  }, [draftContent, finalContent])

  const diffLines = useMemo(() => {
    const draftLines = draftContent.split('\n')
    const finalLines = finalContent.split('\n')
    const maxLines = Math.max(draftLines.length, finalLines.length)
    
    const result = []
    for (let i = 0; i < maxLines; i++) {
      const draftLine = draftLines[i] || ''
      const finalLine = finalLines[i] || ''
      
      let status: 'same' | 'modified' | 'added' | 'removed' = 'same'
      
      if (draftLine === finalLine) status = 'same'
      else if (!draftLine && finalLine) status = 'added'
      else if (draftLine && !finalLine) status = 'removed'
      else status = 'modified'
      
      result.push({ lineNum: i + 1, draft: draftLine, final: finalLine, status })
    }
    
    return result
  }, [draftContent, finalContent])

  const changeStats = useMemo(() => {
    let added = 0, removed = 0, modified = 0
    diffLines.forEach(line => {
      if (line.status === 'added') added++
      else if (line.status === 'removed') removed++
      else if (line.status === 'modified') modified++
    })
    return { added, removed, modified }
  }, [diffLines])

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600">+{changeStats.added}</span>
            <span className="text-red-600">-{changeStats.removed}</span>
            <span className="text-amber-600">~{changeStats.modified}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">初稿字数</p>
            <p className="text-lg font-medium text-gray-800">{stats.draftChars}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">终稿字数</p>
            <p className="text-lg font-medium text-gray-800">{stats.finalChars}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">字数变化</p>
            <p className={`text-lg font-medium ${stats.charDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.charDiff >= 0 ? '+' : ''}{stats.charDiff}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">变化比例</p>
            <p className={`text-lg font-medium ${stats.charDiffPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.charDiffPercent >= 0 ? '+' : ''}{stats.charDiffPercent}%
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="side-by-side">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="side-by-side">并排对比</TabsTrigger>
            <TabsTrigger value="draft">初稿</TabsTrigger>
            <TabsTrigger value="final">终稿</TabsTrigger>
          </TabsList>
          
          <TabsContent value="side-by-side">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="font-medium text-gray-700">初稿</span>
                  <span className="text-xs text-gray-500">{stats.draftChars} 字</span>
                </div>
                <ScrollArea className="h-[450px] border border-gray-200 rounded-lg">
                  <div className="p-3 font-mono text-xs">
                    {diffLines.map((line) => (
                      <div
                        key={`draft-${line.lineNum}`}
                        className={`py-0.5 px-2 -mx-2 ${
                          line.status === 'removed' ? 'bg-red-50 text-red-800' :
                          line.status === 'modified' ? 'bg-amber-50' : ''
                        }`}
                      >
                        <span className="text-gray-400 w-6 inline-block text-right mr-2">{line.lineNum}</span>
                        {line.draft || <span className="text-gray-300">—</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="font-medium text-gray-700">终稿</span>
                  <span className="text-xs text-gray-500">{stats.finalChars} 字</span>
                </div>
                <ScrollArea className="h-[450px] border border-gray-200 rounded-lg">
                  <div className="p-3 font-mono text-xs">
                    {diffLines.map((line) => (
                      <div
                        key={`final-${line.lineNum}`}
                        className={`py-0.5 px-2 -mx-2 ${
                          line.status === 'added' ? 'bg-green-50 text-green-800' :
                          line.status === 'modified' ? 'bg-amber-50' : ''
                        }`}
                      >
                        <span className="text-gray-400 w-6 inline-block text-right mr-2">{line.lineNum}</span>
                        {line.final || <span className="text-gray-300">—</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="draft">
            <ScrollArea className="h-[500px] border border-gray-200 rounded-lg">
              <div className="p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                  {draftContent || '暂无内容'}
                </pre>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="final">
            <ScrollArea className="h-[500px] border border-gray-200 rounded-lg">
              <div className="p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                  {finalContent || '暂无内容'}
                </pre>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
