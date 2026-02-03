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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DiffViewer from '@/components/DiffViewer'

import { API_BASE } from '@/lib/api-config'

const WORKFLOW_STEPS = [
  { id: 1, name: '理解需求', key: 'step_1_output' },
  { id: 2, name: '信息搜索', key: 'step_2_output', checkpoint: true },
  { id: 3, name: '选题讨论', key: 'step_3_output', checkpoint: true },
  { id: 4, name: '协作文档', key: 'step_4_output' },
  { id: 5, name: '风格建模', key: 'step_5_output', checkpoint: true },
  { id: 6, name: '挂起等待', key: 'step_6_output', checkpoint: true },
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
  const [viewingSample, setViewingSample] = useState<any>(null)  // 查看样文详情
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({})  // 选题展开状态
  const [copiedTopicIndex, setCopiedTopicIndex] = useState<number | null>(null)  // 复制状态
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null)  // 展开查看的素材ID

  useEffect(() => {
    if (taskId) fetchTask()
  }, [taskId])

  const fetchTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`)
      if (res.ok) {
        const data = await res.json()
        setTask(data)
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
    
    // Step 5: 风格建模 - 完整展示所有内容
    if (step.id === 5) {
      const briefData = task.brief_data
      if (!briefData) return null
      
      let formatted = ''
      
      // 1. 推荐样文（最重要）
      const recommendedSample = briefData.selected_sample
      const selectedSample = briefData.selected_sample || recommendedSample
      if (selectedSample) {
        formatted += '⭐ 标杆样文\n'
        formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        formatted += `📌 标题：《${selectedSample.title}》\n`
        if (selectedSample.custom_tags?.length > 0) {
          formatted += `🏷️ 标签：${selectedSample.custom_tags.join('、')}\n`
        }
        if (selectedSample.word_count) {
          formatted += `📝 字数：${selectedSample.word_count} 字\n`
        }
        if (selectedSample.match_score) {
          formatted += `🎯 匹配度：${selectedSample.match_score} 分\n`
        }
        
        // 样文的六维特征（英文类型转中文）
        const typeToZh: Record<string, string> = {
          'direct': '开门见山',
          'story_intro': '故事引入',
          'question': '设问引入',
          'scene': '场景描写',
          'warm_friend': '温润亲切',
          'professional': '专业权威',
          'literary': '文学气质',
          'conversational': '对话感强',
          'emotional': '情感升华',
          'reflection': '引导思考',
          'practical': '实用总结',
          'open_ended': '开放式结尾'
        }
        const getZhType = (val: any) => {
          if (!val) return '—'
          if (typeof val === 'string') return typeToZh[val] || val
          if (val.description) return val.description
          if (val.type) return typeToZh[val.type] || val.type
          return '—'
        }
        
        const sampleProfile = selectedSample.style_profile || selectedSample.features
        if (sampleProfile) {
          formatted += '\n【样文六维特征】\n'
          if (sampleProfile.opening_style) {
            formatted += `  • 开头：${getZhType(sampleProfile.opening_style)}\n`
          }
          if (sampleProfile.tone) {
            formatted += `  • 语气：${getZhType(sampleProfile.tone)}\n`
          }
          if (sampleProfile.sentence_pattern) {
            const sp = sampleProfile.sentence_pattern
            formatted += `  • 句式：${sp.description || '—'}\n`
          }
          if (sampleProfile.paragraph_rhythm) {
            const pr = sampleProfile.paragraph_rhythm
            formatted += `  • 节奏：${pr.description || pr.variation || '—'}\n`
          }
          if (sampleProfile.ending_style) {
            formatted += `  • 结尾：${getZhType(sampleProfile.ending_style)}\n`
          }
          if (sampleProfile.expressions) {
            const ex = sampleProfile.expressions
            formatted += `  • 表达：${ex.description || (ex.examples?.slice(0, 3).join('、')) || '—'}\n`
          }
        }
        formatted += '\n'
      }
      
      // 2. 所有可选样文列表
      const allSamples = briefData.all_samples || []
      if (allSamples.length > 1) {
        formatted += '📚 全部样文（' + allSamples.length + ' 篇）\n'
        formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        allSamples.forEach((sample: any, idx: number) => {
          const isSelected = selectedSample?.id === sample.id
          formatted += `${idx + 1}. ${isSelected ? '✓ ' : ''}《${sample.title}》`
          if (sample.custom_tags?.length > 0) {
            formatted += ` [${sample.custom_tags.slice(0, 3).join('、')}]`
          }
          if (sample.match_score) {
            formatted += ` (${sample.match_score}分)`
          }
          formatted += '\n'
        })
        formatted += '\n'
      }
      
      // 3. 风格画像（从多个来源获取，只有有内容时才显示）
      const styleProfile = briefData.style_profile || selectedSample?.style_profile || selectedSample?.features
      
      // 检查是否有实际内容
      const portrait = styleProfile?.style_portrait
      const logic = styleProfile?.structural_logic
      const toneFeats = styleProfile?.tone_features
      
      if (portrait || (logic && logic.length > 0) || (toneFeats && toneFeats.length > 0)) {
        formatted += '🎨 风格画像\n'
        formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        
        if (portrait) {
          formatted += `「${portrait}」\n\n`
        }
        
        if (logic && logic.length > 0) {
          formatted += `📋 结构逻辑：${logic.slice(0, 5).join(' → ')}\n`
        }
        
        if (toneFeats && toneFeats.length > 0) {
          formatted += `🎭 语气特征：${toneFeats.join('、')}\n`
        }
        formatted += '\n'
      }
      
      // 4. 创作指南
      const guidelines = styleProfile?.writing_guidelines || briefData.user_style_profile?.writing_guidelines
      if (guidelines?.length > 0) {
        formatted += '✏️ 创作指南\n'
        formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        guidelines.forEach((g: string, i: number) => {
          formatted += `${i + 1}. ${g}\n`
        })
        formatted += '\n'
      }
      
      // 5. 检索素材
      const classifiedMaterials = briefData.classified_materials
      if (classifiedMaterials) {
        const longMats = classifiedMaterials.long || []
        const shortMats = classifiedMaterials.short || []
        if (longMats.length + shortMats.length > 0) {
          formatted += '📦 检索素材（' + (longMats.length + shortMats.length) + ' 条）\n'
          formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
          
          if (longMats.length > 0) {
            formatted += '【长文素材】\n'
            longMats.forEach((mat: any, idx: number) => {
              formatted += `${idx + 1}. [${mat.material_type}] ${mat.content?.slice(0, 150)}${mat.content?.length > 150 ? '...' : ''}\n`
              if (mat.source) formatted += `   来源：${mat.source}\n`
              formatted += '\n'
            })
          }
          
          if (shortMats.length > 0) {
            formatted += '【灵感碎片】\n'
            shortMats.forEach((mat: any, idx: number) => {
              formatted += `${idx + 1}. [${mat.material_type}] ${mat.content}\n`
            })
          }
        }
      }
      
      // 6. step_5_output 原始内容作为补充
      const step5Output = briefData.step_5_output
      if (step5Output && !formatted) {
        if (typeof step5Output === 'string') {
          formatted = step5Output
        } else if (step5Output.output) {
          formatted = step5Output.output
        }
      }
      
      return formatted || '风格建模数据加载中...'
    }
    
    // Step 6: 挂起等待 - 显示检查清单
    if (step.id === 6) {
      const briefData = task.brief_data
      let formatted = ''
      
      // checklist 内容
      if (briefData?.step_6_output) {
        const output = briefData.step_6_output
        if (typeof output === 'string') {
          formatted = output
        } else if (output?.checklist) {
          formatted = output.checklist
        } else if (output?.output) {
          formatted = output.output
        }
      }
      
      // 等待确认信息
      if (briefData?.waiting_for) {
        formatted += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        formatted += `⏳ 等待确认：${briefData.waiting_for === 'data_confirmation' ? '素材准备就绪' : briefData.waiting_for}\n`
      }
      
      // 用户素材
      if (briefData?.user_materials) {
        formatted += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        formatted += '📝 用户补充素材：\n\n'
        formatted += briefData.user_materials
      }
      
      return formatted || '等待确认中...'
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
            ) : activeStep === 3 ? (
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
              /* Step 5 特殊渲染：支持点击查看样文 */
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    Step 5: {WORKFLOW_STEPS[4]?.name}
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <ScrollArea className="h-[650px]">
                    {(() => {
                      const briefData = task.brief_data
                      if (!briefData) return <div className="text-center py-16 text-gray-500">暂无产出内容</div>
                      
                      const recommendedSample = briefData.selected_sample
                      const selectedSample = briefData.selected_sample || recommendedSample
                      const allSamples = briefData.all_samples || []
                      const styleProfile = briefData.style_profile || selectedSample?.style_profile || selectedSample?.features
                      const classifiedMaterials = briefData.classified_materials
                      const guidelines = styleProfile?.writing_guidelines || briefData.user_style_profile?.writing_guidelines
                      
                      // 英文类型转中文
                      const typeToZh: Record<string, string> = {
                        'direct': '开门见山', 'story_intro': '故事引入', 'question': '设问引入', 'scene': '场景描写',
                        'warm_friend': '温润亲切', 'professional': '专业权威', 'literary': '文学气质', 'conversational': '对话感强',
                        'emotional': '情感升华', 'reflection': '引导思考', 'practical': '实用总结', 'open_ended': '开放式结尾'
                      }
                      const getZhType = (val: any) => {
                        if (!val) return '—'
                        if (typeof val === 'string') return typeToZh[val] || val
                        if (val.description) return val.description
                        if (val.type) return typeToZh[val.type] || val.type
                        return '—'
                      }
                      
                      return (
                        <div className="space-y-6 p-4">
                          {/* 标杆样文 */}
                          {selectedSample && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>⭐</span> 标杆样文
                              </h3>
                              <div className="bg-gradient-to-r from-[#3a5e98]/5 to-[#2a4a7a]/5 border border-[#3a5e98]/20 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <button
                                      onClick={() => setViewingSample(selectedSample)}
                                      className="text-[#3a5e98] font-medium hover:underline text-left"
                                    >
                                      📌 《{selectedSample.title}》
                                    </button>
                                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                                      {selectedSample.custom_tags?.length > 0 && (
                                        <p>🏷️ 标签：{selectedSample.custom_tags.join('、')}</p>
                                      )}
                                      {selectedSample.word_count && <p>📝 字数：{selectedSample.word_count} 字</p>}
                                      {selectedSample.match_score && <p>🎯 匹配度：{selectedSample.match_score} 分</p>}
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setViewingSample(selectedSample)}
                                    className="text-xs"
                                  >
                                    查看原文
                                  </Button>
                                </div>
                                
                                {/* 六维特征 */}
                                {(selectedSample.style_profile || selectedSample.features) && (
                                  <div className="mt-4 pt-3 border-t border-[#3a5e98]/10">
                                    <p className="text-xs text-gray-500 mb-2">【六维特征】</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                      {(() => {
                                        const sp = selectedSample.style_profile || selectedSample.features
                                        return (
                                          <>
                                            {sp.opening_style && <p>• 开头：{getZhType(sp.opening_style)}</p>}
                                            {sp.tone && <p>• 语气：{getZhType(sp.tone)}</p>}
                                            {sp.sentence_pattern && <p>• 句式：{sp.sentence_pattern.description || '—'}</p>}
                                            {sp.paragraph_rhythm && <p>• 节奏：{sp.paragraph_rhythm.description || sp.paragraph_rhythm.variation || '—'}</p>}
                                            {sp.ending_style && <p>• 结尾：{getZhType(sp.ending_style)}</p>}
                                            {sp.expressions && <p>• 表达：{sp.expressions.description || (sp.expressions.examples?.slice(0, 3).join('、')) || '—'}</p>}
                                          </>
                                        )
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 全部样文列表 */}
                          {allSamples.length > 1 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>📚</span> 全部样文（{allSamples.length} 篇）
                              </h3>
                              <div className="space-y-2">
                                {allSamples.map((sample: any, idx: number) => (
                                  <div key={sample.id || idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      {selectedSample?.id === sample.id && <span className="text-green-600">✓</span>}
                                      <button
                                        onClick={() => setViewingSample(sample)}
                                        className="text-sm text-gray-700 hover:text-[#3a5e98] hover:underline"
                                      >
                                        《{sample.title}》
                                      </button>
                                      {sample.custom_tags?.length > 0 && (
                                        <span className="text-xs text-gray-400">[{sample.custom_tags.slice(0, 2).join('、')}]</span>
                                      )}
                                    </div>
                                    {sample.match_score && <span className="text-xs text-gray-400">{sample.match_score}分</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 风格画像 */}
                          {styleProfile && (styleProfile.style_portrait || styleProfile.structural_logic?.length > 0 || styleProfile.tone_features?.length > 0) && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>🎨</span> 风格画像
                              </h3>
                              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-600">
                                {styleProfile.style_portrait && <p>「{styleProfile.style_portrait}」</p>}
                                {styleProfile.structural_logic?.length > 0 && (
                                  <p>📋 结构逻辑：{styleProfile.structural_logic.slice(0, 5).join(' → ')}</p>
                                )}
                                {styleProfile.tone_features?.length > 0 && (
                                  <p>🎭 语气特征：{styleProfile.tone_features.join('、')}</p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 创作指南 */}
                          {guidelines?.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>✏️</span> 创作指南
                              </h3>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                                  {guidelines.map((g: string, i: number) => <li key={i}>{g}</li>)}
                                </ol>
                              </div>
                            </div>
                          )}
                          
                          {/* 检索素材 */}
                          {classifiedMaterials && (classifiedMaterials.long?.length > 0 || classifiedMaterials.short?.length > 0) && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <span>📦</span> 检索素材（{(classifiedMaterials.long?.length || 0) + (classifiedMaterials.short?.length || 0)} 条）
                              </h3>
                              <div className="space-y-3">
                                {classifiedMaterials.long?.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-2">【长文素材】</p>
                                    {classifiedMaterials.long.map((mat: any, idx: number) => {
                                      const matId = mat.id || `long-${idx}`
                                      const isExpanded = expandedMaterialId === matId
                                      const wordCount = mat.content_length || mat.content?.length || 0
                                      
                                      return (
                                        <div key={matId} className="bg-gray-50 rounded-lg p-3 mb-2">
                                          {/* 头部：类型 + 展开按钮 */}
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-400">[{mat.material_type}]</p>
                                            <button
                                              onClick={() => setExpandedMaterialId(isExpanded ? null : matId)}
                                              className="text-xs text-[#3a5e98] hover:underline"
                                            >
                                              {isExpanded ? '收起' : '展开查看'}
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
                                          
                                          {/* 展开后显示完整内容 */}
                                          {isExpanded && (
                                            <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{mat.content}</p>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                {classifiedMaterials.short?.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-2">【灵感碎片】</p>
                                    {classifiedMaterials.short.map((mat: any, idx: number) => (
                                      <div key={mat.id || idx} className="bg-gray-50 rounded-lg p-2 mb-1">
                                        <span className="text-xs text-gray-400">[{mat.material_type}] </span>
                                        <span className="text-sm text-gray-700">{mat.content}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 无内容提示 */}
                          {!selectedSample && !styleProfile && !classifiedMaterials && (
                            <div className="text-center py-16 text-gray-500">暂无产出内容</div>
                          )}
                        </div>
                      )
                    })()}
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
      
      {/* 样文详情弹窗 */}
      <Dialog open={!!viewingSample} onOpenChange={() => setViewingSample(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📄</span>
              {viewingSample?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 样文元信息 */}
            <div className="flex flex-wrap gap-2 text-sm">
              {viewingSample?.custom_tags?.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-700">
                  {tag}
                </Badge>
              ))}
              {viewingSample?.word_count && (
                <Badge variant="outline">{viewingSample.word_count} 字</Badge>
              )}
            </div>
            
            {/* 样文内容 */}
            <ScrollArea className="h-[50vh]">
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {viewingSample?.content || '样文内容未保存'}
                </pre>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
