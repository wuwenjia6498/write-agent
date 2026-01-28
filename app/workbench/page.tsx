'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import WorkflowProgress from '@/components/WorkflowProgress'
import ThinkAloud from '@/components/ThinkAloud'
import ChannelSelector from '@/components/ChannelSelector'
import { subscribeToTask } from '@/lib/supabase'

// 步骤定义
const WORKFLOW_STEPS = [
  { step: 1, name: '理解需求 & 保存Brief', desc: '明确需求，保存文档' },
  { step: 2, name: '信息搜索与知识管理', desc: '强制调研，确保准确性' },
  { step: 3, name: '选题讨论（必做）', desc: '避免方向错误，减少返工', checkpoint: true },
  { step: 4, name: '创建协作文档', desc: '明确AI与用户分工' },
  { step: 5, name: '风格与素材检索', desc: '学习风格，调用真实素材' },
  { step: 6, name: '挂起等待', desc: '获取真实数据前不创作', checkpoint: true },
  { step: 7, name: '初稿创作', desc: '融入个人视角，严禁空洞' },
  { step: 8, name: '三遍审校机制', desc: '内容审校 → 风格审校 → 细节打磨' },
  { step: 9, name: '文章配图', desc: '提供配图方案与Markdown代码' },
]

// 定义未完成任务的类型
interface PendingTask {
  id: string
  title: string | null
  channel_slug: string
  current_step: number
  status: string
  created_at: string
  updated_at: string
  brief: string | null  // 需求简述，用于显示任务名称
}

export default function WorkbenchPage() {
  // 基础状态
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [workflowStarted, setWorkflowStarted] = useState(false)
  const [brief, setBrief] = useState('')
  const [taskId, setTaskId] = useState<string>('')
  
  // 任务状态
  const [currentStep, setCurrentStep] = useState(1)
  const [status, setStatus] = useState<string>('pending')
  const [stepOutputs, setStepOutputs] = useState<Record<number, string>>({})
  const [thinkAloudLogs, setThinkAloudLogs] = useState<any[]>([])
  
  // 用户输入
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [userMaterials, setUserMaterials] = useState<string>('')
  
  // 加载状态
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string>('')
  
  // 查看模式：用于查看历史步骤输出
  const [viewingStep, setViewingStep] = useState<number | null>(null)
  
  // 恢复任务相关状态
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  
  // ============================================================================
  // 中止任务
  // ============================================================================
  const handleAbortTask = async () => {
    if (!taskId) return
    
    if (!confirm('确定要中止当前创作任务吗？已完成的步骤内容将被保留。')) {
      return
    }
    
    try {
      const res = await fetch(`http://localhost:8000/api/workflow/${taskId}/abort`, {
        method: 'POST'
      })
      
      if (res.ok) {
        setIsExecuting(false)
        setStatus('aborted')
        alert('任务已中止')
      }
    } catch (err) {
      console.error('中止失败:', err)
      // 即使后端失败，也停止前端执行
      setIsExecuting(false)
      setStatus('aborted')
    }
  }
  
  // ============================================================================
  // 保存草稿
  // ============================================================================
  const handleSaveDraft = () => {
    // 获取当前草稿内容
    const draftContent = stepOutputs[7] || stepOutputs[currentStep] || ''
    if (!draftContent) {
      alert('暂无可保存的内容')
      return
    }
    
    // 创建下载文件
    const blob = new Blob([draftContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `草稿_${new Date().toLocaleDateString()}_${taskId?.slice(0, 8) || 'draft'}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    alert('草稿已保存！')
  }
  
  // ============================================================================
  // 导出文章
  // ============================================================================
  const handleExportArticle = () => {
    // 优先使用终稿，否则使用草稿
    const finalContent = stepOutputs[8] || stepOutputs[7] || ''
    if (!finalContent) {
      alert('暂无可导出的文章内容，请先完成创作流程')
      return
    }
    
    // 创建下载文件
    const blob = new Blob([finalContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `文章_${selectedChannel || 'article'}_${new Date().toLocaleDateString()}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    alert('文章已导出！')
  }
  
  // ============================================================================
  // Supabase 实时订阅
  // ============================================================================
  useEffect(() => {
    if (!taskId) return
    
    console.log('[Workbench] 订阅任务状态:', taskId)
    
    // 订阅任务状态变化
    const unsubscribe = subscribeToTask(taskId, (updatedTask) => {
      console.log('[Workbench] 任务状态更新:', updatedTask)
      
      // 更新本地状态
      setCurrentStep(updatedTask.current_step)
      setStatus(updatedTask.status)
      
      if (updatedTask.think_aloud_logs) {
        setThinkAloudLogs(updatedTask.think_aloud_logs)
      }
      
      // 更新步骤输出
      const outputs: Record<number, string> = {}
      if (updatedTask.brief_data) {
        for (let i = 1; i <= 9; i++) {
          const key = `step_${i}_output`
          if (updatedTask.brief_data[key]) {
            // 使用格式化函数处理输出
            outputs[i] = formatStepOutputForDisplay(updatedTask.brief_data[key], i)
          }
        }
      }
      // 确保初稿和终稿正确显示
      if (updatedTask.draft_content) {
        outputs[7] = updatedTask.draft_content
      }
      if (updatedTask.final_content) {
        outputs[8] = updatedTask.final_content
      }
      setStepOutputs(outputs)
    })
    
    return () => {
      console.log('[Workbench] 取消订阅')
      unsubscribe()
    }
  }, [taskId])
  
  // ============================================================================
  // 获取未完成的任务列表
  // ============================================================================
  const fetchPendingTasks = async () => {
    setLoadingTasks(true)
    try {
      const res = await fetch('http://localhost:8000/api/tasks/')
      if (res.ok) {
        const tasks = await res.json()
        // 筛选未完成的任务
        const pending = tasks.filter((t: any) => 
          t.status !== 'completed' && t.status !== 'aborted'
        )
        setPendingTasks(pending)
      }
    } catch (err) {
      console.error('获取任务列表失败:', err)
    } finally {
      setLoadingTasks(false)
    }
  }
  
  // ============================================================================
  // 恢复任务
  // ============================================================================
  const handleResumeTask = async (task: PendingTask) => {
    setShowResumeModal(false)
    setIsExecuting(true)
    
    try {
      // 获取任务详细信息
      const res = await fetch(`http://localhost:8000/api/workflow/${task.id}`)
      if (!res.ok) throw new Error('获取任务详情失败')
      
      const taskDetail = await res.json()
      console.log('[Workbench] 恢复任务:', taskDetail)
      
      // 恢复状态
      setTaskId(task.id)
      setSelectedChannel(task.channel_slug)
      setWorkflowStarted(true)
      setCurrentStep(taskDetail.current_step)
      setStatus(taskDetail.status)
      
      // 恢复步骤输出
      const outputs: Record<number, string> = {}
      if (taskDetail.brief_data) {
        // 恢复原始需求
        if (taskDetail.brief_data.brief) {
          setBrief(taskDetail.brief_data.brief)
        }
        // 恢复用户选题
        if (taskDetail.brief_data.selected_topic) {
          setSelectedTopic(taskDetail.brief_data.selected_topic)
        }
        // 恢复用户素材
        if (taskDetail.brief_data.user_materials) {
          setUserMaterials(taskDetail.brief_data.user_materials)
        }
        
        // 恢复各步骤输出
        for (let i = 1; i <= 9; i++) {
          const key = `step_${i}_output`
          if (taskDetail.brief_data[key]) {
            const val = taskDetail.brief_data[key]
            outputs[i] = formatStepOutputForDisplay(val, i)
          }
        }
      }
      if (taskDetail.draft_content) {
        outputs[7] = taskDetail.draft_content
      }
      if (taskDetail.final_content) {
        outputs[8] = taskDetail.final_content
      }
      setStepOutputs(outputs)
      
      // 恢复 Think Aloud 日志
      if (taskDetail.think_aloud_logs) {
        setThinkAloudLogs(taskDetail.think_aloud_logs)
      }
      
      // 如果任务在等待确认状态，不需要自动执行
      if (taskDetail.status !== 'waiting_confirm') {
        // 继续执行当前步骤
        setTimeout(() => executeStep(task.id, taskDetail.current_step), 500)
      }
      
    } catch (err: any) {
      console.error('恢复任务失败:', err)
      setError(err.message || '恢复任务失败')
    } finally {
      setIsExecuting(false)
    }
  }
  
  // 格式化步骤输出用于显示
  const formatStepOutputForDisplay = (output: any, stepId: number): string => {
    if (typeof output === 'string') return output
    
    // Step 3: 选题讨论
    if (stepId === 3 && output?.topics) {
      return output.topics
    }
    
    // Step 6: 挂起等待
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
    
    // 其他对象类型
    return typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)
  }

  // ============================================================================
  // 创建工作流
  // ============================================================================
  const handleStartWorkflow = async () => {
    if (!selectedChannel || !brief) {
      alert('请选择频道并输入需求简述')
      return
    }
    
    setIsExecuting(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/api/workflow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel,
          brief: brief
        })
      })
      
      if (!response.ok) {
        throw new Error('创建工作流失败')
      }
      
      const data = await response.json()
      console.log('[Workbench] 创建任务成功:', data)
      
      setTaskId(data.task_id)
      setWorkflowStarted(true)
      setCurrentStep(1)
      setStatus('processing')
      
      // 自动执行 Step 1
      setTimeout(() => executeStep(data.task_id, 1), 500)
    } catch (err: any) {
      console.error('启动工作流失败:', err)
      setError(err.message || '启动工作流失败')
    } finally {
      setIsExecuting(false)
    }
  }
  
  // ============================================================================
  // 执行步骤
  // ============================================================================
  const executeStep = useCallback(async (tid: string, stepId: number, params?: any) => {
    console.log(`[Workbench] 执行 Step ${stepId}`)
    setIsExecuting(true)
    setError('')
    
    // 在步骤开始时就添加 Think Aloud 日志（解决显示滞后问题）
    const stepName = WORKFLOW_STEPS[stepId - 1]?.name || `Step ${stepId}`
    setThinkAloudLogs(prev => [...prev, {
      step: stepId,
      timestamp: new Date().toISOString(),
      content: `🔄 正在执行: ${stepName}...`
    }])
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/workflow/${tid}/execute-step/${stepId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params || {})
        }
      )
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `执行 Step ${stepId} 失败`)
      }
      
      const result = await response.json()
      console.log(`[Workbench] Step ${stepId} 完成:`, result)
      
      // 更新步骤输出
      if (result.result?.output) {
        setStepOutputs(prev => ({ ...prev, [stepId]: result.result.output }))
      }
      // Step 7/8 可能返回 draft_content/final_content
      if (result.draft_content) {
        setStepOutputs(prev => ({ ...prev, 7: result.draft_content }))
      }
      if (result.final_content) {
        setStepOutputs(prev => ({ ...prev, 8: result.final_content }))
      }
      
      // 更新 Think Aloud
      if (result.result?.think_aloud) {
        setThinkAloudLogs(prev => [...prev, {
          step: stepId,
          timestamp: new Date().toISOString(),
          content: result.result.think_aloud
        }])
      }
      
      // 如果是卡点，暂停
      if (result.is_checkpoint) {
        setStatus('waiting_confirm')
        setCurrentStep(stepId)
        return
      }
      
      // 更新当前步骤
      if (result.next_step) {
        setCurrentStep(result.next_step)
        
        // 自动执行下一步（非卡点）
        if (!result.is_checkpoint && result.next_step <= 9) {
          setTimeout(() => executeStep(tid, result.next_step, params), 1000)
        }
      } else if (stepId === 9) {
        setStatus('completed')
      }
      
    } catch (err: any) {
      console.error(`执行 Step ${stepId} 失败:`, err)
      setError(err.message || `执行 Step ${stepId} 失败`)
    } finally {
      setIsExecuting(false)
    }
  }, [])
  
  // ============================================================================
  // 确认卡点继续
  // ============================================================================
  const handleConfirmAndContinue = async () => {
    if (!taskId) return
    
    setIsExecuting(true)
    setError('')
    
    try {
      // Step 3: 选题确认
      if (currentStep === 3) {
        if (!selectedTopic.trim()) {
          alert('请在下方输入框中粘贴你选择的选题内容')
          setIsExecuting(false)
          return
        }
        
        // 调用确认接口
        const confirmRes = await fetch(`http://localhost:8000/api/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_topic: selectedTopic })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 继续执行 Step 4（executeStep 会管理 isExecuting 状态）
        setStatus('processing')
        // 不要在这里 setIsExecuting(false)，让 executeStep 来管理
        executeStep(taskId, 4, { selected_topic: selectedTopic })
        return  // 提前返回，不执行 finally 中的 setIsExecuting(false)
      }
      // Step 6: 素材确认
      else if (currentStep === 6) {
        if (!userMaterials.trim()) {
          alert('请在下方输入框中输入你准备的真实素材')
          setIsExecuting(false)
          return
        }
        
        // 调用确认接口
        const confirmRes = await fetch(`http://localhost:8000/api/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_materials: userMaterials })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 继续执行 Step 7（executeStep 会管理 isExecuting 状态）
        setStatus('processing')
        // 不要在这里 setIsExecuting(false)，让 executeStep 来管理
        executeStep(taskId, 7, { 
          selected_topic: selectedTopic,
          materials: userMaterials 
        })
        return  // 提前返回，不执行 finally 中的 setIsExecuting(false)
      }
    } catch (err: any) {
      setError(err.message || '确认失败')
      setIsExecuting(false)  // 只在出错时重置状态
    }
  }
  
  // ============================================================================
  // 渲染
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <Image 
                src="/logo-1.png" 
                alt="老约翰" 
                width={40} 
                height={40}
                className="w-full h-full object-cover"
              />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">创作工作台</h1>
              <p className="text-sm text-gray-500">Writing Workbench</p>
            </div>
          </div>
          
          {/* 中间：操作按钮和状态 */}
          <div className="flex items-center space-x-4">
            {workflowStarted && (
              <div className="flex items-center space-x-2 text-sm">
                <span className={`px-2 py-1 rounded-full ${
                  status === 'completed' ? 'bg-gray-200 text-gray-700' :
                  status === 'waiting_confirm' ? 'bg-gray-200 text-gray-700' :
                  status === 'processing' ? 'bg-gray-200 text-gray-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {status === 'completed' ? '已完成' :
                   status === 'waiting_confirm' ? '等待确认' :
                   status === 'processing' ? '处理中' : status}
                </span>
                <span className="text-gray-500">Step {currentStep}/9</span>
              </div>
            )}
            <button 
              onClick={handleSaveDraft}
              disabled={!workflowStarted}
              className={`px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg transition-colors ${
                workflowStarted 
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-50' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              保存草稿
            </button>
            <button 
              onClick={handleExportArticle}
              disabled={!stepOutputs[7] && !stepOutputs[8]}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                stepOutputs[7] || stepOutputs[8]
                  ? 'text-white bg-[#3a5e98] hover:bg-[#2d4a78]' 
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
            >
              导出文章
            </button>
            
            {/* 中止任务按钮 */}
            {workflowStarted && status !== 'completed' && status !== 'aborted' && (
              <button 
                onClick={handleAbortTask}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                中止任务
              </button>
            )}
          </div>
          
          {/* 右侧：导航链接 */}
          <nav className="flex items-center space-x-1">
            <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              首页
            </Link>
            <Link href="/channels" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              频道管理
            </Link>
            <Link href="/tasks" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              任务历史
            </Link>
            <Link href="/materials" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              素材管理
            </Link>
            <Link href="/settings" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              品牌资产
            </Link>
          </nav>
        </div>
      </header>
      
      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto p-6">
        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
        
        {!workflowStarted ? (
          /* ================================================================
           * 初始化面板
           * ================================================================ */
          <div className="max-w-3xl mx-auto">
            <div className="card space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">开始新的创作任务</h2>
                <p className="text-gray-600">
                  选择内容频道并描述您的需求，AI将按照9步SOP流程协助您完成创作
                </p>
              </div>
              
              {/* 频道选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择内容频道
                </label>
                <ChannelSelector 
                  selectedChannel={selectedChannel}
                  onSelectChannel={setSelectedChannel}
                />
              </div>
              
              {/* 需求输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  需求简述
                </label>
                <textarea
                  className="input min-h-[120px] resize-none"
                  placeholder="例如：我想写一篇关于《窗边的小豆豆》整本书阅读策略的文章，目标读者是小学生家长，期望3000字左右..."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </div>
              
              {/* 启动按钮 */}
              <button 
                className="w-full py-3 text-base font-medium text-white bg-[#3a5e98] rounded-lg hover:bg-[#2d4a78] transition-colors disabled:opacity-50"
                onClick={handleStartWorkflow}
                disabled={isExecuting}
              >
                {isExecuting ? '正在启动...' : '启动创作流程'}
              </button>
              
              {/* 恢复任务按钮 */}
              <button 
                className="w-full py-3 text-base font-medium text-[#3a5e98] border-2 border-[#3a5e98] bg-white rounded-lg hover:bg-[#3a5e98]/5 transition-colors disabled:opacity-50 mt-3"
                onClick={() => {
                  fetchPendingTasks()
                  setShowResumeModal(true)
                }}
                disabled={isExecuting}
              >
                恢复未完成的任务
              </button>
            </div>
            
            {/* 9步流程预览 */}
            <div className="mt-8 card">
              <h3 className="text-lg font-semibold mb-4">9步完整SOP流程</h3>
              <div className="space-y-3">
                {WORKFLOW_STEPS.map((item) => (
                  <div key={item.step} className="flex items-start space-x-3 text-sm">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      item.checkpoint ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {item.step}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.name}
                        {item.checkpoint && <span className="ml-2 text-xs text-gray-500">● 卡点</span>}
                      </p>
                      <p className="text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================
           * 工作流执行界面
           * ================================================================ */
          <div className="grid grid-cols-12 gap-6">
            {/* 左侧：流程进度 */}
            <div className="col-span-3">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">流程进度</h3>
                <div className="space-y-2">
                  {WORKFLOW_STEPS.map((item) => {
                    // 判断该步骤是否有输出可查看
                    const hasOutput = stepOutputs[item.step]
                    const isViewing = viewingStep === item.step
                    const isClickable = hasOutput || item.step < currentStep
                    
                    return (
                      <div 
                        key={item.step}
                        onClick={() => {
                          if (isClickable) {
                            // 切换查看模式
                            setViewingStep(isViewing ? null : item.step)
                          }
                        }}
                        className={`flex items-center space-x-3 p-2 rounded-lg transition-all ${
                          isViewing
                            ? 'bg-[#3a5e98]/10 border-2 border-[#3a5e98]'
                            : item.step === currentStep && !viewingStep
                              ? 'bg-gray-50 border border-gray-200' 
                              : 'bg-gray-50 hover:bg-gray-100'
                        } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isViewing
                            ? 'bg-[#3a5e98] text-white'
                            : item.step === currentStep
                              ? status === 'waiting_confirm' ? 'bg-gray-600 text-white' : 'bg-gray-600 text-white'
                              : item.step < currentStep
                                ? 'bg-gray-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                        }`}>
                          {item.step < currentStep ? '✓' : item.step}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm block truncate ${
                            isViewing
                              ? 'font-medium text-[#3a5e98]'
                              : item.step === currentStep ? 'font-medium text-gray-900' : 'text-gray-600'
                          }`}>
                            {item.name.split('（')[0]}
                          </span>
                          <div className="flex items-center space-x-2">
                            {item.checkpoint && (
                              <span className="text-xs text-gray-400">卡点</span>
                            )}
                            {hasOutput && (
                              <span className="text-xs text-[#3a5e98]">● 可查看</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* 返回当前步骤按钮 */}
                {viewingStep && (
                  <button
                    onClick={() => setViewingStep(null)}
                    className="mt-4 w-full py-2 text-sm font-medium text-[#3a5e98] bg-[#3a5e98]/10 rounded-lg hover:bg-[#3a5e98]/20 transition-colors"
                  >
                    ← 返回当前步骤
                  </button>
                )}
              </div>
            </div>
            
            {/* 中间：主工作区 */}
            <div className="col-span-6">
              <div className="card">
                {/* 查看历史步骤输出模式 */}
                {viewingStep ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-[#3a5e98]">
                        查看 Step {viewingStep}: {WORKFLOW_STEPS[viewingStep - 1]?.name || '历史输出'}
                      </h2>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">历史记录</span>
                    </div>
                    
                    <div className="space-y-4">
                      {/* 步骤描述 */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          {WORKFLOW_STEPS[viewingStep - 1]?.desc}
                        </p>
                      </div>
                      
                      {/* 历史输出内容 */}
                      {stepOutputs[viewingStep] ? (
                        <div className="prose max-w-none">
                          <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                              {stepOutputs[viewingStep]}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <p>该步骤暂无输出内容</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* 当前步骤工作区 */
                  <>
                    <h2 className="text-xl font-semibold mb-4">
                      Step {currentStep}: {WORKFLOW_STEPS[currentStep - 1]?.name || '工作区'}
                    </h2>
                    
                    <div className="space-y-4">
                      {/* 步骤描述 */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          {WORKFLOW_STEPS[currentStep - 1]?.desc}
                        </p>
                      </div>
                      
                      {/* 步骤输出 */}
                      {stepOutputs[currentStep] && (
                        <div className="prose max-w-none">
                          <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                              {stepOutputs[currentStep]}
                            </pre>
                          </div>
                        </div>
                      )}
                  
                  {/* ======================================================
                   * 卡点交互区域
                   * ====================================================== */}
                  {status === 'waiting_confirm' && (
                    <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 space-y-4">
                      <div className="flex items-center space-x-2 text-gray-800">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-semibold text-lg">需要您的确认</span>
                      </div>
                      
                      {/* Step 3: 选题卡片 */}
                      {currentStep === 3 && (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-700">
                            请仔细阅读上方 AI 生成的选题方案，选择一个最合适的方向，
                            将完整内容粘贴到下方输入框中。
                          </p>
                          <textarea
                            className="w-full p-4 border-2 border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white"
                            rows={8}
                            placeholder="请将你选择的选题完整内容粘贴到这里...

例如：
选题方向1：《窗边的小豆豆》——教育的另一种可能
核心观点：通过小豆豆的成长故事，探讨尊重儿童天性的教育理念..."
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {/* Step 6: 素材确认 */}
                      {currentStep === 6 && (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-700">
                            请提供您准备的真实素材，包括：真实案例、个人观点、数据支持等。
                            <br />
                            <strong>重要：请勿编造虚假信息！</strong>
                          </p>
                          <textarea
                            className="w-full p-4 border-2 border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white"
                            rows={10}
                            placeholder="请在此输入您的真实素材...

例如：
【真实案例】
去年在XX小学做阅读推广时，有个四年级的孩子说...

【个人观点】
我认为整本书阅读最重要的是...

【数据支持】
根据我们的阅读调查数据..."
                            value={userMaterials}
                            onChange={(e) => setUserMaterials(e.target.value)}
                          />
                        </div>
                      )}
                      
                      <button 
                        className="w-full py-3 bg-[#3a5e98] hover:bg-[#2d4a78] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                        onClick={handleConfirmAndContinue}
                        disabled={isExecuting}
                      >
                        {isExecuting ? '处理中...' : '确认并继续'}
                      </button>
                    </div>
                  )}
                  
                  {/* 加载状态 */}
                  {isExecuting && status !== 'waiting_confirm' && (
                    <div className="flex items-center justify-center space-x-3 py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-500 border-t-transparent"></div>
                      <span className="text-gray-600 font-medium">AI 正在处理...</span>
                    </div>
                  )}
                  
                  {/* 完成状态 */}
                  {status === 'completed' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-gray-600 text-5xl mb-4">🎉</div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">创作完成！</h3>
                      <p className="text-gray-700">您的文章已经完成审校，可以导出使用了。</p>
                    </div>
                  )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* 右侧：Think Aloud */}
            <div className="col-span-3">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="mr-2">🧠</span>
                  Think Aloud
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {thinkAloudLogs.length === 0 ? (
                    <p className="text-gray-500 text-sm">AI 思考过程将在这里展示...</p>
                  ) : (
                    thinkAloudLogs.map((log, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-600">Step {log.step}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap text-gray-700 font-sans text-xs">
                          {log.content}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 恢复任务模态框 */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">恢复未完成的任务</h3>
                <button 
                  onClick={() => setShowResumeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingTasks ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-500 border-t-transparent mx-auto mb-3"></div>
                  加载中...
                </div>
              ) : pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>没有未完成的任务</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-[#3a5e98] hover:bg-[#3a5e98]/5 cursor-pointer transition-all"
                      onClick={() => handleResumeTask(task)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {task.title || (task.brief ? (
                              task.brief.replace(/\n/g, ' ').slice(0, 40) + (task.brief.length > 40 ? '...' : '')
                            ) : `任务 ${task.id.slice(0, 8)}...`)}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            频道: {task.channel_slug}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            task.status === 'waiting_confirm' 
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {task.status === 'waiting_confirm' ? '等待确认' : '进行中'}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            Step {task.current_step}/9
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                        <span>创建: {new Date(task.created_at).toLocaleString()}</span>
                        <span>更新: {new Date(task.updated_at).toLocaleString()}</span>
                      </div>
                      {/* 进度条 */}
                      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#3a5e98] rounded-full transition-all"
                          style={{ width: `${(task.current_step / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowResumeModal(false)}
                className="w-full py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
