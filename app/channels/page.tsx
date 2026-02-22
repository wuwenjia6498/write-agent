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

import { API_BASE } from '@/lib/api-config'

interface Channel {
  channel_id: string
  channel_name: string
  description: string
  target_audience: string
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
    role: '',
    writing_style: '',
    must_do: '',           // 必须遵守（每行一条）
    must_not_do: '',       // 严格禁止（每行一条）
    blocked_phrases: [] as string[],  // 屏蔽词（数组）
  })
  const [creating, setCreating] = useState(false)
  
  // 编辑频道对话框
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editChannel, setEditChannel] = useState({
    slug: '',
    name: '',
    description: '',
    target_audience: '',
    role: '',
    writing_style: '',
    must_do: '',
    must_not_do: '',
    blocked_phrases: [] as string[],
  })
  const [editing, setEditing] = useState(false)
  
  // 样文管理（v4.5 极简版）
  const [styleSamples, setStyleSamples] = useState<any[]>([])
  const [isAddSampleDialogOpen, setIsAddSampleDialogOpen] = useState(false)
  const [newSample, setNewSample] = useState({ title: '', content: '', source: '' })
  const [addingSample, setAddingSample] = useState(false)
  const [viewingSample, setViewingSample] = useState<any>(null)
  
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
          brand_personality: '',
          system_prompt: systemPrompt,
          channel_rules: channelRules,
          blocked_phrases: newChannel.blocked_phrases,
          material_tags: []
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewChannel({ 
          name: '', slug: '', description: '', target_audience: '',
          role: '', writing_style: '', must_do: '', must_not_do: '', blocked_phrases: []
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
      role: systemPrompt.role || '',
      writing_style: Array.isArray(systemPrompt.writing_style) 
        ? systemPrompt.writing_style.join('\n') 
        : '',
      must_do: Array.isArray(rules.must_do) ? rules.must_do.join('\n') : '',
      must_not_do: Array.isArray(rules.must_not_do) ? rules.must_not_do.join('\n') : '',
      blocked_phrases: Array.isArray(channelDetails.blocked_phrases) 
        ? channelDetails.blocked_phrases 
        : [],
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
      
      const res = await fetch(`${API_BASE}/channels/${editChannel.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editChannel.name,
          description: editChannel.description,
          target_audience: editChannel.target_audience,
          brand_personality: '',
          system_prompt: systemPrompt,
          channel_rules: channelRules,
          blocked_phrases: editChannel.blocked_phrases,
          material_tags: []
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
        await loadStyleSamples(channelId)
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
  
  // 添加样文（v4.5 极简版：标题+内容+来源）
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
        })
      })
      
      if (response.ok) {
        setIsAddSampleDialogOpen(false)
        setNewSample({ title: '', content: '', source: '' })
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
                          
                        </div>
                        
                        {/* ========== 2. AI 写作人格 ========== */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-semibold text-gray-700">2. AI 写作人格</span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                          
                          {/* 目标读者 */}
                          <div className="mb-5">
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
                          
                          {/* 频道屏蔽词 */}
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
                          创作时将随机抽取 1-2 篇作为排版与语气参考（最多 5 篇）
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
                              添加一篇代表该频道风格的参考文章
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
                              {addingSample ? '保存中...' : '保存样文'}
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
                      <div className="space-y-3">
                        {styleSamples.map((sample, index) => (
                          <div 
                            key={sample.id} 
                            className="p-4 bg-white rounded-xl border border-gray-200 hover:border-[#3a5e98]/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => setViewingSample(sample)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-6 h-6 bg-[#3a5e98] text-white rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                                    {index + 1}
                                  </span>
                                  <h4 className="font-medium text-gray-900 truncate">{sample.title}</h4>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-400 ml-8">
                                  <span>{sample.word_count || sample.content?.length || 0} 字</span>
                                  {sample.source && <span>来源: {sample.source}</span>}
                                </div>
                                <p className="text-xs text-gray-500 mt-2 ml-8 line-clamp-2 leading-relaxed">
                                  {sample.content?.slice(0, 120)}...
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSample(sample.id)
                                }}
                                className="text-gray-400 hover:text-red-600 h-8 px-2 shrink-0"
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
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
                  
                </Card>
                
                {/* AI写作人格 */}
                <Card className="border-gray-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">AI写作人格</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                    {channelDetails.target_audience && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">目标读者</p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {channelDetails.target_audience}
                        </p>
                      </div>
                    )}
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
                
                {/* 频道屏蔽词 */}
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
              
            </div>
            
            {/* ========== 2. AI 写作人格 ========== */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">2. AI 写作人格</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              
              {/* 目标读者 */}
              <div className="mb-5">
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
              
              {/* 频道屏蔽词 */}
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
                <DialogTitle>{viewingSample.title}</DialogTitle>
                <DialogDescription>
                  {viewingSample.source && `来源: ${viewingSample.source}`}
                  {' · '}{viewingSample.content?.length || 0} 字
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-[50vh] overflow-y-auto">
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
