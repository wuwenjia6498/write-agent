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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

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
  '风格建模', '挂起等待', '初稿创作', '四遍审校', '文章配图'
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [deletingTask, setDeletingTask] = useState<TaskSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [filterStatus])

  const handleDeleteTask = async (taskId: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setDeletingTask(null)
      } else {
        alert('删除失败，请重试')
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

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
              <Card key={task.id} className="border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0 cursor-pointer">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 truncate max-w-md hover:text-[#3a5e98]">
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
                    </Link>
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
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeletingTask(task)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="删除任务"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      
      {/* 删除确认对话框 */}
      <Dialog open={!!deletingTask} onOpenChange={() => !isDeleting && setDeletingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除任务「{deletingTask?.title || deletingTask?.brief?.slice(0, 30) || '未命名任务'}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingTask(null)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              onClick={() => deletingTask && handleDeleteTask(deletingTask.id)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
