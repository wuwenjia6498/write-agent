'use client'

import { useState } from 'react'
import WorkflowProgress from '@/components/WorkflowProgress'
import ThinkAloud from '@/components/ThinkAloud'
import ChannelSelector from '@/components/ChannelSelector'

export default function WorkbenchPage() {
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [workflowStarted, setWorkflowStarted] = useState(false)
  const [brief, setBrief] = useState('')
  const [sessionId, setSessionId] = useState<string>('')
  
  const handleStartWorkflow = async () => {
    if (!selectedChannel || !brief) {
      alert('请选择频道并输入需求简述')
      return
    }
    
    try {
      const response = await fetch('/api/server/api/workflow/create', {
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
      
      const session = await response.json()
      setSessionId(session.session_id)
      setWorkflowStarted(true)
      
      // 自动执行Step 1
      executeStep(session.session_id, 1)
    } catch (error) {
      console.error('启动工作流失败:', error)
      alert('启动工作流失败，请检查后端服务是否运行')
    }
  }
  
  const executeStep = async (sid: string, stepId: number) => {
    try {
      const response = await fetch(`/api/server/api/workflow/${sid}/execute-step/${stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`执行Step ${stepId}失败`)
      }
      
      const result = await response.json()
      console.log(`Step ${stepId} 执行完成:`, result)
      
      // 如果不是卡点，继续执行下一步
      if (!result.result.is_checkpoint && stepId < 9) {
        setTimeout(() => executeStep(sid, stepId + 1), 1000)
      }
    } catch (error) {
      console.error(`执行Step ${stepId}失败:`, error)
    }
  }
  
  return (
    <div className="min-h-screen bg-background-secondary">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold">创作工作台</h1>
              <p className="text-sm text-gray-500">Writing Workbench</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="btn-secondary">
              保存草稿
            </button>
            <button className="btn-primary">
              导出文章
            </button>
          </div>
        </div>
      </header>
      
      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto p-6">
        {!workflowStarted ? (
          /* 初始化面板 */
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
                className="btn-primary w-full py-3 text-lg"
                onClick={handleStartWorkflow}
              >
                启动创作流程
              </button>
            </div>
            
            {/* 9步流程预览 */}
            <div className="mt-8 card">
              <h3 className="text-lg font-semibold mb-4">9步完整SOP流程</h3>
              <div className="space-y-3">
                {[
                  { step: 1, name: '理解需求 & 保存Brief', desc: '明确需求，保存文档' },
                  { step: 2, name: '信息搜索与知识管理', desc: '强制调研，确保准确性' },
                  { step: 3, name: '选题讨论（必做）', desc: '避免方向错误，减少返工', checkpoint: true },
                  { step: 4, name: '创建协作文档', desc: '明确AI与用户分工' },
                  { step: 5, name: '风格与素材检索', desc: '学习风格，调用真实素材' },
                  { step: 6, name: '挂起等待', desc: '获取真实数据前不创作', checkpoint: true },
                  { step: 7, name: '初稿创作', desc: '融入个人视角，严禁空洞' },
                  { step: 8, name: '三遍审校机制', desc: '内容审校 → 风格审校 → 细节打磨' },
                  { step: 9, name: '文章配图', desc: '提供配图方案与Markdown代码' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start space-x-3 text-sm">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      item.checkpoint ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {item.step}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.name}
                        {item.checkpoint && <span className="ml-2 text-xs text-orange-500">● 卡点</span>}
                      </p>
                      <p className="text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 工作流执行界面 */
          <div className="grid grid-cols-12 gap-6">
            {/* 左侧：流程进度 */}
            <div className="col-span-3">
              <WorkflowProgress sessionId={sessionId} />
            </div>
            
            {/* 中间：主工作区 */}
            <div className="col-span-6">
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">工作区</h2>
                <p className="text-gray-600">
                  AI正在执行工作流...（实际应用中这里会显示当前步骤的内容）
                </p>
              </div>
            </div>
            
            {/* 右侧：Think Aloud */}
            <div className="col-span-3">
              <ThinkAloud sessionId={sessionId} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

