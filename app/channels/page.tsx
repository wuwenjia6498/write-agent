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
    must_do: '',        // 必须遵守（每行一条）
    must_not_do: '',    // 严格禁止（每行一条）
    blocked_phrases: '', // 屏蔽词（逗号分隔）
    material_tags: ''   // 素材标签（逗号分隔）
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
    blocked_phrases: '',
    material_tags: ''
  })
  const [editing, setEditing] = useState(false)
  
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
      
      // 解析屏蔽词和素材标签（存入独立字段）
      const blockedPhrases = newChannel.blocked_phrases
        ? newChannel.blocked_phrases.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : []
      const materialTags = newChannel.material_tags
        ? newChannel.material_tags.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : []

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
          blocked_phrases: blockedPhrases,
          material_tags: materialTags
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewChannel({ 
          name: '', slug: '', description: '', target_audience: '', brand_personality: '',
          role: '', writing_style: '', must_do: '', must_not_do: '', blocked_phrases: '', material_tags: ''
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
      blocked_phrases: Array.isArray(channelDetails.blocked_phrases) 
        ? channelDetails.blocked_phrases.join('，') 
        : '',
      material_tags: Array.isArray(channelDetails.material_tags) 
        ? channelDetails.material_tags.join('，') 
        : ''
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
      
      const blockedPhrases = editChannel.blocked_phrases
        ? editChannel.blocked_phrases.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : []
      const materialTags = editChannel.material_tags
        ? editChannel.material_tags.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        : []

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
          blocked_phrases: blockedPhrases,
          material_tags: materialTags
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
      }
    } catch (error) {
      console.error('获取频道详情失败:', error)
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
                        <DialogTitle>新增频道</DialogTitle>
                        <DialogDescription>
                          创建一个新的内容频道，设置独立的写作风格
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>频道名称 *</Label>
                            <Input
                              placeholder="如：深度阅读"
                              value={newChannel.name}
                              onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>频道标识符 *</Label>
                            <Input
                              placeholder="如：deep_reading"
                              value={newChannel.slug}
                              onChange={(e) => setNewChannel({ ...newChannel, slug: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>频道描述</Label>
                          <Textarea
                            placeholder="描述该频道的内容方向..."
                            rows={2}
                            value={newChannel.description}
                            onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>目标读者</Label>
                            <Textarea
                              placeholder="如：7-12岁小学生家长，希望培养孩子深度阅读习惯"
                              rows={2}
                              value={newChannel.target_audience}
                              onChange={(e) => setNewChannel({ ...newChannel, target_audience: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>品牌人格</Label>
                            <Textarea
                              placeholder="如：资深阅读推广人，温暖而专业"
                              rows={2}
                              value={newChannel.brand_personality}
                              onChange={(e) => setNewChannel({ ...newChannel, brand_personality: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>AI 角色定位</Label>
                          <Textarea
                            placeholder="如：你是一位资深阅读推广人..."
                            rows={2}
                            value={newChannel.role}
                            onChange={(e) => setNewChannel({ ...newChannel, role: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>写作风格（每行一条）</Label>
                          <Textarea
                            placeholder="使用温暖亲切的语气&#10;注重真实案例分享&#10;避免说教式表达"
                            rows={3}
                            value={newChannel.writing_style}
                            onChange={(e) => setNewChannel({ ...newChannel, writing_style: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        
                        {/* 频道规则 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>必须遵守（每行一条）</Label>
                            <Textarea
                              placeholder="引用具体的书籍段落或情节&#10;提供可操作的阅读指导方法"
                              rows={3}
                              value={newChannel.must_do}
                              onChange={(e) => setNewChannel({ ...newChannel, must_do: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>严格禁止（每行一条）</Label>
                            <Textarea
                              placeholder="简化为低幼化的语言&#10;使用过于学术的文学理论术语"
                              rows={3}
                              value={newChannel.must_not_do}
                              onChange={(e) => setNewChannel({ ...newChannel, must_not_do: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        {/* 屏蔽词和素材标签 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>频道屏蔽词（逗号分隔）</Label>
                            <Textarea
                              placeholder="快来看看吧，赶紧收藏，不看后悔，必读书单"
                              rows={2}
                              value={newChannel.blocked_phrases}
                              onChange={(e) => setNewChannel({ ...newChannel, blocked_phrases: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>素材标签（逗号分隔）</Label>
                            <Textarea
                              placeholder="#整本书阅读，#思考力，#文学审美"
                              rows={2}
                              value={newChannel.material_tags}
                              onChange={(e) => setNewChannel({ ...newChannel, material_tags: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          取消
                        </Button>
                        <Button 
                          className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
                          onClick={handleCreate} 
                          disabled={creating}
                        >
                          {creating ? '创建中...' : '创建'}
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
                {/* 基本信息 */}
                <Card className="border-gray-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{channelDetails.channel_name}</CardTitle>
                        <CardDescription>{channelDetails.description}</CardDescription>
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
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">目标读者</span>
                        <p className="mt-1 text-gray-900">{channelDetails.target_audience}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">品牌人格</span>
                        <p className="mt-1 text-gray-900">{channelDetails.brand_personality}</p>
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

      {/* 编辑频道对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑频道</DialogTitle>
            <DialogDescription>
              修改频道配置信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>频道名称 *</Label>
                <Input
                  value={editChannel.name}
                  onChange={(e) => setEditChannel({ ...editChannel, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>频道标识符</Label>
                <Input
                  value={editChannel.slug}
                  disabled
                  className="mt-1 bg-gray-100"
                />
              </div>
            </div>
            <div>
              <Label>频道描述</Label>
              <Textarea
                rows={2}
                value={editChannel.description}
                onChange={(e) => setEditChannel({ ...editChannel, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>目标读者</Label>
                <Textarea
                  rows={2}
                  value={editChannel.target_audience}
                  onChange={(e) => setEditChannel({ ...editChannel, target_audience: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>品牌人格</Label>
                <Textarea
                  rows={2}
                  value={editChannel.brand_personality}
                  onChange={(e) => setEditChannel({ ...editChannel, brand_personality: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>AI 角色定位</Label>
              <Textarea
                rows={2}
                value={editChannel.role}
                onChange={(e) => setEditChannel({ ...editChannel, role: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>写作风格（每行一条）</Label>
              <Textarea
                rows={3}
                value={editChannel.writing_style}
                onChange={(e) => setEditChannel({ ...editChannel, writing_style: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>必须遵守（每行一条）</Label>
                <Textarea
                  rows={3}
                  value={editChannel.must_do}
                  onChange={(e) => setEditChannel({ ...editChannel, must_do: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>严格禁止（每行一条）</Label>
                <Textarea
                  rows={3}
                  value={editChannel.must_not_do}
                  onChange={(e) => setEditChannel({ ...editChannel, must_not_do: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>频道屏蔽词（逗号分隔）</Label>
                <Textarea
                  rows={2}
                  value={editChannel.blocked_phrases}
                  onChange={(e) => setEditChannel({ ...editChannel, blocked_phrases: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>素材标签（逗号分隔）</Label>
                <Textarea
                  rows={2}
                  value={editChannel.material_tags}
                  onChange={(e) => setEditChannel({ ...editChannel, material_tags: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button 
              className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
              onClick={handleUpdate} 
              disabled={editing}
            >
              {editing ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
