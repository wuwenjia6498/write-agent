'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import DiffViewer from '@/components/DiffViewer'

const API_BASE = 'http://localhost:8000/api'

const WORKFLOW_STEPS = [
  { id: 1, name: '理解需求', key: 'step_1_output' },
  { id: 2, name: '信息搜索', key: 'step_2_output' },
  { id: 3, name: '选题讨论', key: 'step_3_output', checkpoint: true },
  { id: 4, name: '协作文档', key: 'step_4_output' },
  { id: 5, name: '素材检索', key: 'step_5_output' },
  { id: 6, name: '挂起等待', key: 'step_6_output', checkpoint: true },
  { id: 7, name: '初稿创作', key: 'draft_content' },
  { id: 8, name: '三遍审校', key: 'final_content' },
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

  useEffect(() => {
    if (taskId) fetchTask()
  }, [taskId])

  const fetchTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        setTask(data)
        setActiveStep(data.current_step)
      }
    } catch (error) {
      console.error('获取任务详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 格式化步骤输出，针对特殊格式进行美化
  const formatStepOutput = (output: any, stepId: number): string => {
    if (typeof output === 'string') return output
    
    // Step 3: 选题讨论 - 解析 topics 格式
    if (stepId === 3 && output?.topics) {
      return output.topics
    }
    
    // Step 6: 挂起等待 - 解析 checklist 格式
    if (stepId === 6) {
      let formatted = ''
      if (output?.checklist) {
        formatted += output.checklist
      }
      if (output?.waiting_for) {
        formatted += `\n\n等待确认: ${output.waiting_for}`
      }
      return formatted || JSON.stringify(output, null, 2)
    }
    
    // 其他对象类型，格式化为 JSON
    return JSON.stringify(output, null, 2)
  }

  const getStepOutput = (step: typeof WORKFLOW_STEPS[0]) => {
    if (!task) return null
    if (step.key === 'draft_content') return task.draft_content
    if (step.key === 'final_content') return task.final_content
    
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
            {activeStep === 8 && task.draft_content && task.final_content ? (
              <DiffViewer
                draftContent={task.draft_content}
                finalContent={task.final_content}
                title="初稿 vs 终稿"
              />
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
                      <ScrollArea className="h-[500px]">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 p-4 bg-gray-50 rounded-lg">
                          {output}
                        </pre>
                      </ScrollArea>
                    )
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Think Aloud 日志 */}
            {task.think_aloud_logs && task.think_aloud_logs.length > 0 && (
              <Card className="border-gray-200 mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Think Aloud 日志</CardTitle>
                  <CardDescription>AI 思考过程记录</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {task.think_aloud_logs.map((log, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2 text-xs">
                            <Badge variant="outline">Step {log.step}</Badge>
                            <span className="text-gray-400">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                            {log.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
