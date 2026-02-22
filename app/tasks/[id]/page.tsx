'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, FileText, Layers } from 'lucide-react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import ArticleEditor from '@/components/ArticleEditor'

import { API_BASE } from '@/lib/api-config'

const WORKFLOW_STEPS = [
  { id: 1, name: '理解需求', key: 'step_1_output' },
  { id: 2, name: '信息搜索', key: 'step_2_output', checkpoint: true },
  { id: 3, name: '选题讨论', key: 'step_3_output', checkpoint: true },
  { id: 4, name: '协作文档', key: 'step_4_output' },
  { id: 5, name: '风格建模', key: 'step_5_output', auto: true },
  { id: 6, name: '创作准备', key: 'step_6_output', auto: true },
  { id: 7, name: '初稿创作', key: 'draft_content' },
  { id: 8, name: '四遍审校', key: 'final_content' },
  { id: 9, name: '文章配图', key: 'step_9_output' },
]

interface TaskDetail {
  id: string
  title: string | null
  channel_id: string
  channel_slug: string | null
  current_step: number
  status: string
  brief_data: Record<string, any> | null
  knowledge_base_data: string | null
  knowledge_summary: string | null
  draft_content: string | null
  final_content: string | null
  think_aloud_logs: Array<{ step: number; timestamp: string; content: string }> | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string
  
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState(1)
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({})
  const [copiedTopicIndex, setCopiedTopicIndex] = useState<number | null>(null)
  const [editableDraft, setEditableDraft] = useState<string | null>(null)
  const [editableFinal, setEditableFinal] = useState<string | null>(null)

  useEffect(() => {
    if (taskId) fetchTask()
  }, [taskId])

  const fetchTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        setTask(data)
        setEditableDraft(data.draft_content || null)
        setEditableFinal(data.final_content || null)
        // 默认显示第一步，让用户从头浏览
        setActiveStep(1)
      }
    } catch (error) {
      console.error('获取任务详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 格式化步骤输出，针对特殊格式进行美化（与 workbench 保持一致）
  const formatStepOutput = (output: any, stepId: number): string => {
    if (typeof output === 'string') return output
    
    // Step 1: 理解需求
    if (stepId === 1) {
      if (output?.brief_summary) return output.brief_summary
      if (output?.summary) return output.summary
    }
    
    // Step 2: 信息搜索
    if (stepId === 2) {
      if (output?.summary) return output.summary
      if (output?.knowledge_summary) return output.knowledge_summary
      if (output?.content) return output.content
    }
    
    // Step 3: 选题讨论 - 解析 topics 格式
    if (stepId === 3 && output?.topics) {
      return output.topics
    }
    
    // Step 4: 协作文档
    if (stepId === 4) {
      if (output?.collaboration_doc) return output.collaboration_doc
      if (output?.document) return output.document
    }
    
    // Step 5: 风格建模 — 详情区已使用专属 Callout 卡片，此处仅做简单文本回退
    if (stepId === 5) {
      return '风格基调已锁定'
    }
    
    // Step 6: 创作准备（自动流转，详情区使用专属卡片渲染）
    if (stepId === 6) {
      return '创作上下文已自动封装'
    }
    
    // Step 9: 文章配图
    if (stepId === 9) {
      if (output?.image_suggestions) return output.image_suggestions
      if (output?.suggestions) return output.suggestions
    }
    
    // 其他对象类型，尝试提取常见字段
    if (typeof output === 'object') {
      // 尝试常见的输出字段
      if (output?.result) return typeof output.result === 'string' ? output.result : JSON.stringify(output.result, null, 2)
      if (output?.output) return typeof output.output === 'string' ? output.output : JSON.stringify(output.output, null, 2)
      if (output?.content) return output.content
      if (output?.text) return output.text
      return JSON.stringify(output, null, 2)
    }
    
    return String(output)
  }

  const getStepOutput = (step: typeof WORKFLOW_STEPS[0]) => {
    if (!task) return null
    
    // Step 7: 初稿
    if (step.key === 'draft_content') return task.draft_content
    // Step 8: 终稿
    if (step.key === 'final_content') return task.final_content
    
    // Step 2: 完整调研内容 + 来源
    if (step.id === 2) {
      let formatted = ''
      
      // 1. 完整调研内容
      if (task.knowledge_base_data) {
        formatted = task.knowledge_base_data
      } else if (task.brief_data?.step_2_output) {
        const output = task.brief_data.step_2_output
        formatted = typeof output === 'string' ? output : (output?.content || output?.summary || JSON.stringify(output, null, 2))
      }
      
      // 2. 添加来源信息
      const sources = task.brief_data?.knowledge_sources
      if (sources?.length > 0) {
        formatted += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        formatted += `📚 参考来源（${sources.length} 条）：\n\n`
        sources.forEach((source: { title: string; url: string; published_date?: string }, idx: number) => {
          formatted += `${idx + 1}. ${source.title}\n`
          formatted += `   🔗 ${source.url}\n`
          if (source.published_date) {
            formatted += `   📅 ${source.published_date}\n`
          }
          formatted += '\n'
        })
      }
      
      return formatted || null
    }
    
    // Step 5: 风格建模 — 详情区使用专属 Callout 卡片渲染，此处仅返回标记值供侧边栏判定"有产出"
    if (step.id === 5) {
      if (task.brief_data?.selected_samples?.length > 0 || task.brief_data?.step_5_output) {
        return '风格基调已锁定'
      }
      return task.current_step > 5 ? '风格基调已锁定' : null
    }
    
    // Step 6: 创作准备 — 详情区使用专属卡片渲染，此处仅返回标记值供侧边栏判定"有产出"
    if (step.id === 6) {
      return task.current_step > 6 ? '创作上下文已自动封装' : null
    }
    
    // 其他步骤从 brief_data 获取
    const output = task.brief_data?.[step.key]
    if (!output) return null
    
    // 使用格式化函数处理输出
    return formatStepOutput(output, step.id)
  }

  const getStepStatus = (stepId: number) => {
    if (!task) return 'pending'
    if (stepId < task.current_step) return 'completed'
    if (stepId === task.current_step) {
      return task.status === 'waiting_confirm' ? 'waiting' : 'active'
    }
    return 'pending'
  }

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      'completed': 'bg-gray-700',
      'active': 'bg-gray-500',
      'waiting': 'bg-gray-500',
      'pending': 'bg-gray-200'
    }
    return styles[status] || styles['pending']
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="任务详情" subtitle="Task Detail" />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="任务详情" subtitle="Task Detail" />
        <div className="flex items-center justify-center py-20">
          <Card className="p-8 text-center border-gray-200">
            <p className="text-gray-500 mb-4">任务不存在</p>
            <Link href="/tasks">
              <Button variant="outline">返回列表</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader 
        title={task.title || '任务详情'} 
        subtitle={`${task.channel_slug} · ${new Date(task.created_at).toLocaleString()}`}
      >
        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
          {task.status === 'completed' ? '已完成' :
           task.status === 'waiting_confirm' ? '等待确认' : '进行中'}
        </Badge>
      </AppHeader>

      <div className="max-w-7xl mx-auto p-6">
        {/* 返回列表按钮 */}
        <div className="mb-4">
          <Link href="/tasks">
            <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600 hover:text-gray-900 -ml-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回任务列表
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：步骤导航 */}
          <div className="col-span-3">
            <Card className="border-gray-200 sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">9 步 SOP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {WORKFLOW_STEPS.map((step) => {
                    const status = getStepStatus(step.id)
                    const hasOutput = !!getStepOutput(step)
                    
                    return (
                      <button
                        key={step.id}
                        onClick={() => setActiveStep(step.id)}
                        className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                          activeStep === step.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${getStatusStyle(status)} ${status === 'pending' ? 'text-gray-500' : 'text-white'}`}>
                          {status === 'completed' ? '✓' : step.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{step.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {step.checkpoint && <span className="text-xs text-gray-500">卡点</span>}
                            {'auto' in step && step.auto && <span className="text-xs text-gray-400">自动</span>}
                            {hasOutput && <span className="text-xs text-gray-400">有产出</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：内容展示 */}
          <div className="col-span-9">
            {activeStep === 3 ? (
              /* Step 3 特殊渲染：选题卡片形式 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step 3: {WORKFLOW_STEPS[2]?.name}
                  </CardTitle>
                  <CardDescription>此步骤为必做卡点</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <ScrollArea className="h-[650px]">
                    {(() => {
                      const step3Output = task.brief_data?.step_3_output
                      const content = typeof step3Output === 'string' ? step3Output : (step3Output?.topics || '')
                      
                      if (!content) {
                        return <div className="text-center py-16 text-gray-500">暂无产出内容</div>
                      }
                      
                      // 解析选题内容
                      const topicBlocks: { title: string; content: string }[] = []
                      
                      // 按 "---" 分隔线或 "## 选题" 格式分割
                      let blocks = content.split(/\n-{3,}\n/).filter((b: string) => b.trim())
                      
                      if (blocks.length <= 1) {
                        blocks = content.split(/(?=##\s*选题[一二三四五六七八九十\d]*[：:])/).filter((b: string) => b.trim())
                      }
                      
                      if (blocks.length <= 1) {
                        blocks = content.split(/(?=###?\s*选题方向\s*\d+|###?\s*方向\s*\d+|选题\s*\d+[：:])/).filter((b: string) => b.trim())
                      }
                      
                      if (blocks.length > 1) {
                        blocks.forEach((block: string, idx: number) => {
                          const lines = block.trim().split('\n')
                          let titleLine = lines.find((l: string) => /^##\s/.test(l)) || lines[0]
                          let title = titleLine?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim() || `选题 ${idx + 1}`
                          if (title.length > 50) title = title.slice(0, 50) + '...'
                          topicBlocks.push({ title, content: block.trim() })
                        })
                      } else {
                        topicBlocks.push({ title: '选题方案', content })
                      }
                      
                      const isRecommendation = (title: string) => 
                        title.includes('综合推荐') || title.includes('推荐') || title.includes('总结')
                      
                      return (
                        <div className="space-y-3 p-2">
                          {topicBlocks.map((topic, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-[#3a5e98]/50 transition-colors">
                              {/* 选题标题栏 */}
                              <div 
                                className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${
                                  !isRecommendation(topic.title) ? 'cursor-pointer hover:bg-gray-100' : ''
                                } transition-colors`}
                                onClick={() => !isRecommendation(topic.title) && setExpandedTopics(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              >
                                <span className="font-medium text-gray-800">{topic.title}</span>
                                <div className="flex items-center gap-2">
                                  {/* 复制按钮 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard.writeText(topic.content)
                                      setCopiedTopicIndex(idx)
                                      setTimeout(() => setCopiedTopicIndex(null), 2000)
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      copiedTopicIndex === idx 
                                        ? 'bg-green-100 text-green-600' 
                                        : 'text-gray-400 hover:text-[#3a5e98] hover:bg-[#3a5e98]/10'
                                    }`}
                                    title={copiedTopicIndex === idx ? '已复制' : '复制'}
                                  >
                                    {copiedTopicIndex === idx ? (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </button>
                                  {/* 展开/收起图标 */}
                                  {!isRecommendation(topic.title) && (
                                    <svg 
                                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedTopics[idx] ? 'rotate-180' : ''}`} 
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              
                              {/* 选题内容 */}
                              {(expandedTopics[idx] || isRecommendation(topic.title)) && (
                                <div className="px-4 py-4 border-t border-gray-100">
                                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                                    {topic.content}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : activeStep === 2 ? (
              /* Step 2 特殊渲染：支持点击来源链接 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step 2: {WORKFLOW_STEPS[1]?.name}
                  </CardTitle>
                  <CardDescription>此步骤为必做卡点</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <ScrollArea className="h-[650px]">
                    {(() => {
                      const knowledgeContent = task.knowledge_base_data || task.brief_data?.step_2_output
                      const sources = task.brief_data?.knowledge_sources || []
                      
                      if (!knowledgeContent && sources.length === 0) {
                        return <div className="text-center py-16 text-gray-500">暂无产出内容</div>
                      }
                      
                      // 解析内容中的 [来源X] 标记，替换为可点击链接
                      const renderContentWithLinks = (content: string) => {
                        if (!content || sources.length === 0) return content
                        
                        // 匹配 [来源X] 或 [来源 X] 格式
                        const parts = content.split(/(\[来源\s*\d+\])/g)
                        
                        return parts.map((part, idx) => {
                          const match = part.match(/\[来源\s*(\d+)\]/)
                          if (match) {
                            const sourceIdx = parseInt(match[1]) - 1
                            const source = sources[sourceIdx]
                            if (source) {
                              return (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#3a5e98] hover:underline font-medium"
                                  title={source.title}
                                >
                                  {part}
                                </a>
                              )
                            }
                          }
                          return part
                        })
                      }
                      
                      const contentStr = typeof knowledgeContent === 'string' 
                        ? knowledgeContent 
                        : (knowledgeContent?.content || knowledgeContent?.summary || '')
                      
                      return (
                        <div className="space-y-6 p-4">
                          {/* 调研内容 */}
                          {contentStr && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>📝</span> 调研内容
                              </h3>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                                  {renderContentWithLinks(contentStr)}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* 参考来源 */}
                          {sources.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>📚</span> 参考来源（{sources.length} 条）
                              </h3>
                              <div className="space-y-2">
                                {sources.map((source: { title: string; url: string; published_date?: string }, idx: number) => (
                                  <div key={idx} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                                    <div>
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gray-800 hover:text-[#3a5e98] hover:underline"
                                      >
                                        {idx + 1}. {source.title}
                                      </a>
                                      <p className="text-xs text-gray-400 mt-0.5 break-all">
                                        🔗 {source.url}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : activeStep === 5 ? (
              /* Step 5: 风格建模 — 与工作台同步的 Callout 卡片 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step 5: {WORKFLOW_STEPS[4]?.name}
                  </CardTitle>
                  <CardDescription>自动流转</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  {(() => {
                    const samples: Array<{id: string, title: string}> = task.brief_data?.selected_samples || []
                    
                    if (samples.length > 0) {
                      return (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">风格基调已自动锁定</p>
                              <p className="text-sm text-slate-500 mt-1">
                                创作时 AI 已从样文库中抽取了以下标杆文章进行排版与语气复刻：
                              </p>
                              <div className="mt-3 flex flex-col gap-2">
                                {samples.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center bg-white border border-slate-200 rounded-md px-3 py-2 shadow-sm"
                                  >
                                    <FileText className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                                    <span className="text-sm text-slate-700">《{s.title}》</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">风格基调已自动锁定</p>
                            <p className="text-sm text-slate-500 mt-0.5">旧版数据无法显示具体样文</p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            ) : activeStep === 6 ? (
              /* Step 6: 创作准备 — 极简状态卡片 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step 6: {WORKFLOW_STEPS[5]?.name}
                  </CardTitle>
                  <CardDescription>自动流转</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                      <Layers className="w-5 h-5 text-slate-700 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">创作上下文已自动封装</p>
                        <p className="text-sm text-slate-500 mt-1 mb-3">系统已整合 RAG 检索事实与标杆样文特征，无缝切入初稿创作阶段。</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (activeStep === 7 || activeStep === 8) && (editableDraft || editableFinal) ? (
              /* Step 7/8：使用 ArticleEditor 支持划词重写 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step {activeStep}: {WORKFLOW_STEPS[activeStep - 1]?.name}
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <ScrollArea className="h-[650px]">
                    <ArticleEditor
                      content={activeStep === 7 ? (editableDraft || '') : (editableFinal || editableDraft || '')}
                      onContentChange={(newContent) => {
                        if (activeStep === 7) setEditableDraft(newContent)
                        else setEditableFinal(newContent)
                      }}
                      taskId={taskId}
                      channelSlug={task?.channel_slug || ''}
                      contentType={activeStep === 7 ? 'draft' : 'final'}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step {activeStep}: {WORKFLOW_STEPS[activeStep - 1]?.name}
                  </CardTitle>
                  {WORKFLOW_STEPS[activeStep - 1]?.checkpoint && (
                    <CardDescription>此步骤为必做卡点</CardDescription>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  {(() => {
                    const output = getStepOutput(WORKFLOW_STEPS[activeStep - 1])
                    
                    if (!output) {
                      return (
                        <div className="text-center py-16 text-gray-500">
                          暂无产出内容
                        </div>
                      )
                    }
                    
                    return (
                      <ScrollArea className="h-[650px]">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 p-4 bg-gray-50 rounded-lg">
                          {output}
                        </pre>
                      </ScrollArea>
                    )
                  })()}
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
      
    </div>
  )
}
