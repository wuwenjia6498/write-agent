'use client'

import { useEffect, useState } from 'react'

interface WorkflowStep {
  step_id: number
  step_name: string
  status: 'pending' | 'in_progress' | 'waiting' | 'completed' | 'skipped' | 'error'
  is_checkpoint: boolean
  description: string
}

interface Props {
  sessionId: string
}

export default function WorkflowProgress({ sessionId }: Props) {
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!sessionId) return
    
    // 获取工作流状态
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/server/api/workflow/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSteps(data.steps)
          setCurrentStep(data.current_step)
        }
      } catch (error) {
        console.error('获取工作流状态失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchWorkflow()
    
    // 定时轮询更新状态
    const interval = setInterval(fetchWorkflow, 2000)
    return () => clearInterval(interval)
  }, [sessionId])
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'in_progress':
        return 'bg-blue-500 animate-pulse'
      case 'waiting':
        return 'bg-orange-500 animate-pulse'
      case 'error':
        return 'bg-red-500'
      case 'skipped':
        return 'bg-gray-400'
      default:
        return 'bg-gray-200'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      case 'in_progress':
        return (
          <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )
      case 'waiting':
        return (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      default:
        return <span className="text-xs text-gray-500 font-medium">{status === 'pending' ? '' : ''}</span>
    }
  }
  
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    )
  }
  
  return (
    <div className="card sticky top-24">
      <h3 className="text-lg font-semibold mb-4">创作流程</h3>
      
      <div className="space-y-1">
        {steps.map((step, index) => (
          <div key={step.step_id} className="relative">
            {/* 连接线 */}
            {index < steps.length - 1 && (
              <div className={`absolute left-4 top-10 w-0.5 h-10 ${
                step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
            
            {/* 步骤内容 */}
            <div className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
              step.status === 'in_progress' ? 'bg-blue-50' : 
              step.status === 'waiting' ? 'bg-orange-50' :
              'hover:bg-gray-50'
            }`}>
              {/* 状态图标 */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(step.status)}`}>
                {getStatusIcon(step.status)}
              </div>
              
              {/* 步骤信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className={`text-sm font-medium ${
                    step.status === 'in_progress' ? 'text-blue-700' :
                    step.status === 'waiting' ? 'text-orange-700' :
                    step.status === 'completed' ? 'text-gray-700' :
                    'text-gray-500'
                  }`}>
                    {step.step_name}
                  </p>
                  {step.is_checkpoint && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                      卡点
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 进度统计 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">总体进度</span>
          <span className="font-medium text-brand-primary">
            {steps.filter(s => s.status === 'completed').length} / {steps.length}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-brand-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

