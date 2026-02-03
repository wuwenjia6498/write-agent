'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import WorkflowProgress from '@/components/WorkflowProgress'
import ThinkAloud from '@/components/ThinkAloud'
import ChannelSelector from '@/components/ChannelSelector'
import { subscribeToTask } from '@/lib/supabase'
import { API_BASE } from '@/lib/api-config'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

// 步骤定义
const WORKFLOW_STEPS = [
  { step: 1, name: '理解需求', desc: '明确需求，保存文档' },
  { step: 2, name: '信息搜索', desc: '深度调研，审阅确认', checkpoint: true },
  { step: 3, name: '选题讨论', desc: '避免方向错误，减少返工', checkpoint: true },
  { step: 4, name: '协作文档', desc: '明确AI与用户分工' },
  { step: 5, name: '风格建模', desc: '确认风格 DNA，锁定创作基调', checkpoint: true },
  { step: 6, name: '挂起等待', desc: '获取真实数据前不创作', checkpoint: true },
  { step: 7, name: '初稿创作', desc: '融入个人视角，严禁空洞' },
  { step: 8, name: '四遍审校', desc: '内容 → DNA对齐 → 风格 → 细节' },
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
  
  // 风格画像（Step 5 生成）
  const [styleProfile, setStyleProfile] = useState<any>(null)
  
  // 用户编辑的风格配置（Step 5 可编辑）
  const [editedGuidelines, setEditedGuidelines] = useState<string[]>([])
  const [customRequirement, setCustomRequirement] = useState<string>('')
  const [isStyleModified, setIsStyleModified] = useState(false)
  
  // Step 2: 调研数据（可编辑）
  const [knowledgeSummary, setKnowledgeSummary] = useState<string>('')
  const [knowledgeContent, setKnowledgeContent] = useState<string>('')
  const [isKnowledgeModified, setIsKnowledgeModified] = useState(false)
  const [showKnowledgeEditor, setShowKnowledgeEditor] = useState(false)
  
  // Step 2: 调研来源
  const [knowledgeSources, setKnowledgeSources] = useState<Array<{
    title: string
    url: string
    published_date?: string
  }>>([])
  
  // Step 5: 分类素材（长文 vs 灵感碎片）
  const [classifiedMaterials, setClassifiedMaterials] = useState<{
    long: Array<{ id: string; content: string; material_type: string; source?: string; summary?: string; content_length?: number }>
    short: Array<{ id: string; content: string; material_type: string; source?: string; summary?: string; content_length?: number }>
  }>({ long: [], short: [] })
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)  // 展开查看的素材ID
  
  // Step 2: 展开全部来源
  const [showAllSources, setShowAllSources] = useState(false)
  
  // Step 3: 选题展开状态
  const [expandedTopics, setExpandedTopics] = useState<Record<number | string, boolean>>({})
  const [copiedTopicIndex, setCopiedTopicIndex] = useState<number | null>(null)
  
  // v3.5: 样文推荐（Smart Match）
  const [recommendedSample, setRecommendedSample] = useState<any>(null)
  const [allSamples, setAllSamples] = useState<any[]>([])
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [showSampleSelector, setShowSampleSelector] = useState(false)
  
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
      const res = await fetch(`${API_BASE}/workflow/${taskId}/abort`, {
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
  // Markdown 转 Word 文档辅助函数
  // ============================================================================
  const markdownToDocx = (markdown: string): Paragraph[] => {
    const paragraphs: Paragraph[] = []
    const lines = markdown.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 跳过空行但保留段落间距
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }))
        continue
      }
      
      // 处理标题
      if (line.startsWith('# ')) {
        paragraphs.push(new Paragraph({
          text: line.replace(/^# /, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }))
      } else if (line.startsWith('## ')) {
        paragraphs.push(new Paragraph({
          text: line.replace(/^## /, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 }
        }))
      } else if (line.startsWith('### ')) {
        paragraphs.push(new Paragraph({
          text: line.replace(/^### /, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 }
        }))
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // 处理无序列表
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: '• ' + line.replace(/^[-*] /, '') })
          ],
          indent: { left: 720 },
          spacing: { before: 100, after: 100 }
        }))
      } else if (/^\d+\. /.test(line)) {
        // 处理有序列表
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: line })
          ],
          indent: { left: 720 },
          spacing: { before: 100, after: 100 }
        }))
      } else if (line.startsWith('> ')) {
        // 处理引用
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: line.replace(/^> /, ''), italics: true, color: '666666' })
          ],
          indent: { left: 720, right: 720 },
          spacing: { before: 150, after: 150 }
        }))
      } else {
        // 普通段落 - 处理粗体和斜体
        const children: TextRun[] = []
        let remaining = line
        
        // 简单处理：移除 Markdown 格式标记
        remaining = remaining.replace(/\*\*(.+?)\*\*/g, '$1')  // 粗体
        remaining = remaining.replace(/\*(.+?)\*/g, '$1')       // 斜体
        remaining = remaining.replace(/__(.+?)__/g, '$1')       // 粗体
        remaining = remaining.replace(/_(.+?)_/g, '$1')         // 斜体
        
        children.push(new TextRun({ text: remaining }))
        
        paragraphs.push(new Paragraph({
          children,
          spacing: { before: 100, after: 100 },
          alignment: AlignmentType.JUSTIFIED
        }))
      }
    }
    
    return paragraphs
  }
  
  // ============================================================================
  // 保存草稿（Word 格式）
  // ============================================================================
  const handleSaveDraft = async () => {
    // 获取当前草稿内容
    const draftContent = stepOutputs[7] || stepOutputs[currentStep] || ''
    if (!draftContent) {
      alert('暂无可保存的内容')
      return
    }
    
    try {
      // 创建 Word 文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: markdownToDocx(draftContent)
        }]
      })
      
      // 生成并下载
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `草稿_${new Date().toLocaleDateString()}_${taskId?.slice(0, 8) || 'draft'}.docx`)
      
      alert('草稿已保存为 Word 文档！')
    } catch (error) {
      console.error('保存草稿失败:', error)
      alert('保存失败，请重试')
    }
  }
  
  // ============================================================================
  // 导出文章（Word 格式）
  // ============================================================================
  const handleExportArticle = async () => {
    // 优先使用终稿，否则使用草稿
    const finalContent = stepOutputs[8] || stepOutputs[7] || ''
    if (!finalContent) {
      alert('暂无可导出的文章内容，请先完成创作流程')
      return
    }
    
    try {
      // 创建 Word 文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: markdownToDocx(finalContent)
        }]
      })
      
      // 生成并下载
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `文章_${selectedChannel || 'article'}_${new Date().toLocaleDateString()}.docx`)
      
      alert('文章已导出为 Word 文档！')
    } catch (error) {
      console.error('导出文章失败:', error)
      alert('导出失败，请重试')
    }
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
      const res = await fetch(`${API_BASE}/tasks/`)
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
      const res = await fetch(`${API_BASE}/workflow/${task.id}`)
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
      
      // 恢复 Step 2 调研数据（摘要 + 全文 + 来源）
      if (taskDetail.knowledge_summary) {
        setKnowledgeSummary(taskDetail.knowledge_summary)
      }
      if (taskDetail.knowledge_base_data) {
        setKnowledgeContent(taskDetail.knowledge_base_data)
      }
      if (taskDetail.brief_data?.knowledge_sources) {
        setKnowledgeSources(taskDetail.brief_data.knowledge_sources)
      }
      setIsKnowledgeModified(false)
      setShowKnowledgeEditor(false)
      
      // 恢复 Step 5 风格画像
      if (taskDetail.brief_data?.style_profile) {
        setStyleProfile(taskDetail.brief_data.style_profile)
        if (taskDetail.brief_data.style_profile.writing_guidelines) {
          setEditedGuidelines([...taskDetail.brief_data.style_profile.writing_guidelines])
        }
      }
      
      // v3.5: 恢复样文推荐数据
      if (taskDetail.brief_data?.selected_sample) {
        setRecommendedSample(taskDetail.brief_data.selected_sample)
      }
      if (taskDetail.brief_data?.all_samples) {
        setAllSamples(taskDetail.brief_data.all_samples)
      }
      if (taskDetail.brief_data?.selected_sample) {
        setSelectedSampleId(taskDetail.brief_data.selected_sample.id)
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
  
  // 格式化步骤输出用于显示（与任务详情页保持一致）
  const formatStepOutputForDisplay = (output: any, stepId: number): string => {
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
    
    // Step 3: 选题讨论
    if (stepId === 3 && output?.topics) {
      return output.topics
    }
    
    // Step 4: 协作文档
    if (stepId === 4) {
      if (output?.collaboration_doc) return output.collaboration_doc
      if (output?.document) return output.document
    }
    
    // Step 5: 风格建模 - 去 JSON 化
    if (stepId === 5) {
      let formatted = ''
      // 风格指南文字描述
      if (output?.style_guide) {
        formatted += output.style_guide
      }
      // 推荐样文信息
      if (output?.selected_sample) {
        formatted += `\n\n📌 推荐标杆样文: ${output.selected_sample.title}`
        if (output.selected_sample.custom_tags?.length > 0) {
          formatted += `\n   标签: ${output.selected_sample.custom_tags.join(', ')}`
        }
      }
      // 风格画像描述
      if (output?.style_profile) {
        const sp = output.style_profile
        if (sp.opening_style?.description) formatted += `\n\n开头风格: ${sp.opening_style.description}`
        if (sp.tone?.description) formatted += `\n语气特征: ${sp.tone.description}`
        if (sp.ending_style?.description) formatted += `\n结尾风格: ${sp.ending_style.description}`
      }
      return formatted || '风格建模完成'
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
    
    // Step 9: 文章配图
    if (stepId === 9) {
      if (output?.image_suggestions) return output.image_suggestions
      if (output?.suggestions) return output.suggestions
    }
    
    // 其他对象类型，尝试提取常见字段
    if (typeof output === 'object') {
      if (output?.result) return typeof output.result === 'string' ? output.result : JSON.stringify(output.result, null, 2)
      if (output?.output) return typeof output.output === 'string' ? output.output : JSON.stringify(output.output, null, 2)
      if (output?.content) return output.content
      if (output?.text) return output.text
      return JSON.stringify(output, null, 2)
    }
    
    return String(output)
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
      const response = await fetch(`${API_BASE}/workflow/create`, {
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
        `${API_BASE}/workflow/${tid}/execute-step/${stepId}`,
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
      // Step 2 返回调研数据
      if (stepId === 2 && result.result) {
        // 设置调研摘要
        if (result.result.knowledge_summary) {
          setKnowledgeSummary(result.result.knowledge_summary)
        }
        // 设置调研全文（用于编辑）
        if (result.result.output) {
          setKnowledgeContent(result.result.output)
        }
        // 设置真实搜索来源
        if (result.result.knowledge_sources) {
          setKnowledgeSources(result.result.knowledge_sources)
        }
        setIsKnowledgeModified(false)
        setShowKnowledgeEditor(false)
      }
      // Step 5 返回风格画像和分类素材
      if (stepId === 5 && result.result?.style_profile) {
        const profile = result.result.style_profile
        setStyleProfile(profile)
        // 初始化可编辑的创作指南
        if (profile.writing_guidelines) {
          setEditedGuidelines([...profile.writing_guidelines])
        }
        setCustomRequirement('')
        setIsStyleModified(false)
        
        // 设置分类后的素材
        if (result.result?.classified_materials) {
          setClassifiedMaterials(result.result.classified_materials)
        }
        setExpandedMaterial(null)
        
        // v3.5: 保存样文推荐数据
        if (result.result?.selected_sample) {
          setRecommendedSample(result.result.selected_sample)
          setSelectedSampleId(result.result.selected_sample.id)
        }
        if (result.result?.all_samples) {
          setAllSamples(result.result.all_samples)
        }
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
  // v3.5: 选择样文
  // ============================================================================
  const handleSelectSample = async (sampleId: string) => {
    // 先在前端更新选中状态
    setSelectedSampleId(sampleId)
    
    // 从 allSamples 中查找选中的样文
    const selectedSample = allSamples.find(s => s.id === sampleId)
    if (selectedSample) {
      // 更新风格画像为所选样文的特征
      if (selectedSample.style_profile || selectedSample.features) {
        const profile = selectedSample.style_profile || selectedSample.features
        setStyleProfile(profile)
        if (profile.writing_guidelines) {
          setEditedGuidelines([...profile.writing_guidelines])
        }
      }
    }
    
    // 如果有 taskId，同步到后端
    if (taskId) {
      try {
        const res = await fetch(`${API_BASE}/workflow/${taskId}/select-sample`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample_id: sampleId })
        })
        
        if (res.ok) {
          const data = await res.json()
          // 如果后端返回了更完整的数据，使用后端数据
          if (data.selected_sample?.style_profile) {
            setStyleProfile(data.selected_sample.style_profile)
            if (data.selected_sample.style_profile.writing_guidelines) {
              setEditedGuidelines([...data.selected_sample.style_profile.writing_guidelines])
            }
          }
        }
      } catch (err) {
        console.error('同步样文选择到后端失败:', err)
        // 前端已经更新，不影响用户体验
      }
    }
  }
  
  // ============================================================================
  // 确认卡点继续
  // ============================================================================
  const handleConfirmAndContinue = async () => {
    if (!taskId) return
    
    setIsExecuting(true)
    setError('')
    
    try {
      // Step 2: 调研确认
      if (currentStep === 2) {
        // 调用确认接口
        const confirmRes = await fetch(`${API_BASE}/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            knowledge_confirmed: true,
            edited_knowledge: isKnowledgeModified ? knowledgeContent : null
          })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 继续执行 Step 3
        setStatus('processing')
        executeStep(taskId, 3)
        return
      }
      // Step 3: 选题确认
      else if (currentStep === 3) {
        if (!selectedTopic.trim()) {
          alert('请在下方输入框中粘贴你选择的选题内容')
          setIsExecuting(false)
          return
        }
        
        // 调用确认接口
        const confirmRes = await fetch(`${API_BASE}/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_topic: selectedTopic })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 继续执行 Step 4
        setStatus('processing')
        executeStep(taskId, 4, { selected_topic: selectedTopic })
        return
      }
      // Step 5: 风格确认（可编辑任务简报）
      else if (currentStep === 5) {
        // 构建自定义风格配置
        const customStyleProfile = isStyleModified ? {
          ...styleProfile,
          writing_guidelines: editedGuidelines.filter(g => g.trim() !== ''),
          custom_requirement: customRequirement.trim() || null,
          is_customized: true
        } : null
        
        // v3.5: 获取选定的样文数据
        const selectedSample = selectedSampleId 
          ? allSamples.find(s => s.id === selectedSampleId) || recommendedSample
          : null
        
        // 调用确认接口，传递自定义配置和选定样文
        const confirmRes = await fetch(`${API_BASE}/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            style_confirmed: true,
            user_style_profile: customStyleProfile,
            selected_sample: selectedSample  // v3.5: 传递选定的标杆样文
          })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 更新本地 styleProfile 以反映自定义内容
        if (customStyleProfile) {
          setStyleProfile(customStyleProfile)
        }
        
        // 继续执行 Step 6
        setStatus('processing')
        executeStep(taskId, 6, { selected_topic: selectedTopic })
        return
      }
      // Step 6: 素材确认
      else if (currentStep === 6) {
        if (!userMaterials.trim()) {
          alert('请在下方输入框中输入你准备的真实素材')
          setIsExecuting(false)
          return
        }
        
        // 调用确认接口
        const confirmRes = await fetch(`${API_BASE}/workflow/${taskId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_materials: userMaterials })
        })
        
        if (!confirmRes.ok) {
          throw new Error('确认失败')
        }
        
        // 继续执行 Step 7
        setStatus('processing')
        executeStep(taskId, 7, { 
          selected_topic: selectedTopic,
          materials: userMaterials 
        })
        return
      }
    } catch (err: any) {
      setError(err.message || '确认失败')
      setIsExecuting(false)
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
                      
                      {/* 历史输出内容 - 根据步骤类型选择渲染方式 */}
                      {stepOutputs[viewingStep] ? (
                        viewingStep === 2 && knowledgeSummary ? (
                          /* Step 2: 调研摘要 + 来源链接（与当前步骤一致） */
                          <div className="prose max-w-none">
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="font-semibold text-emerald-700">调研摘要</span>
                              </div>
                              <div className="text-sm text-gray-700 leading-relaxed space-y-2">
                                {knowledgeSummary
                                  .replace(/<[^>]*>/g, '')
                                  .replace(/^#+\s*/gm, '')
                                  .replace(/\*\*/g, '')
                                  .replace(/__/g, '')
                                  .split('\n')
                                  .filter(line => line.trim())
                                  .map((line, i) => {
                                    const trimmedLine = line.trim()
                                    const isTitle = /^(核心发现|创作建议|关键要点)[：:]?/.test(trimmedLine)
                                    const isNumbered = /^\d+[.、]/.test(trimmedLine)
                                    
                                    if (isTitle) {
                                      return <p key={i} className="font-semibold text-emerald-800 mt-2 first:mt-0">{trimmedLine}</p>
                                    } else if (isNumbered) {
                                      return <p key={i} className="pl-3 border-l-2 border-emerald-300 text-gray-700">{trimmedLine}</p>
                                    } else {
                                      return <p key={i} className="text-gray-600">{trimmedLine}</p>
                                    }
                                  })}
                              </div>
                              {/* 调研来源 */}
                              {knowledgeSources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-emerald-200/50">
                                  <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    参考来源（{knowledgeSources.length} 条真实搜索结果）
                                  </p>
                                  <ul className="space-y-1.5">
                                    {knowledgeSources.slice(0, 5).map((source, idx) => (
                                      <li key={idx} className="text-xs">
                                        <a 
                                          href={source.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1"
                                        >
                                          <span className="text-gray-400 shrink-0">{idx + 1}.</span>
                                          <span className="line-clamp-1">{source.title || source.url}</span>
                                          <svg className="w-3 h-3 shrink-0 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            
                            {/* 调研全文（可折叠） */}
                            {knowledgeContent && (
                              <div className="border border-gray-200 rounded-lg overflow-hidden mt-4">
                                <div 
                                  className="flex items-center justify-between bg-gray-50 px-4 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors"
                                  onClick={() => setShowKnowledgeEditor(!showKnowledgeEditor)}
                                >
                                  <div className="flex items-center gap-2">
                                    <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showKnowledgeEditor ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">📄 调研全文</span>
                                    <span className="text-xs text-gray-400">（{knowledgeContent.length} 字）</span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {showKnowledgeEditor ? '收起' : '展开查看'}
                                  </span>
                                </div>
                                {showKnowledgeEditor && (
                                  <div className="p-4 bg-white border-t border-gray-100 max-h-[400px] overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                                      {knowledgeContent}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : viewingStep === 3 ? (
                          /* Step 3: 选题卡片分离（与当前步骤一致） */
                          <div className="space-y-3">
                            {(() => {
                              const content = stepOutputs[3] || ''
                              const topicBlocks: { title: string; content: string }[] = []
                              
                              let blocks = content.split(/\n-{3,}\n/).filter((b: string) => b.trim())
                              if (blocks.length <= 1) {
                                blocks = content.split(/(?=##\s*选题[一二三四五六七八九十\d]*[：:])/).filter((b: string) => b.trim())
                              }
                              if (blocks.length <= 1) {
                                blocks = content.split(/(?=###?\s*选题方向\s*\d+|###?\s*方向\s*\d+|选题\s*\d+[：:])/).filter((b: string) => b.trim())
                              }
                              
                              // 移除特殊符号的函数（包括emoji）
                              const cleanTitle = (t: string) => t.replace(/[✦✧★☆⭐◆◇●○♦♢🔹🔸🔄📌💡✨🎯📚📖🌟]/g, '').trim()
                              
                              // 判断是否应该跳过的内容块（如"选题方向建议"）
                              const shouldSkipBlock = (title: string) => 
                                title.includes('选题方向建议') || title.includes('方向建议')
                              
                              if (blocks.length > 1) {
                                blocks.forEach((block: string, idx: number) => {
                                  const lines = block.trim().split('\n')
                                  let titleLine = lines.find((l: string) => /^##\s/.test(l)) || lines[0]
                                  let title = titleLine?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim() || `选题 ${idx + 1}`
                                  title = cleanTitle(title) // 移除特殊符号
                                  if (title.length > 50) title = title.slice(0, 50) + '...'
                                  // 过滤掉"选题方向建议"类型的块
                                  if (!shouldSkipBlock(title)) {
                                    topicBlocks.push({ title, content: block.trim() })
                                  }
                                })
                              } else {
                                topicBlocks.push({ title: '选题方案', content })
                              }
                              
                              // 判断是否为"综合建议/推荐"类型（不需要折叠，不需要复制按钮，直接显示）
                              const isRecommendation = (title: string) => 
                                title.includes('综合推荐') || title.includes('综合建议') || 
                                title.includes('推荐') || title.includes('建议') || 
                                title.includes('总结') || title === '选题方案'
                              
                              // 判断是否需要折叠（只有一个选题方案时不折叠）
                              const needsCollapse = (title: string) => 
                                topicBlocks.length > 1 && !isRecommendation(title)
                              
                              return topicBlocks.map((topic, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-[#3a5e98]/50 transition-colors">
                                  <div 
                                    className={`flex items-center justify-between px-4 py-2.5 bg-gray-50 ${
                                      needsCollapse(topic.title) ? 'cursor-pointer hover:bg-gray-100' : ''
                                    } transition-colors`}
                                    onClick={() => needsCollapse(topic.title) && setExpandedTopics(prev => ({ ...prev, [`view_${idx}`]: !prev[`view_${idx}`] }))}
                                  >
                                    <span className="text-sm font-medium text-gray-800">{topic.title}</span>
                                    <div className="flex items-center gap-2">
                                      {/* 复制按钮 - 综合建议/推荐类型不显示 */}
                                      {!isRecommendation(topic.title) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            navigator.clipboard.writeText(topic.content)
                                          }}
                                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#3a5e98] hover:bg-[#3a5e98]/10 transition-colors"
                                          title="复制"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        </button>
                                      )}
                                      {/* 展开/收起图标 - 需要折叠时才显示 */}
                                      {needsCollapse(topic.title) && (
                                        <svg 
                                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedTopics[`view_${idx}`] ? 'rotate-180' : ''}`} 
                                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                  {/* 选题内容 - 需要折叠时才折叠，否则始终展开 */}
                                  {(expandedTopics[`view_${idx}`] || !needsCollapse(topic.title)) && (
                                    <div className="px-4 py-3 border-t border-gray-100">
                                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                                        {topic.content
                                          .replace(/[✦✧★☆⭐◆◇●○♦♢🔹🔸🔄📌💡✨🎯📚📖🌟]/g, '')
                                          .replace(/^#\s*选题方案\s*\n+/m, '')}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ))
                            })()}
                          </div>
                        ) : viewingStep === 5 ? (
                          /* Step 5: 风格建模 - 完整展示 */
                          <div className="space-y-4">
                            {(() => {
                              // 使用页面状态中的数据
                              const sample = selectedSampleId 
                                ? allSamples.find(s => s.id === selectedSampleId) || recommendedSample
                                : recommendedSample
                              const profile = styleProfile || sample?.style_profile || sample?.features
                              const materials = classifiedMaterials
                              const guidelines = profile?.writing_guidelines || editedGuidelines || []
                              
                              return (
                                <>
                                  {/* 标杆样文 */}
                                  {sample && (
                                    <div className="bg-gradient-to-r from-[#3a5e98]/5 to-[#2a4a7a]/5 border border-[#3a5e98]/20 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <span>⭐</span> 标杆样文
                                      </h4>
                                      <p className="text-[#3a5e98] font-medium">📌 《{sample.title}》</p>
                                      {sample.custom_tags?.length > 0 && (
                                        <p className="text-sm text-gray-600 mt-1">🏷️ 标签：{sample.custom_tags.join('、')}</p>
                                      )}
                                      {/* 六维特征 */}
                                      {(sample.style_profile || sample.features) && (
                                        <div className="mt-3 pt-2 border-t border-[#3a5e98]/10 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                          {(() => {
                                            const sp = sample.style_profile || sample.features
                                            const getDesc = (val: any) => val?.description || val?.type || '—'
                                            return (
                                              <>
                                                {sp.opening_style && <p>• 开头：{getDesc(sp.opening_style)}</p>}
                                                {sp.tone && <p>• 语气：{getDesc(sp.tone)}</p>}
                                                {sp.ending_style && <p>• 结尾：{getDesc(sp.ending_style)}</p>}
                                              </>
                                            )
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 风格画像 */}
                                  {profile && (profile.style_portrait || profile.structural_logic?.length > 0) && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <span>🎨</span> 风格画像
                                      </h4>
                                      {profile.style_portrait && <p className="text-sm text-gray-700">「{profile.style_portrait}」</p>}
                                      {profile.structural_logic?.length > 0 && (
                                        <p className="text-sm text-gray-600 mt-2">📋 结构逻辑：{profile.structural_logic.slice(0, 5).join(' → ')}</p>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 创作指南 */}
                                  {guidelines?.length > 0 && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <span>✏️</span> 创作指南
                                      </h4>
                                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                                        {guidelines.map((g: string, i: number) => <li key={i}>{g}</li>)}
                                      </ol>
                                    </div>
                                  )}
                                  
                                  {/* 检索素材 */}
                                  {materials && (materials.long?.length > 0 || materials.short?.length > 0) && (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                      <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <span>📦</span> 检索素材（{(materials.long?.length || 0) + (materials.short?.length || 0)} 条）
                                      </h4>
                                      {materials.long?.length > 0 && (
                                        <div className="mb-3">
                                          <p className="text-xs text-gray-500 mb-2">【长文素材】</p>
                                          {materials.long.map((mat: any, idx: number) => {
                                            const matId = mat.id || `view-long-${idx}`
                                            const isExpanded = expandedMaterial === matId
                                            const wordCount = mat.content_length || mat.content?.length || 0
                                            const hasAiSummary = mat.ai_summary || mat.is_summarized
                                            
                                            return (
                                              <div key={matId} className="bg-white rounded-lg p-3 mb-2">
                                                {/* 头部：类型 + 展开按钮 */}
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">[{mat.material_type}]</span>
                                                    {hasAiSummary && (
                                                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                        ✨ 已分析
                                                      </span>
                                                    )}
                                                  </div>
                                                  <button
                                                    onClick={() => setExpandedMaterial(isExpanded ? null : matId)}
                                                    className="text-xs text-[#3a5e98] hover:underline"
                                                  >
                                                    {isExpanded ? '收起原文' : '查看原文'}
                                                  </button>
                                                </div>
                                                
                                                {/* 文件名/来源 + 字数 */}
                                                <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-gray-500">📄</span>
                                                  <span className="text-sm font-medium text-gray-700">
                                                    {mat.source || mat.title || `${mat.material_type} ${idx + 1}`}
                                                  </span>
                                                  <span className="text-xs text-gray-400">
                                                    ({wordCount} 字)
                                                  </span>
                                                </div>
                                                
                                                {/* AI 摘要（默认显示） */}
                                                {mat.ai_summary && (
                                                  <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                      <span className="text-xs font-medium text-blue-700">🤖 AI 摘要</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                      {mat.ai_summary}
                                                    </p>
                                                  </div>
                                                )}
                                                
                                                {/* 关键要点 */}
                                                {mat.key_points && mat.key_points.length > 0 && (
                                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                                    <span className="text-xs text-gray-500">关键要点：</span>
                                                    {mat.key_points.map((point: string, pIdx: number) => (
                                                      <span 
                                                        key={pIdx} 
                                                        className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200"
                                                      >
                                                        {point}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                                
                                                {/* 展开后显示完整原文 */}
                                                {isExpanded && (
                                                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                                    <p className="text-xs text-gray-500 mb-2">📜 原文内容：</p>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{mat.content}</p>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                      {materials.short?.length > 0 && (
                                        <div>
                                          <p className="text-xs text-gray-500 mb-2">【灵感碎片】</p>
                                          {materials.short.map((mat: any, idx: number) => (
                                            <div key={mat.id || `view-short-${idx}`} className="bg-white rounded p-2 mb-1 text-sm">
                                              <span className="text-xs text-gray-400">[{mat.material_type}] </span>
                                              <span className="text-gray-700">{mat.content}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* 无内容时显示原始输出 */}
                                  {!sample && !profile && !materials && stepOutputs[5] && (
                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                                        {stepOutputs[5]}
                                      </pre>
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          /* 其他步骤：默认渲染 */
                          <div className="prose max-w-none">
                            <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                                {stepOutputs[viewingStep]}
                              </pre>
                            </div>
                          </div>
                        )
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
                    
                    {/* 步骤输出 - Step 2 特殊处理：显示摘要而非全文 */}
                    {currentStep === 2 && knowledgeSummary ? (
                      <div className="prose max-w-none">
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold text-emerald-700">调研摘要</span>
                            <span className="text-xs text-emerald-500">（完整调研报告 {knowledgeContent.length} 字，详见下方编辑区）</span>
                          </div>
                          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
                            {knowledgeSummary
                              .replace(/<[^>]*>/g, '')
                              .replace(/^#+\s*/gm, '')
                              .replace(/\*\*/g, '')
                              .replace(/__/g, '')
                              .split('\n')
                              .filter(line => line.trim())
                              .map((line, i) => {
                                const trimmedLine = line.trim()
                                const isTitle = /^(核心发现|创作建议|关键要点)[：:]?/.test(trimmedLine)
                                const isNumbered = /^\d+[.、]/.test(trimmedLine)
                                
                                if (isTitle) {
                                  return <p key={i} className="font-semibold text-emerald-800 mt-2 first:mt-0">{trimmedLine}</p>
                                } else if (isNumbered) {
                                  return <p key={i} className="pl-3 border-l-2 border-emerald-300 text-gray-700">{trimmedLine}</p>
                                } else {
                                  return <p key={i} className="text-gray-600">{trimmedLine}</p>
                                }
                              })}
                          </div>
                          {/* 调研来源 */}
                          <div className="mt-4 pt-3 border-t border-emerald-200/50">
                            {knowledgeSources.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  参考来源（{knowledgeSources.length} 条真实搜索结果）
                                </p>
                                <ul className="space-y-1.5">
                                  {(showAllSources ? knowledgeSources : knowledgeSources.slice(0, 5)).map((source, idx) => (
                                    <li key={idx} className="text-xs">
                                      <a 
                                        href={source.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1"
                                      >
                                        <span className="text-gray-400 shrink-0">{idx + 1}.</span>
                                        <span className="line-clamp-1">{source.title || source.url}</span>
                                        <svg className="w-3 h-3 shrink-0 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                                {knowledgeSources.length > 5 && (
                                  <button 
                                    onClick={() => setShowAllSources(!showAllSources)}
                                    className="text-xs text-[#3a5e98] hover:text-[#2d4a78] mt-1 flex items-center gap-1 hover:underline"
                                  >
                                    {showAllSources ? (
                                      <>收起来源 ↑</>
                                    ) : (
                                      <>查看全部 {knowledgeSources.length} 条来源 ↓</>
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-emerald-600/70 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                调研内容由 AI 基于训练数据生成。如需真实来源，请配置 TAVILY_API_KEY。
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : stepOutputs[currentStep] && currentStep === 3 ? (
                      /* Step 3: 选题方案独立展示 */
                      <div className="space-y-3">
                        {(() => {
                          // 解析选题内容，按选题标题分割
                          const content = stepOutputs[3] || ''
                          const topicBlocks: { title: string; content: string }[] = []
                          
                          // 按 "---" 分隔线或 "## 选题" 格式分割
                          // 先尝试用 --- 分割
                          let blocks = content.split(/\n-{3,}\n/).filter((b: string) => b.trim())
                          
                          // 如果 --- 分割不成功，尝试按 ## 选题 分割
                          if (blocks.length <= 1) {
                            // 匹配 ## 选题一、## 选题二 或 ## 选题方向1 等格式
                            blocks = content.split(/(?=##\s*选题[一二三四五六七八九十\d]*[：:])/).filter((b: string) => b.trim())
                          }
                          
                          // 如果还是不行，尝试其他格式
                          if (blocks.length <= 1) {
                            blocks = content.split(/(?=###?\s*选题方向\s*\d+|###?\s*方向\s*\d+|选题\s*\d+[：:])/).filter((b: string) => b.trim())
                          }
                          
                          // 移除特殊符号的函数（包括emoji）
                          const cleanTitle = (t: string) => t.replace(/[✦✧★☆⭐◆◇●○♦♢🔹🔸🔄📌💡✨🎯📚📖🌟]/g, '').trim()
                          
                          // 判断是否应该跳过的内容块（如"选题方向建议"）
                          const shouldSkipBlock = (title: string) => 
                            title.includes('选题方向建议') || title.includes('方向建议')
                          
                          // 解析每个选题块
                          if (blocks.length > 1) {
                            blocks.forEach((block: string, idx: number) => {
                              const lines = block.trim().split('\n')
                              // 提取标题：查找以 ## 开头的行
                              let titleLine = lines.find((l: string) => /^##\s/.test(l)) || lines[0]
                              let title = titleLine?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim() || `选题 ${idx + 1}`
                              title = cleanTitle(title) // 移除特殊符号
                              if (title.length > 50) title = title.slice(0, 50) + '...'
                              // 过滤掉"选题方向建议"类型的块
                              if (!shouldSkipBlock(title)) {
                                topicBlocks.push({ title, content: block.trim() })
                              }
                            })
                          } else {
                            // 回退：整体显示
                            topicBlocks.push({ title: '选题方案', content })
                          }
                          
                              // 判断是否为"综合建议/推荐"类型（不需要折叠，不需要复制按钮，直接显示）
                              const isRecommendation = (title: string) => 
                                title.includes('综合推荐') || title.includes('综合建议') || 
                                title.includes('推荐') || title.includes('建议') || 
                                title.includes('总结') || title === '选题方案'
                              
                              // 判断是否需要折叠（只有一个选题方案时不折叠）
                              const needsCollapse = (title: string) => 
                                topicBlocks.length > 1 && !isRecommendation(title)
                          
                          return topicBlocks.map((topic, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-[#3a5e98]/50 transition-colors">
                              {/* 选题标题栏 */}
                              <div 
                                className={`flex items-center justify-between px-4 py-2.5 bg-gray-50 ${
                                  needsCollapse(topic.title) ? 'cursor-pointer hover:bg-gray-100' : ''
                                } transition-colors`}
                                onClick={() => needsCollapse(topic.title) && setExpandedTopics(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              >
                                <span className="text-sm font-medium text-gray-800">{topic.title}</span>
                                <div className="flex items-center gap-2">
                                  {/* 复制按钮 - 推荐类型不显示 */}
                                  {!isRecommendation(topic.title) && (
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
                                  )}
                                  {/* 展开/收起图标 - 需要折叠时才显示 */}
                                  {needsCollapse(topic.title) && (
                                    <svg 
                                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedTopics[idx] ? 'rotate-180' : ''}`} 
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              
                              {/* 选题内容 - 需要折叠时才折叠，否则始终展开 */}
                              {(expandedTopics[idx] || !needsCollapse(topic.title)) && (
                                <div className="px-4 py-3 border-t border-gray-100">
                                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                                    {topic.content
                                      .replace(/[✦✧★☆⭐◆◇●○♦♢🔹🔸🔄📌💡✨🎯📚📖🌟]/g, '')
                                      .replace(/^#\s*选题方案\s*\n+/m, '')}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))
                        })()}
                      </div>
                    ) : stepOutputs[currentStep] && currentStep !== 2 ? (
                      <div className="prose max-w-none">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                            {stepOutputs[currentStep]}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                    
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
                        
                      {/* Step 2: 调研确认（摘要已在上方显示，此处仅显示全文编辑器） */}
                      {currentStep === 2 && (
                        <div className="space-y-3">
                          {/* 操作提示 + 重新生成摘要按钮 */}
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                              请审阅上方摘要，如需修改调研内容，可展开下方全文编辑器。
                            </p>
                            {isKnowledgeModified && (
                              <button
                                onClick={async () => {
                                  try {
                                    setIsExecuting(true)
                                    const res = await fetch(`${API_BASE}/workflow/${taskId}/regenerate-summary`, {
                                      method: 'POST'
                                    })
                                    if (res.ok) {
                                      const data = await res.json()
                                      setKnowledgeSummary(data.knowledge_summary)
                                    }
                                  } catch (e) {
                                    console.error('重新生成摘要失败:', e)
                                  } finally {
                                    setIsExecuting(false)
                                  }
                                }}
                                disabled={isExecuting}
                                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {isExecuting ? '生成中...' : '🔄 根据修改重新生成摘要'}
                              </button>
                            )}
                          </div>
                          
                          {/* 调研全文编辑器（默认折叠） */}
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div 
                              className="flex items-center justify-between bg-gray-50 px-4 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => setShowKnowledgeEditor(!showKnowledgeEditor)}
                            >
                              <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showKnowledgeEditor ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">📄 调研全文</span>
                                <span className="text-xs text-gray-400">（{knowledgeContent.length} 字）</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isKnowledgeModified && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                    已编辑
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {showKnowledgeEditor ? '收起' : '展开编辑'}
                                </span>
                              </div>
                            </div>
                            
                            {showKnowledgeEditor && (
                              <div className="p-3 bg-white border-t border-gray-100">
                                <textarea
                                  className="w-full p-3 border border-gray-200 rounded-lg resize-y focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white font-mono text-sm leading-relaxed"
                                  rows={22}
                                  style={{ minHeight: '400px', maxHeight: '600px' }}
                                  value={knowledgeContent}
                                  onChange={(e) => {
                                    setKnowledgeContent(e.target.value)
                                    setIsKnowledgeModified(true)
                                  }}
                                  placeholder="调研内容..."
                                />
                                <div className="flex items-center justify-between mt-2">
                                  <p className="text-xs text-gray-400">
                                    💡 可补充真实数据、修正错误、删除无关内容
                                  </p>
                                  {isKnowledgeModified && (
                                    <p className="text-xs text-orange-600">
                                      ⚠️ 修改后建议点击上方"重新生成摘要"
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* C. 确认提示 */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-700">
                              <strong>确认后</strong>，AI 将基于上述调研内容进入选题讨论阶段。请确保关键信息准确无误。
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Step 3: 选题卡片 */}
                      {currentStep === 3 && (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-700">
                            请仔细阅读上方 AI 生成的选题方案，选择一个最合适的方向，
                            将完整内容粘贴到下方输入框中。
                          </p>
                            <textarea
                            className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white text-xs leading-relaxed"
                            rows={14}
                            placeholder="请将你选择的选题完整内容粘贴到这里...

例如：
选题方向1：《窗边的小豆豆》——教育的另一种可能
核心观点：通过小豆豆的成长故事，探讨尊重儿童天性的教育理念..."
                              value={selectedTopic}
                              onChange={(e) => setSelectedTopic(e.target.value)}
                            />
                          </div>
                        )}
                      
                      {/* Step 5: 风格确认（可编辑任务简报） */}
                      {currentStep === 5 && (
                        <div className="space-y-4">
                          {/* v3.5: 样文智能推荐卡片 */}
                          {(recommendedSample || allSamples.length > 0) && (
                            <div className="bg-gradient-to-r from-[#3a5e98]/5 to-[#2a4a7a]/5 border border-[#3a5e98]/20 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-[#3a5e98]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span className="font-medium text-[#3a5e98]">Smart Match · 标杆样文</span>
                                </div>
                                {allSamples.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowSampleSelector(!showSampleSelector)}
                                    className="text-xs text-[#3a5e98] hover:text-[#2a4a7a] underline"
                                  >
                                    {showSampleSelector ? '收起' : `查看全部 ${allSamples.length} 篇`}
                                  </button>
                                )}
                              </div>
                              
                              {/* 推荐的样文卡片 */}
                              {recommendedSample && !showSampleSelector && (
                                <div className={`bg-white rounded-lg p-4 border-2 ${selectedSampleId === recommendedSample.id ? 'border-[#3a5e98]' : 'border-transparent'}`}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs bg-[#3a5e98] text-white px-2 py-0.5 rounded">AI推荐</span>
                                        <h4 className="font-medium text-gray-900">{recommendedSample.title}</h4>
                                      </div>
                                      
                                      {/* 自定义标签 */}
                                      {recommendedSample.custom_tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {recommendedSample.custom_tags.map((tag: string, i: number) => (
                                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* 6维特征摘要 */}
                                      {recommendedSample.style_profile && (() => {
                                        // 英文值到中文的翻译映射
                                        const styleLabels: Record<string, string> = {
                                          // 开头风格
                                          'direct': '直接引入', 'story': '故事引入', 'question': '问题引入', 'scene': '场景引入',
                                          // 语气
                                          'warm_friend': '温暖友好', 'professional': '专业严谨', 'casual': '轻松随意', 'emotional': '情感共鸣',
                                          // 结尾风格
                                          'thought': '引导思考', 'action': '行动号召', 'summary': '总结升华', 'open': '开放式',
                                          // 节奏
                                          'medium': '中等节奏', 'fast': '快节奏', 'slow': '慢节奏', 'varied': '变化丰富'
                                        }
                                        const translate = (val: any) => {
                                          if (typeof val === 'object') return val?.type || val?.description?.slice(0, 8) || '—'
                                          return styleLabels[val] || val || '—'
                                        }
                                        return (
                                          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">开头：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.opening_style)}</span>
                                            </div>
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">句式：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.sentence_pattern)}</span>
                                            </div>
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">节奏：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.paragraph_rhythm)}</span>
                                            </div>
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">表达：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.expressions)}</span>
                                            </div>
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">语气：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.tone)}</span>
                                            </div>
                                            <div className="bg-gray-50 px-2 py-1 rounded">
                                              <span className="text-gray-500">结尾：</span>
                                              <span className="text-gray-700">{translate(recommendedSample.style_profile.ending_style)}</span>
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                    
                                    {selectedSampleId === recommendedSample.id && (
                                      <span className="text-[#3a5e98]">
                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* 全部样文列表 */}
                              {showSampleSelector && (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {allSamples.map((sample) => (
                                    <button
                                      key={sample.id}
                                      type="button"
                                      onClick={() => handleSelectSample(sample.id)}
                                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                        selectedSampleId === sample.id 
                                          ? 'border-[#3a5e98] bg-[#3a5e98]/5' 
                                          : 'border-gray-200 hover:border-[#3a5e98]/50 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            {recommendedSample?.id === sample.id && (
                                              <span className="text-xs bg-[#3a5e98] text-white px-1.5 py-0.5 rounded">推荐</span>
                                            )}
                                            <span className="font-medium text-gray-900 text-sm">{sample.title}</span>
                                          </div>
                                          {sample.custom_tags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {sample.custom_tags.slice(0, 4).map((tag: string, i: number) => (
                                                <span key={i} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                                  {tag}
                                                </span>
                                              ))}
                                              {sample.custom_tags.length > 4 && (
                                                <span className="text-xs text-gray-400">+{sample.custom_tags.length - 4}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {selectedSampleId === sample.id && (
                                          <span className="text-[#3a5e98]">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              {/* 无样文提示 */}
                              {!recommendedSample && allSamples.length === 0 && (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                  当前频道暂无样文，AI 将使用频道基础人设进行创作
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-700">
                              {selectedSampleId ? '已选定标杆样文，您可以微调以下创作指南：' : 'AI 已完成风格建模，您可以微调以下创作指南：'}
                            </p>
                            {isStyleModified && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                已修改
                              </span>
                            )}
                          </div>
                          
                          {/* 风格画像精简展示 */}
                          {styleProfile && (
                            <div className="bg-white border border-[#3a5e98]/30 rounded-lg p-4 space-y-4">
                              {/* 风格画像（只读） */}
                              {styleProfile.style_portrait && (
                                <div className="bg-[#3a5e98]/5 rounded-lg p-3">
                                  <p className="text-sm font-medium text-[#3a5e98] mb-1">风格画像</p>
                                  <p className="text-sm text-gray-700">"{styleProfile.style_portrait}"</p>
                                </div>
                              )}
                              
                              {/* 结构逻辑（只读） */}
                              {styleProfile.structural_logic && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-2">结构逻辑（必须按此顺序）</p>
                                  <div className="flex flex-wrap items-center gap-1 text-xs">
                                    {styleProfile.structural_logic.slice(0, 5).map((item: string, index: number) => (
                                      <span key={index} className="flex items-center">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                                          {index + 1}. {item.length > 8 ? item.slice(0, 8) + '...' : item}
                                        </span>
                                        {index < Math.min(styleProfile.structural_logic.length, 5) - 1 && (
                                          <span className="text-gray-400 mx-1">→</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 可编辑的创作指南 */}
                              <div className="border-t border-gray-200 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-gray-500">创作指南（可编辑）</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditedGuidelines([...editedGuidelines, ''])
                                      setIsStyleModified(true)
                                    }}
                                    className="text-xs text-[#3a5e98] hover:underline"
                                  >
                                    + 添加规则
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {/* 获取创作指南：优先 editedGuidelines，否则从多个来源获取或动态生成 */}
                                  {(() => {
                                    // 获取选中的样文
                                    const selectedSample = selectedSampleId 
                                      ? allSamples.find(s => s.id === selectedSampleId) || recommendedSample
                                      : recommendedSample
                                    
                                    // 从多个来源获取 writing_guidelines
                                    let guidelines = editedGuidelines.length > 0 
                                      ? editedGuidelines 
                                      : (styleProfile?.writing_guidelines || 
                                         selectedSample?.style_profile?.writing_guidelines ||
                                         selectedSample?.features?.writing_guidelines ||
                                         recommendedSample?.style_profile?.writing_guidelines ||
                                         recommendedSample?.features?.writing_guidelines ||
                                         [])
                                    
                                    // 如果没有 writing_guidelines，基于样文特征动态生成
                                    if (guidelines.length === 0 && (selectedSample || styleProfile)) {
                                      const f = selectedSample?.style_profile || selectedSample?.features || styleProfile
                                      const generated: string[] = []
                                      
                                      // 基于开头类型生成指南
                                      if (f?.opening_style?.type === 'story_intro') {
                                        generated.push('使用故事或场景引入开头')
                                      } else if (f?.opening_style?.type === 'direct') {
                                        generated.push('开门见山，直接切入主题')
                                      } else if (f?.opening_style?.type === 'question') {
                                        generated.push('使用设问式开头，引发读者思考')
                                      }
                                      
                                      // 基于语气类型生成指南
                                      if (f?.tone?.type === 'warm_friend') {
                                        generated.push('保持温润亲切的语气，像朋友聊天')
                                      } else if (f?.tone?.type === 'professional') {
                                        generated.push('保持专业权威的语气')
                                      }
                                      
                                      // 基于句式特征生成指南
                                      if (f?.sentence_pattern?.short_ratio > 0.5) {
                                        generated.push('多用短句，节奏明快')
                                      } else if (f?.sentence_pattern?.avg_length > 25) {
                                        generated.push('可使用长句舒展表达')
                                      } else {
                                        generated.push('长短句交替，保持节奏感')
                                      }
                                      
                                      // 基于结尾类型生成指南
                                      if (f?.ending_style?.type === 'reflection') {
                                        generated.push('结尾引导思考，留有余味')
                                      } else if (f?.ending_style?.type === 'emotional') {
                                        generated.push('结尾升华情感，引发共鸣')
                                      } else if (f?.ending_style?.type === 'practical') {
                                        generated.push('结尾给出实用建议或总结')
                                      }
                                      
                                      // 通用指南
                                      generated.push('融入真实经历和案例，避免说教')
                                      
                                      guidelines = generated
                                    }
                                    
                                    if (guidelines.length === 0) {
                                      return (
                                        <p className="text-xs text-gray-400 italic py-2">暂无创作指南，点击"+ 添加规则"创建</p>
                                      )
                                    }
                                    
                                    return guidelines.map((guide: string, index: number) => (
                                      <div key={index} className="flex items-start gap-2">
                                        <span className="text-xs text-[#3a5e98] mt-2 w-4">{index + 1}.</span>
                                        <input
                                          type="text"
                                          value={guide}
                                          onChange={(e) => {
                                            // 如果是首次编辑，先初始化 editedGuidelines
                                            const currentGuidelines = editedGuidelines.length > 0 ? editedGuidelines : guidelines
                                            const newGuidelines = [...currentGuidelines]
                                            newGuidelines[index] = e.target.value
                                            setEditedGuidelines(newGuidelines)
                                            setIsStyleModified(true)
                                          }}
                                          className="flex-1 text-xs p-2 border border-gray-200 rounded focus:ring-1 focus:ring-[#3a5e98] focus:border-[#3a5e98] bg-white"
                                          placeholder="输入创作规则..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentGuidelines = editedGuidelines.length > 0 ? editedGuidelines : guidelines
                                            const newGuidelines = currentGuidelines.filter((_: string, i: number) => i !== index)
                                            setEditedGuidelines(newGuidelines)
                                            setIsStyleModified(true)
                                          }}
                                          className="text-gray-400 hover:text-red-500 mt-2"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))
                                  })()}
                                </div>
                              </div>
                              
                              {/* 本篇特殊要求 */}
                              <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs text-gray-500 mb-2">本篇特殊要求（可选）</p>
                                <textarea
                                  value={customRequirement}
                                  onChange={(e) => {
                                    setCustomRequirement(e.target.value)
                                    setIsStyleModified(e.target.value.trim() !== '')
                                  }}
                                  className="w-full text-xs p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#3a5e98] focus:border-[#3a5e98] bg-white resize-none"
                                  rows={3}
                                  placeholder="例如：请在文中加入张妈妈的真实反馈案例；开头使用「那天早上...」的叙事方式"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className={`rounded-lg p-3 ${isStyleModified ? 'bg-orange-50 border border-orange-200' : 'bg-[#3a5e98]/10 border border-[#3a5e98]/20'}`}>
                            <p className={`text-sm ${isStyleModified ? 'text-orange-800' : 'text-[#3a5e98]'}`}>
                              {isStyleModified ? (
                                <>
                                  <strong>您已自定义创作规则</strong>，AI 将按照您修改后的指南进行创作，覆盖样文默认特征。
                                </>
                              ) : selectedSampleId ? (
                                <>
                                  <strong>确认后</strong>，AI 将严格复刻「{allSamples.find(s => s.id === selectedSampleId)?.title || recommendedSample?.title}」的写作风格与结构。
                                </>
                              ) : (
                                <>
                                  <strong>确认后</strong>，AI 将使用频道基础人设进行创作。
                                </>
                              )}
                            </p>
                          </div>
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
                        {isExecuting ? '处理中...' : 
                         currentStep === 5 ? '确认风格并继续' : '确认并继续'}
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
            <div className="col-span-3 space-y-4">
              {/* Think Aloud 面板 */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">
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
