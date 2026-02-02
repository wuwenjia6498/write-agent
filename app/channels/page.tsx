'use client'

import { useEffect, useState } from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { TagInput } from '@/components/ui/tag-input'

const API_BASE = 'http://localhost:8000/api'

interface Channel {
  channel_id: string
  channel_name: string
  description: string
  target_audience: string
  brand_personality: string
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [channelDetails, setChannelDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // 新增频道对话框
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newChannel, setNewChannel] = useState({
    name: '',
    slug: '',
    description: '',
    target_audience: '',   // 目标读者
    brand_personality: '', // 品牌人格
    role: '',
    writing_style: '',
    must_do: '',           // 必须遵守（每行一条）
    must_not_do: '',       // 严格禁止（每行一条）
    blocked_phrases: [] as string[],  // 屏蔽词（数组）
    material_tags: [] as string[]     // 素材标签（数组）
  })
  const [creating, setCreating] = useState(false)
  
  // 编辑频道对话框
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editChannel, setEditChannel] = useState({
    slug: '',
    name: '',
    description: '',
    target_audience: '',
    brand_personality: '',
    role: '',
    writing_style: '',
    must_do: '',
    must_not_do: '',
    blocked_phrases: [] as string[],   // 改为数组，配合 TagInput
    material_tags: [] as string[]      // 改为数组，配合 TagInput
  })
  const [editing, setEditing] = useState(false)
  
  // 样文管理 (v3.5)
  const [styleSamples, setStyleSamples] = useState<any[]>([])
  const [isAddSampleDialogOpen, setIsAddSampleDialogOpen] = useState(false)
  const [newSample, setNewSample] = useState({ title: '', content: '', source: '', custom_tags: [] as string[] })
  const [addingSample, setAddingSample] = useState(false)
  const [viewingSample, setViewingSample] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [reanalyzingSampleId, setReanalyzingSampleId] = useState<string | null>(null)
  
  // 标签编辑 (v3.5)
  const [editingTagsSampleId, setEditingTagsSampleId] = useState<string | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  // 预设标签库（按分类）
  const [presetTagLibrary, setPresetTagLibrary] = useState<{
    内容?: string[]
    调性?: string[]
  }>({ 内容: [], 调性: [] })
  const [allPresetTags, setAllPresetTags] = useState<string[]>([])
  // 兼容旧代码的扁平标签列表
  const presetTags = [...(presetTagLibrary.内容 || []), ...(presetTagLibrary.调性 || [])]
  
    const fetchChannels = async () => {
      try {
      const response = await fetch(`${API_BASE}/channels/`)
        if (response.ok) {
          const data = await response.json()
          setChannels(data)
        }
      } catch (error) {
        console.error('获取频道列表失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
  useEffect(() => {
    fetchChannels()
  }, [])

  // 创建新频道
  const handleCreate = async () => {
    if (!newChannel.name.trim() || !newChannel.slug.trim()) {
      alert('请填写频道名称和标识符')
      return
    }

    setCreating(true)
    try {
      // 构建 system_prompt（只包含 AI 写作相关配置）
      const systemPrompt = {
        role: newChannel.role || `你是一位专业的${newChannel.name}内容创作者`,
        writing_style: newChannel.writing_style 
          ? newChannel.writing_style.split('\n').filter(Boolean)
          : []
      }
      
      // 构建频道规则
      const channelRules = {
        must_do: newChannel.must_do
          ? newChannel.must_do.split('\n').filter(Boolean)
          : [],
        must_not_do: newChannel.must_not_do
          ? newChannel.must_not_do.split('\n').filter(Boolean)
          : []
      }

      const res = await fetch(`${API_BASE}/channels/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannel.name,
          slug: newChannel.slug,
          description: newChannel.description,
          target_audience: newChannel.target_audience,
          brand_personality: newChannel.brand_personality,
          system_prompt: systemPrompt,
          channel_rules: channelRules,
          // 直接使用数组
          blocked_phrases: newChannel.blocked_phrases,
          material_tags: newChannel.material_tags
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewChannel({ 
          name: '', slug: '', description: '', target_audience: '', brand_personality: '',
          role: '', writing_style: '', must_do: '', must_not_do: '', blocked_phrases: [], material_tags: []
        })
        await fetchChannels()
        setSelectedChannel('')
        setChannelDetails(null)
      } else {
        const error = await res.json()
        throw new Error(error.detail || '创建失败')
      }
    } catch (error: any) {
      console.error('创建失败:', error)
      alert(error.message || '创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  // 删除频道
  const handleDelete = async (channelId: string) => {
    if (!confirm('确定要删除这个频道吗？')) return

    try {
      const res = await fetch(`${API_BASE}/channels/${channelId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchChannels()
        if (selectedChannel === channelId) {
          setSelectedChannel('')
          setChannelDetails(null)
        }
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  // 打开编辑对话框
  const handleEdit = (channelId: string) => {
    if (!channelDetails || channelDetails.channel_id !== channelId) return
    
    const systemPrompt = channelDetails.system_prompt || {}
    const rules = channelDetails.channel_specific_rules || {}
    
    setEditChannel({
      slug: channelDetails.channel_id,
      name: channelDetails.channel_name || '',
      description: channelDetails.description || '',
      target_audience: channelDetails.target_audience || '',
      brand_personality: channelDetails.brand_personality || '',
      role: systemPrompt.role || '',
      writing_style: Array.isArray(systemPrompt.writing_style) 
        ? systemPrompt.writing_style.join('\n') 
        : '',
      must_do: Array.isArray(rules.must_do) ? rules.must_do.join('\n') : '',
      must_not_do: Array.isArray(rules.must_not_do) ? rules.must_not_do.join('\n') : '',
      // 直接使用数组，配合 TagInput 组件
      blocked_phrases: Array.isArray(channelDetails.blocked_phrases) 
        ? channelDetails.blocked_phrases 
        : [],
      material_tags: Array.isArray(channelDetails.material_tags) 
        ? channelDetails.material_tags 
        : []
    })
    setIsEditDialogOpen(true)
  }

  // 保存编辑
  const handleUpdate = async () => {
    if (!editChannel.name.trim()) {
      alert('请填写频道名称')
      return
    }

    setEditing(true)
    try {
      const systemPrompt = {
        role: editChannel.role || `你是一位专业的${editChannel.name}内容创作者`,
        writing_style: editChannel.writing_style 
          ? editChannel.writing_style.split('\n').filter(Boolean)
          : []
      }
      
      const channelRules = {
        must_do: editChannel.must_do ? editChannel.must_do.split('\n').filter(Boolean) : [],
        must_not_do: editChannel.must_not_do ? editChannel.must_not_do.split('\n').filter(Boolean) : []
      }
      
      // blocked_phrases 和 material_tags 已经是数组格式，直接使用
      const res = await fetch(`${API_BASE}/channels/${editChannel.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editChannel.name,
          description: editChannel.description,
          target_audience: editChannel.target_audience,
          brand_personality: editChannel.brand_personality,
          system_prompt: systemPrompt,
          channel_rules: channelRules,
          blocked_phrases: editChannel.blocked_phrases,
          material_tags: editChannel.material_tags
        })
      })

      if (res.ok) {
        setIsEditDialogOpen(false)
        await fetchChannels()
        // 重新加载频道详情
        await loadChannelDetails(editChannel.slug)
      } else {
        const error = await res.json()
        throw new Error(error.detail || '更新失败')
      }
    } catch (error: any) {
      console.error('更新失败:', error)
      alert(error.message || '更新失败，请重试')
    } finally {
      setEditing(false)
    }
  }
  
  const loadChannelDetails = async (channelId: string) => {
    try {
      const response = await fetch(`${API_BASE}/channels/${channelId}`)
      if (response.ok) {
        const data = await response.json()
        setChannelDetails(data)
        setSelectedChannel(channelId)
        // 加载标杆样文和预设标签
        await Promise.all([
          loadStyleSamples(channelId),
          loadPresetTags(channelId)
        ])
      }
    } catch (error) {
      console.error('获取频道详情失败:', error)
    }
  }
  
  // 加载样文
  const loadStyleSamples = async (channelSlug: string) => {
    try {
      const response = await fetch(`${API_BASE}/channels/${channelSlug}/style-samples`)
      if (response.ok) {
        const data = await response.json()
        setStyleSamples(data)
      }
    } catch (error) {
      console.error('获取样文失败:', error)
      setStyleSamples([])
    }
  }
  
  // 加载预设标签库
  const loadPresetTags = async (channelSlug: string) => {
    try {
      const response = await fetch(`${API_BASE}/channels/${channelSlug}/style-samples/preset-tags`)
      if (response.ok) {
        const data = await response.json()
        // 新格式：{ tags: { 内容: [...], 调性: [...] }, all_tags: [...] }
        if (data.tags) {
          setPresetTagLibrary(data.tags)
          setAllPresetTags(data.all_tags || [])
        } else {
          // 兼容旧格式（纯数组）
          setPresetTagLibrary({ 内容: data, 调性: [] })
          setAllPresetTags(data)
        }
      }
    } catch (error) {
      console.error('获取预设标签失败:', error)
    }
  }
  
  // 添加样文 (v3.5 支持 custom_tags)
  const handleAddSample = async () => {
    if (!newSample.title.trim() || !newSample.content.trim()) {
      alert('请填写样文标题和内容')
      return
    }
    
    setAddingSample(true)
    try {
      const response = await fetch(`${API_BASE}/channels/${selectedChannel}/style-samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSample.title,
          content: newSample.content,
          source: newSample.source,
          custom_tags: newSample.custom_tags || []
        })
      })
      
      if (response.ok) {
        setIsAddSampleDialogOpen(false)
        setNewSample({ title: '', content: '', source: '', custom_tags: [] })
        await loadStyleSamples(selectedChannel)
      } else {
        const error = await response.json()
        throw new Error(error.detail || '添加失败')
      }
    } catch (error: any) {
      alert(error.message || '添加样文失败')
    } finally {
      setAddingSample(false)
    }
  }
  
  // 重新分析风格
  const handleReanalyzeStyle = async () => {
    if (styleSamples.length === 0) {
      alert('请先添加样文')
      return
    }
    
    setAnalyzing(true)
    try {
      const response = await fetch(`${API_BASE}/channels/${selectedChannel}/analyze-style`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        // 更新 channelDetails 中的 style_profile
        setChannelDetails((prev: any) => ({
          ...prev,
          style_profile: result.style_profile
        }))
        alert('风格分析完成！')
      } else {
        const error = await response.json()
        throw new Error(error.detail || '分析失败')
      }
    } catch (error: any) {
      console.error('风格分析失败:', error)
      alert(error.message || '风格分析失败，请重试')
    } finally {
      setAnalyzing(false)
    }
  }
  
  // 重新分析单篇样文
  const handleReanalyzeSample = async (sampleId: string) => {
    setReanalyzingSampleId(sampleId)
    try {
      const response = await fetch(`${API_BASE}/channels/${selectedChannel}/style-samples/${sampleId}/analyze`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        // 更新本地样文列表中的特征
        setStyleSamples(prev => prev.map(s => 
          s.id === sampleId ? { ...s, features: result.features } : s
        ))
      } else {
        const error = await response.json()
        throw new Error(error.detail || '分析失败')
      }
    } catch (error: any) {
      alert(error.message || '重新分析失败')
    } finally {
      setReanalyzingSampleId(null)
    }
  }
  
  // 删除样文
  const handleDeleteSample = async (sampleId: string) => {
    if (!confirm('确定要删除这篇样文吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/channels/${selectedChannel}/style-samples/${sampleId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await loadStyleSamples(selectedChannel)
      } else {
        const error = await response.json()
        throw new Error(error.detail || '删除失败')
      }
    } catch (error: any) {
      alert(error.message || '删除样文失败')
    }
  }
  
  // v3.5: 更新样文标签
  const handleUpdateSampleTags = async (sampleId: string, newTags: string[]) => {
    try {
      const response = await fetch(`${API_BASE}/channels/${selectedChannel}/style-samples/${sampleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_tags: newTags })
      })
      
      if (response.ok) {
        // 更新本地状态
        setStyleSamples(prev => prev.map(s => 
          s.id === sampleId ? { ...s, custom_tags: newTags } : s
        ))
      } else {
        const error = await response.json()
        throw new Error(error.detail || '更新失败')
      }
    } catch (error: any) {
      alert(error.message || '更新标签失败')
    }
  }
  
  // v3.5: 添加标签
  const handleAddTag = (sampleId: string, tag: string) => {
    const sample = styleSamples.find(s => s.id === sampleId)
    if (!sample) return
    
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`
    const currentTags = sample.custom_tags || []
    
    if (!currentTags.includes(normalizedTag)) {
      const newTags = [...currentTags, normalizedTag]
      handleUpdateSampleTags(sampleId, newTags)
    }
    setNewTagInput('')
  }
  
  // v3.5: 删除标签
  const handleRemoveTag = (sampleId: string, tagToRemove: string) => {
    const sample = styleSamples.find(s => s.id === sampleId)
    if (!sample) return
    
    const newTags = (sample.custom_tags || []).filter((t: string) => t !== tagToRemove)
    handleUpdateSampleTags(sampleId, newTags)
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="频道管理" subtitle="Channel Management" />
      
      {/* 主内容 */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：频道列表 */}
          <div className="col-span-4">
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">内容频道</CardTitle>
                    <CardDescription>共 {channels.length} 个频道</CardDescription>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[#3a5e98] hover:bg-[#2d4a78]">
                        新增
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg">新增频道</DialogTitle>
                        <DialogDescription className="text-[#3a5e98]">
                          创建一个新的内容频道，设置独立的写作风格
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="py-2">
                        {/* ========== 1. 频道身份 ========== */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-semibold text-gray-700">1. 频道身份</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                          
                          {/* 频道名称 + 标识符 并排 */}
                          <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">频道名称 *</Label>
                              <Input
                                placeholder="如：深度阅读"
                                value={newChannel.name}
                                onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                                className="mt-1.5 border-gray-200 focus:border-[#3a5e98]"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">频道标识符 *</Label>
                              <Input
                                placeholder="如：deep_reading"
                                value={newChannel.slug}
                                onChange={(e) => setNewChannel({ ...newChannel, slug: e.target.value })}
                                className="mt-1.5 border-gray-200 focus:border-[#3a5e98]"
                              />
                            </div>
                          </div>
                          
                          {/* 频道描述 */}
                          <div className="mb-5">
                            <Label className="text-xs text-gray-500 font-normal">频道描述</Label>
                            <AutoResizeTextarea
                              minRows={2}
                              maxRows={4}
                              placeholder="描述该频道的内容方向、定位、特色..."
                              value={newChannel.description}
                              onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                              className="mt-1.5"
                            />
                          </div>
                          
                          {/* 目标读者 + 品牌人格 并排 */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">目标读者</Label>
                              <AutoResizeTextarea
                                minRows={2}
                                maxRows={4}
                                placeholder="如：7-12岁小学生家长，希望培养孩子深度阅读习惯"
                                value={newChannel.target_audience}
                                onChange={(e) => setNewChannel({ ...newChannel, target_audience: e.target.value })}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">品牌人格</Label>
                              <AutoResizeTextarea
                                minRows={2}
                                maxRows={4}
                                placeholder="如：资深阅读推广人，温暖而专业"
                                value={newChannel.brand_personality}
                                onChange={(e) => setNewChannel({ ...newChannel, brand_personality: e.target.value })}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* ========== 2. 创作策略 ========== */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-semibold text-gray-700">2. 创作策略</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                          
                          {/* AI 角色定位 */}
                          <div className="mb-5">
                            <Label className="text-xs text-gray-500 font-normal">AI 角色定位</Label>
                            <AutoResizeTextarea
                              minRows={2}
                              maxRows={5}
                              placeholder="如：你是'老约翰儿童阅读'的资深阅读推广专家，专注于小学段的深度阅读指导..."
                              value={newChannel.role}
                              onChange={(e) => setNewChannel({ ...newChannel, role: e.target.value })}
                              className="mt-1.5"
                            />
                          </div>
                          
                          {/* 写作风格 */}
                          <div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-gray-500 font-normal">写作风格</Label>
                              <span className="text-[10px] text-gray-400">每行一条规则</span>
                            </div>
                            <AutoResizeTextarea
                              minRows={3}
                              maxRows={8}
                              placeholder="语言专业但不晦涩，有文学厚度但不卖弄&#10;逻辑严密，论证充分，善于用具体案例说明观点&#10;拒绝低幼化表达，尊重小学生的认知能力"
                              value={newChannel.writing_style}
                              onChange={(e) => setNewChannel({ ...newChannel, writing_style: e.target.value })}
                              className="mt-1.5 font-mono text-[13px] leading-relaxed"
                            />
                          </div>
                        </div>
                        
                        {/* ========== 3. 规则围栏 ========== */}
                        <div className="mb-2">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-semibold text-gray-700">3. 规则围栏</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                          
                          {/* 必须遵守 + 严格禁止 并排 */}
                          <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-gray-500 font-normal">必须遵守</Label>
                                <span className="text-[10px] text-gray-400">每行一条</span>
                              </div>
                              <AutoResizeTextarea
                                minRows={3}
                                maxRows={6}
                                placeholder="引用具体的书籍段落或情节&#10;提供可操作的阅读指导方法&#10;关注思维能力的培养而非知识灌输"
                                value={newChannel.must_do}
                                onChange={(e) => setNewChannel({ ...newChannel, must_do: e.target.value })}
                                className="mt-1.5 font-mono text-[13px] leading-relaxed border-green-200 focus:border-green-400 focus:ring-green-100"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-gray-500 font-normal">严格禁止</Label>
                                <span className="text-[10px] text-gray-400">每行一条</span>
                              </div>
                              <AutoResizeTextarea
                                minRows={3}
                                maxRows={6}
                                placeholder="简化为低幼化的语言&#10;将文学作品功利化&#10;使用过于学术的文学理论术语"
                                value={newChannel.must_not_do}
                                onChange={(e) => setNewChannel({ ...newChannel, must_not_do: e.target.value })}
                                className="mt-1.5 font-mono text-[13px] leading-relaxed border-red-200 focus:border-red-400 focus:ring-red-100 bg-red-50/30"
                              />
                            </div>
                          </div>
                          
                          {/* 屏蔽词 + 素材标签 并排 - 使用 TagInput */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">频道屏蔽词</Label>
                              <p className="text-[10px] text-gray-400 mt-0.5 mb-1.5">输入后按回车添加，支持逗号分隔批量粘贴</p>
                              <TagInput
                                value={newChannel.blocked_phrases}
                                onChange={(tags) => setNewChannel({ ...newChannel, blocked_phrases: tags })}
                                placeholder="输入屏蔽词..."
                                variant="gray"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 font-normal">素材标签</Label>
                              <p className="text-[10px] text-gray-400 mt-0.5 mb-1.5">用于关联素材库中的相关内容</p>
                              <TagInput
                                value={newChannel.material_tags}
                                onChange={(tags) => setNewChannel({ ...newChannel, material_tags: tags })}
                                placeholder="输入素材标签..."
                                variant="blue"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <DialogFooter className="border-t border-gray-100 pt-4">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-gray-200">
                          取消
                        </Button>
                        <Button 
                          className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
                          onClick={handleCreate} 
                          disabled={creating}
                        >
                          {creating ? '创建中...' : '创建频道'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="space-y-2">
                  {channels.map((channel) => (
                      <div
                      key={channel.channel_id}
                        className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedChannel === channel.channel_id
                            ? 'border-[#3a5e98] bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                        onClick={() => loadChannelDetails(channel.channel_id)}
                    >
                        <h3 className="font-medium text-gray-900 mb-1 pr-12">
                        {channel.channel_name}
                      </h3>
                        <p className="text-sm text-gray-500 line-clamp-2">
                        {channel.description}
                      </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(channel.channel_id)
                          }}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-600 h-8 px-2"
                        >
                          删除
                        </Button>
                      </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          </div>
          
          {/* 右侧：频道详情 */}
          <div className="col-span-8">
            {!channelDetails ? (
              <Card className="border-gray-200 h-full flex items-center justify-center">
                <div className="text-center py-20 text-gray-500">
                  <p>请从左侧选择一个频道查看详情</p>
              </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* 样文管理 - 放在最前面 */}
                <Card className="border-gray-200 border-2 border-dashed border-[#3a5e98]/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="text-[#3a5e98]">📝</span>
                          样文
                        </CardTitle>
                        <CardDescription>
                          用于风格建模的参考文章（最多 5 篇）
                        </CardDescription>
                      </div>
                      <Dialog open={isAddSampleDialogOpen} onOpenChange={setIsAddSampleDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-[#3a5e98] hover:bg-[#2d4a78]"
                            disabled={styleSamples.length >= 5}
                          >
                            添加样文
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>添加样文</DialogTitle>
                            <DialogDescription>
                              添加一篇代表该频道风格的文章，AI 将学习其写作风格
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>样文标题 *</Label>
                              <Input
                                placeholder="如：关于阅读的那些事"
                                value={newSample.title}
                                onChange={(e) => setNewSample({ ...newSample, title: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>样文内容 *</Label>
                              <Textarea
                                placeholder="粘贴完整的样文内容..."
                                rows={15}
                                value={newSample.content}
                                onChange={(e) => setNewSample({ ...newSample, content: e.target.value })}
                                className="mt-1 font-mono text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                当前字数：{newSample.content.length} 字
                              </p>
                            </div>
                            <div>
                              <Label>来源（可选）</Label>
                              <Input
                                placeholder="如：公众号文章、个人博客等"
                                value={newSample.source}
                                onChange={(e) => setNewSample({ ...newSample, source: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            
                            {/* v3.5: 自定义标签 - 按分类显示 */}
                            <div>
                              <Label>风格标签（可选）</Label>
                              <p className="text-xs text-gray-500 mt-1 mb-3">
                                为样文添加标签，便于 AI 在创作时自动匹配最合适的样文
                              </p>
                              
                              {/* 内容标签 */}
                              {(presetTagLibrary.内容 || []).length > 0 && (
                                <div className="mb-3">
                                  <span className="text-xs text-gray-500 font-medium">内容标签</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {(presetTagLibrary.内容 || []).map((tag, i) => (
                                      <button
                                        key={`content-${i}`}
                                        type="button"
                                        onClick={() => {
                                          const currentTags = newSample.custom_tags || []
                                          if (currentTags.includes(tag)) {
                                            setNewSample({ ...newSample, custom_tags: currentTags.filter(t => t !== tag) })
                                          } else {
                                            setNewSample({ ...newSample, custom_tags: [...currentTags, tag] })
                                          }
                                        }}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                          (newSample.custom_tags || []).includes(tag)
                                            ? 'bg-[#3a5e98] text-white border-[#3a5e98]'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#3a5e98]'
                                        }`}
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 调性标签 */}
                              {(presetTagLibrary.调性 || []).length > 0 && (
                                <div>
                                  <span className="text-xs text-gray-500 font-medium">调性标签</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {(presetTagLibrary.调性 || []).map((tag, i) => (
                                      <button
                                        key={`tone-${i}`}
                                        type="button"
                                        onClick={() => {
                                          const currentTags = newSample.custom_tags || []
                                          if (currentTags.includes(tag)) {
                                            setNewSample({ ...newSample, custom_tags: currentTags.filter(t => t !== tag) })
                                          } else {
                                            setNewSample({ ...newSample, custom_tags: [...currentTags, tag] })
                                          }
                                        }}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                          (newSample.custom_tags || []).includes(tag)
                                            ? 'bg-[#5a8a5e] text-white border-[#5a8a5e]'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#5a8a5e]'
                                        }`}
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {(newSample.custom_tags || []).length > 0 && (
                                <p className="text-xs text-[#3a5e98] mt-3">
                                  已选择：{(newSample.custom_tags || []).join('、')}
                                </p>
                              )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddSampleDialogOpen(false)}>
                              取消
                            </Button>
                            <Button 
                              className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
                              onClick={handleAddSample}
                              disabled={addingSample}
                            >
                              {addingSample ? '添加中...' : '添加并分析'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {styleSamples.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">暂无样文</p>
                        <p className="text-xs mt-1">添加 3-5 篇代表性文章，AI 将学习其风格</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {styleSamples.map((sample, index) => (
                          <div 
                            key={sample.id} 
                            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-[#3a5e98]/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => setViewingSample(sample)}
                          >
                            {/* 头部：标题 + 操作按钮 */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-6 h-6 bg-[#3a5e98] text-white rounded-full flex items-center justify-center text-xs font-medium">
                                    {index + 1}
                                  </span>
                                  <h4 className="font-medium text-gray-900">{sample.title}</h4>
                                  {(sample.features || sample.is_analyzed) && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                      ✓ 已分析
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-400 ml-8">
                                  <span>{sample.word_count || sample.content?.length || 0} 字</span>
                                  {sample.source && <span>来源: {sample.source}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleReanalyzeSample(sample.id)
                                  }}
                                  disabled={reanalyzingSampleId === sample.id}
                                  className="text-gray-400 hover:text-[#3a5e98] h-8 px-2 text-xs"
                                >
                                  {reanalyzingSampleId === sample.id ? '分析中...' : '重新分析'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSample(sample.id)
                                  }}
                                  className="text-gray-400 hover:text-red-600 h-8 px-2"
                                >
                                  删除
                                </Button>
                              </div>
                            </div>
                            
                            {/* 结构逻辑和语气特征概括（一句话） */}
                            {(sample.features || sample.style_profile) && (
                              <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg border-l-3 border-[#3a5e98]">
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {(() => {
                                    const f = sample.features || sample.style_profile
                                    // 构建开头类型描述
                                    const openingType = f?.opening_style?.type
                                    const opening = openingType === 'story_intro' ? '故事引入开篇' :
                                                    openingType === 'direct' ? '开门见山' :
                                                    openingType === 'question' ? '设问式开头' :
                                                    openingType === 'scene' ? '场景描写开篇' :
                                                    f?.opening_style?.description?.slice(0, 6) || '自然开篇'
                                    // 构建语气描述
                                    const toneType = f?.tone?.type
                                    const tone = toneType === 'warm_friend' ? '温润亲切' :
                                                 toneType === 'professional' ? '专业权威' :
                                                 toneType === 'literary' ? '文学气质' :
                                                 toneType === 'conversational' ? '对话感强' :
                                                 f?.tone?.description?.slice(0, 6) || '平和自然'
                                    // 构建结尾类型描述
                                    const endingType = f?.ending_style?.type
                                    const ending = endingType === 'reflection' ? '引导思考收尾' :
                                                   endingType === 'question' ? '提问式收尾' :
                                                   endingType === 'emotional' ? '情感升华' :
                                                   endingType === 'practical' ? '实用总结' :
                                                   f?.ending_style?.description?.slice(0, 6) || '自然收尾'
                                    return `${opening}，语气${tone}，${ending}。`
                                  })()}
                                </p>
                              </div>
                            )}
                            
                            {/* 自定义标签系统 (v3.5) - 阻止冒泡避免触发详情弹窗 */}
                            <div className="border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 font-medium">风格标签</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingTagsSampleId(
                                      editingTagsSampleId === sample.id ? null : sample.id
                                    )
                                  }}
                                  className="text-xs text-[#3a5e98] hover:underline"
                                >
                                  {editingTagsSampleId === sample.id ? '完成' : '编辑'}
                                </button>
                              </div>
                              
                              <div className="flex flex-wrap gap-1.5">
                                {/* 主编定义的标签（蓝色） */}
                                {(sample.custom_tags || []).map((tag: string, i: number) => (
                                  <span 
                                    key={`custom-${i}`}
                                    className="inline-flex items-center gap-1 bg-[#3a5e98] text-white px-2 py-0.5 rounded-full text-xs"
                                  >
                                    {tag}
                                    {editingTagsSampleId === sample.id && (
                                      <button
                                        onClick={() => handleRemoveTag(sample.id, tag)}
                                        className="hover:bg-white/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))}
                                
                                {/* AI 建议的标签（灰色） */}
                                {(sample.ai_suggested_tags || []).map((tag: string, i: number) => (
                                  <span 
                                    key={`ai-${i}`}
                                    className="inline-flex items-center gap-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs cursor-pointer hover:bg-gray-300"
                                    onClick={() => handleAddTag(sample.id, tag)}
                                    title="点击采纳为自定义标签"
                                  >
                                    {tag}
                                    <span className="text-gray-400 text-[10px]">AI</span>
                                  </span>
                                ))}
                                
                                {/* 无标签提示 */}
                                {(!sample.custom_tags || sample.custom_tags.length === 0) && 
                                 (!sample.ai_suggested_tags || sample.ai_suggested_tags.length === 0) && (
                                  <span className="text-xs text-gray-400">暂无标签，点击编辑添加</span>
                                )}
                              </div>
                              
                              {/* 标签编辑面板 */}
                              {editingTagsSampleId === sample.id && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <div className="flex gap-2 mb-2">
                                    <Input
                                      placeholder="输入标签名称（如：#绘本解析）"
                                      value={newTagInput}
                                      onChange={(e) => setNewTagInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newTagInput.trim()) {
                                          handleAddTag(sample.id, newTagInput.trim())
                                        }
                                      }}
                                      className="h-8 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        if (newTagInput.trim()) {
                                          handleAddTag(sample.id, newTagInput.trim())
                                        }
                                      }}
                                      className="h-8 px-3 bg-[#3a5e98] hover:bg-[#2d4a78] text-xs"
                                    >
                                      添加
                                    </Button>
                                  </div>
                                  <div className="text-xs text-gray-500 mb-2">快速选择预设标签：</div>
                                  {/* 内容标签 */}
                                  {(presetTagLibrary.内容 || []).length > 0 && (
                                    <div className="mb-2">
                                      <span className="text-[10px] text-gray-400">内容</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {(presetTagLibrary.内容 || []).map((tag, i) => (
                                          <button
                                            key={`edit-content-${i}`}
                                            onClick={() => handleAddTag(sample.id, tag)}
                                            disabled={(sample.custom_tags || []).includes(tag)}
                                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                              (sample.custom_tags || []).includes(tag)
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-[#3a5e98] hover:text-[#3a5e98]'
                                            }`}
                                          >
                                            {tag}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* 调性标签 */}
                                  {(presetTagLibrary.调性 || []).length > 0 && (
                                    <div>
                                      <span className="text-[10px] text-gray-400">调性</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {(presetTagLibrary.调性 || []).map((tag, i) => (
                                          <button
                                            key={`edit-tone-${i}`}
                                            onClick={() => handleAddTag(sample.id, tag)}
                                            disabled={(sample.custom_tags || []).includes(tag)}
                                            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                              (sample.custom_tags || []).includes(tag)
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-[#5a8a5e] hover:text-[#5a8a5e]'
                                            }`}
                                          >
                                            {tag}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* 风格 DNA 看板 */}
                {channelDetails.style_profile && (
                  <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <span>🧬</span>
                            风格 DNA
                          </CardTitle>
                          <CardDescription>
                            基于 {styleSamples.length} 篇样文自动生成的风格画像
                          </CardDescription>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleReanalyzeStyle}
                          disabled={analyzing || styleSamples.length === 0}
                        >
                          {analyzing ? '分析中...' : '重新分析'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 风格画像 - 一句话概括 */}
                      {channelDetails.style_profile.style_portrait && (
                        <div className="bg-[#3a5e98]/5 border border-[#3a5e98]/20 rounded-lg p-4">
                          <p className="text-sm font-medium text-[#3a5e98] mb-1">📝 风格画像</p>
                          <p className="text-gray-800 leading-relaxed">
                            "{channelDetails.style_profile.style_portrait}"
                          </p>
                        </div>
                      )}
                      
                      {/* 结构逻辑 + 语气特征 */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* 结构逻辑 */}
                        {channelDetails.style_profile.structural_logic && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                              🔗 结构逻辑
                            </p>
                            <div className="flex flex-wrap items-center gap-1">
                              {channelDetails.style_profile.structural_logic.map((item: string, index: number) => (
                                <span key={index} className="flex items-center">
                                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                                    {item}
                                  </span>
                                  {index < channelDetails.style_profile.structural_logic.length - 1 && (
                                    <span className="text-gray-400 mx-1">→</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 语气特征 */}
                        {channelDetails.style_profile.tone_features && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                              💬 语气特征
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {channelDetails.style_profile.tone_features.map((feature: string, index: number) => (
                                <Badge 
                                  key={index} 
                                  variant="secondary" 
                                  className="bg-[#3a5e98]/10 text-[#3a5e98] border-0"
                                >
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 六维度详解 */}
                      {channelDetails.style_profile.dimensions && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                            📊 六维度详解
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {channelDetails.style_profile.dimensions.opening_style && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">开头习惯:</span>
                                <span className="text-gray-700">{channelDetails.style_profile.dimensions.opening_style.description}</span>
                              </div>
                            )}
                            {channelDetails.style_profile.dimensions.sentence_pattern && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">句式特征:</span>
                                <span className="text-gray-700">{channelDetails.style_profile.dimensions.sentence_pattern.description}</span>
                              </div>
                            )}
                            {channelDetails.style_profile.dimensions.paragraph_rhythm && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">段落节奏:</span>
                                <span className="text-gray-700">{channelDetails.style_profile.dimensions.paragraph_rhythm.description}</span>
                              </div>
                            )}
                            {channelDetails.style_profile.dimensions.expressions && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">常用表达:</span>
                                <span className="text-gray-700">
                                  {channelDetails.style_profile.dimensions.expressions.high_freq_words?.slice(0, 5).join('、')}
                                </span>
                              </div>
                            )}
                            {channelDetails.style_profile.dimensions.tone && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">语气特点:</span>
                                <span className="text-gray-700">{channelDetails.style_profile.dimensions.tone.description}</span>
                              </div>
                            )}
                            {channelDetails.style_profile.dimensions.ending_style && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-500 whitespace-nowrap">结尾风格:</span>
                                <span className="text-gray-700">{channelDetails.style_profile.dimensions.ending_style.description}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 创作指南 */}
                      {channelDetails.style_profile.writing_guidelines && (
                        <div className="border-t border-gray-200 pt-3">
                          <p className="text-xs text-gray-500 mb-2">✏️ 创作指南</p>
                          <div className="flex flex-wrap gap-2">
                            {channelDetails.style_profile.writing_guidelines.map((guide: string, index: number) => (
                              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {guide}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                
                {/* 基本信息 */}
                <Card className="border-gray-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <CardTitle className="text-lg mb-2">{channelDetails.channel_name}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {channelDetails.description}
                        </CardDescription>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEdit(channelDetails.channel_id)}
                      >
                        编辑
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <span className="text-xs text-gray-500 font-medium">目标读者</span>
                        <p className="mt-1.5 text-gray-900 leading-relaxed">{channelDetails.target_audience}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 font-medium">品牌人格</span>
                        <p className="mt-1.5 text-gray-900 leading-relaxed">{channelDetails.brand_personality}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* AI写作人格 */}
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">AI写作人格</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">角色定位</p>
                      <p className="text-gray-600 text-sm leading-relaxed">
                          {channelDetails.system_prompt?.role}
                      </p>
                    </div>
                    
                      {channelDetails.system_prompt?.writing_style && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">写作风格</p>
                        <ul className="space-y-1">
                          {channelDetails.system_prompt.writing_style.map((style: string, index: number) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start">
                                <span className="text-gray-400 mr-2">•</span>
                              <span>{style}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  </CardContent>
                </Card>
                
                {/* 频道规则 */}
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">频道规则</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">必须遵守</p>
                      <ul className="space-y-1">
                          {channelDetails.channel_specific_rules?.must_do?.map((rule: string, index: number) => (
                            <li key={index} className="text-xs text-gray-600">
                            • {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">严格禁止</p>
                      <ul className="space-y-1">
                          {channelDetails.channel_specific_rules?.must_not_do?.map((rule: string, index: number) => (
                            <li key={index} className="text-xs text-gray-600">
                            • {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  </CardContent>
                </Card>
                
                {/* 屏蔽词和素材标签 */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-gray-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">频道屏蔽词</CardTitle>
                    </CardHeader>
                    <CardContent>
                  <div className="flex flex-wrap gap-2">
                        {channelDetails.blocked_phrases?.map((phrase: string, index: number) => (
                          <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                        {phrase}
                          </Badge>
                    ))}
                  </div>
                    </CardContent>
                  </Card>
                
                  <Card className="border-gray-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">素材标签</CardTitle>
                    </CardHeader>
                    <CardContent>
                  <div className="flex flex-wrap gap-2">
                        {channelDetails.material_tags?.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                        {tag}
                          </Badge>
                    ))}
                  </div>
                    </CardContent>
                  </Card>
                </div>
                
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 编辑频道对话框 - 重构版 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">编辑频道</DialogTitle>
            <DialogDescription className="text-[#3a5e98]">
              修改频道配置信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            {/* ========== 1. 频道身份 ========== */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">1. 频道身份</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              
              {/* 频道名称 + 标识符 并排 */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <Label className="text-xs text-gray-500 font-normal">频道名称 *</Label>
                  <Input
                    value={editChannel.name}
                    onChange={(e) => setEditChannel({ ...editChannel, name: e.target.value })}
                    placeholder="如：深度阅读"
                    className="mt-1.5 border-gray-200 focus:border-[#3a5e98]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 font-normal">频道标识符</Label>
                  <Input
                    value={editChannel.slug}
                    disabled
                    className="mt-1.5 bg-gray-50 border-gray-200 text-gray-500"
                  />
                </div>
              </div>
              
              {/* 频道描述 */}
              <div className="mb-5">
                <Label className="text-xs text-gray-500 font-normal">频道描述</Label>
                <AutoResizeTextarea
                  minRows={2}
                  maxRows={4}
                  value={editChannel.description}
                  onChange={(e) => setEditChannel({ ...editChannel, description: e.target.value })}
                  placeholder="描述该频道的内容方向、定位、特色..."
                  className="mt-1.5"
                />
              </div>
              
              {/* 目标读者 + 品牌人格 并排 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 font-normal">目标读者</Label>
                  <AutoResizeTextarea
                    minRows={2}
                    maxRows={4}
                    value={editChannel.target_audience}
                    onChange={(e) => setEditChannel({ ...editChannel, target_audience: e.target.value })}
                    placeholder="如：7-12岁小学生家长，希望培养孩子深度阅读习惯"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 font-normal">品牌人格</Label>
                  <AutoResizeTextarea
                    minRows={2}
                    maxRows={4}
                    value={editChannel.brand_personality}
                    onChange={(e) => setEditChannel({ ...editChannel, brand_personality: e.target.value })}
                    placeholder="如：资深阅读推广人，温暖而专业"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
            
            {/* ========== 2. 创作策略 ========== */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">2. 创作策略</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              
              {/* AI 角色定位 */}
              <div className="mb-5">
                <Label className="text-xs text-gray-500 font-normal">AI 角色定位</Label>
                <AutoResizeTextarea
                  minRows={2}
                  maxRows={5}
                  value={editChannel.role}
                  onChange={(e) => setEditChannel({ ...editChannel, role: e.target.value })}
                  placeholder="如：你是'老约翰儿童阅读'的资深阅读推广专家，专注于小学段的深度阅读指导..."
                  className="mt-1.5"
                />
              </div>
              
              {/* 写作风格 */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500 font-normal">写作风格</Label>
                  <span className="text-[10px] text-gray-400">每行一条规则</span>
                </div>
                <AutoResizeTextarea
                  minRows={3}
                  maxRows={8}
                  value={editChannel.writing_style}
                  onChange={(e) => setEditChannel({ ...editChannel, writing_style: e.target.value })}
                  placeholder="语言专业但不晦涩，有文学厚度但不卖弄&#10;逻辑严密，论证充分，善于用具体案例说明观点&#10;拒绝低幼化表达，尊重小学生的认知能力"
                  className="mt-1.5 font-mono text-[13px] leading-relaxed"
                />
              </div>
            </div>
            
            {/* ========== 3. 规则围栏 ========== */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">3. 规则围栏</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              
              {/* 必须遵守 + 严格禁止 并排 */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500 font-normal">必须遵守</Label>
                    <span className="text-[10px] text-gray-400">每行一条</span>
                  </div>
                  <AutoResizeTextarea
                    minRows={3}
                    maxRows={6}
                    value={editChannel.must_do}
                    onChange={(e) => setEditChannel({ ...editChannel, must_do: e.target.value })}
                    placeholder="引用具体的书籍段落或情节&#10;提供可操作的阅读指导方法&#10;关注思维能力的培养而非知识灌输"
                    className="mt-1.5 font-mono text-[13px] leading-relaxed border-green-200 focus:border-green-400 focus:ring-green-100"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500 font-normal">严格禁止</Label>
                    <span className="text-[10px] text-gray-400">每行一条</span>
                  </div>
                  <AutoResizeTextarea
                    minRows={3}
                    maxRows={6}
                    value={editChannel.must_not_do}
                    onChange={(e) => setEditChannel({ ...editChannel, must_not_do: e.target.value })}
                    placeholder="简化为低幼化的语言&#10;将文学作品功利化&#10;使用过于学术的文学理论术语"
                    className="mt-1.5 font-mono text-[13px] leading-relaxed border-red-200 focus:border-red-400 focus:ring-red-100 bg-red-50/30"
                  />
                </div>
              </div>
              
              {/* 屏蔽词 + 素材标签 并排 - 使用 TagInput */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 font-normal">频道屏蔽词</Label>
                  <p className="text-[10px] text-gray-400 mt-0.5 mb-1.5">输入后按回车添加，支持逗号分隔批量粘贴</p>
                  <TagInput
                    value={editChannel.blocked_phrases}
                    onChange={(tags) => setEditChannel({ ...editChannel, blocked_phrases: tags })}
                    placeholder="输入屏蔽词..."
                    variant="gray"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 font-normal">素材标签</Label>
                  <p className="text-[10px] text-gray-400 mt-0.5 mb-1.5">用于关联素材库中的相关内容</p>
                  <TagInput
                    value={editChannel.material_tags}
                    onChange={(tags) => setEditChannel({ ...editChannel, material_tags: tags })}
                    placeholder="输入素材标签..."
                    variant="blue"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-200">
              取消
            </Button>
            <Button 
              className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
              onClick={handleUpdate} 
              disabled={editing}
            >
              {editing ? '保存中...' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 查看样文详情对话框 */}
      <Dialog open={!!viewingSample} onOpenChange={(open) => !open && setViewingSample(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewingSample && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewingSample.title}
                  {viewingSample.features && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      已分析
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {viewingSample.source && `来源: ${viewingSample.source}`}
                  {' · '}{viewingSample.content?.length || 0} 字
                </DialogDescription>
              </DialogHeader>
              
              {/* 6 维特征展示 */}
              {viewingSample.features && (
                <div className="mt-4 p-4 bg-gradient-to-br from-[#3a5e98]/5 to-white rounded-lg border border-[#3a5e98]/20">
                  <h4 className="text-sm font-semibold text-[#3a5e98] mb-3">
                    6 维特征分析
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 开头习惯 */}
                    {viewingSample.features.opening_style && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">开头习惯</span>
                          <Badge variant="secondary" className="text-xs bg-gray-100">
                            {viewingSample.features.opening_style.type === 'story_intro' ? '故事引入' :
                             viewingSample.features.opening_style.type === 'direct' ? '开门见山' :
                             viewingSample.features.opening_style.type === 'question' ? '设问开场' :
                             viewingSample.features.opening_style.type === 'scene' ? '场景描写' :
                             viewingSample.features.opening_style.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-700">{viewingSample.features.opening_style.description}</p>
                        {viewingSample.features.opening_style.example && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            "{viewingSample.features.opening_style.example.slice(0, 50)}..."
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* 句式特征 */}
                    {viewingSample.features.sentence_pattern && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">句式特征</p>
                        <p className="text-xs text-gray-700">{viewingSample.features.sentence_pattern.description}</p>
                        <div className="flex gap-2 mt-1">
                          {viewingSample.features.sentence_pattern.avg_length && (
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              均长 {viewingSample.features.sentence_pattern.avg_length} 字
                            </span>
                          )}
                          {viewingSample.features.sentence_pattern.favorite_punctuation?.map((p: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 段落节奏 */}
                    {viewingSample.features.paragraph_rhythm && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">段落节奏</span>
                          <Badge variant="secondary" className="text-xs bg-gray-100">
                            {viewingSample.features.paragraph_rhythm.variation === 'low' ? '变化较少' :
                             viewingSample.features.paragraph_rhythm.variation === 'medium' ? '变化适中' :
                             viewingSample.features.paragraph_rhythm.variation === 'high' ? '变化丰富' :
                             viewingSample.features.paragraph_rhythm.variation}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-700">{viewingSample.features.paragraph_rhythm.description}</p>
                      </div>
                    )}
                    
                    {/* 语气特点 */}
                    {viewingSample.features.tone && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">语气特点</span>
                          <Badge variant="secondary" className="text-xs bg-[#3a5e98]/10 text-[#3a5e98]">
                            {viewingSample.features.tone.type === 'warm_friend' ? '温润亲切' :
                             viewingSample.features.tone.type === 'professional' ? '专业权威' :
                             viewingSample.features.tone.type === 'literary' ? '文学气质' :
                             viewingSample.features.tone.type === 'conversational' ? '对话感' :
                             viewingSample.features.tone.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-700">{viewingSample.features.tone.description}</p>
                        {viewingSample.features.tone.formality !== undefined && (
                          <span className="text-xs text-gray-500">正式度: {viewingSample.features.tone.formality}</span>
                        )}
                      </div>
                    )}
                    
                    {/* 结尾风格 */}
                    {viewingSample.features.ending_style && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">结尾风格</span>
                          <Badge variant="secondary" className="text-xs bg-gray-100">
                            {viewingSample.features.ending_style.type === 'reflection' ? '引导思考' :
                             viewingSample.features.ending_style.type === 'question' ? '提问收尾' :
                             viewingSample.features.ending_style.type === 'emotional' ? '情感升华' :
                             viewingSample.features.ending_style.type === 'practical' ? '实用总结' :
                             viewingSample.features.ending_style.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-700">{viewingSample.features.ending_style.description}</p>
                      </div>
                    )}
                    
                    {/* 常用表达 */}
                    {viewingSample.features.expressions && (
                      <div className="bg-white p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">常用表达</p>
                        <div className="flex flex-wrap gap-1">
                          {viewingSample.features.expressions.high_freq_words?.map((word: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{word}</span>
                          ))}
                          {viewingSample.features.expressions.transition_phrases?.map((word: string, i: number) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{word}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* 原文内容 */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">原文内容</h4>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-[40vh] overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {viewingSample.content}
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingSample.content)
                    alert('已复制到剪贴板')
                  }}
                >
                  复制内容
                </Button>
                <Button 
                  className="bg-[#3a5e98] hover:bg-[#2d4a78]"
                  onClick={() => setViewingSample(null)}
                >
                  关闭
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
