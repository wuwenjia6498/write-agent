'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const API_BASE = 'http://localhost:8000/api'

interface TaskSummary {
  id: string
  title: string | null
  channel_slug: string | null
  current_step: number
  status: string
  created_at: string
  updated_at: string
  brief: string | null  // 需求简述，用于显示任务名称
}

const STEP_NAMES = [
  '', '理解需求', '信息搜索', '选题讨论', '协作文档', 
  '素材检索', '挂起等待', '初稿创作', '三遍审校', '文章配图'
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchTasks()
  }, [filterStatus])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus)
      }
      const res = await fetch(`${API_BASE}/tasks/?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'completed': '已完成',
      'processing': '进行中',
      'waiting_confirm': '等待确认',
      'error': '出错',
      'cancelled': '已取消'
    }
    return labels[status] || status
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="任务历史" subtitle="Tasks" />

      <div className="max-w-7xl mx-auto p-6">
        {/* 筛选栏 */}
        <Card className="border-gray-200 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">筛选：</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="processing">进行中</SelectItem>
                  <SelectItem value="waiting_confirm">等待确认</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500 ml-auto">
                共 {tasks.length} 个任务
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 任务列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-20 text-gray-500">加载中...</div>
          ) : tasks.length === 0 ? (
            <Card className="border-gray-200">
              <CardContent className="py-20 text-center text-gray-500">
                暂无任务记录
                <Link href="/workbench">
                  <Button className="mt-4 block mx-auto bg-[#3a5e98] hover:bg-[#2d4a78]">开始创作</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium text-gray-900 truncate max-w-md">
                            {task.title || (task.brief ? (
                              task.brief.replace(/\n/g, ' ').slice(0, 50) + (task.brief.length > 50 ? '...' : '')
                            ) : `任务 ${task.id.slice(0, 8)}`)}
                          </h3>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700 flex-shrink-0">
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>{task.channel_slug || '—'}</span>
                          <span>·</span>
                          <span>Step {task.current_step}: {STEP_NAMES[task.current_step]}</span>
                          <span>·</span>
                          <span>{new Date(task.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {/* 进度指示 */}
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5,6,7,8,9].map((step) => (
                            <div 
                              key={step}
                              className={`w-2 h-2 rounded-full ${
                                step < task.current_step ? 'bg-gray-700' :
                                step === task.current_step ? 'bg-gray-500' :
                                'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-400 text-sm">→</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
