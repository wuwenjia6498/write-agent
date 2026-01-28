'use client'

import { useState, useEffect } from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const API_BASE = 'http://localhost:8000/api'

const MATERIAL_TYPES = ['金句', '案例', '反馈', '感悟', '其他']

interface Material {
  id: string
  content: string
  material_type: string
  channel_id: string | null
  channel_slug: string | null
  tags: string[]
  source: string | null
  created_at: string | null
}

interface Channel {
  slug: string
  name: string
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newMaterial, setNewMaterial] = useState({
    content: '',
    material_type: '感悟',
    channel_slug: '_global_',  // 使用特殊值表示全局通用
    tags: '',
    source: ''
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchChannels()
    fetchMaterials()
  }, [])

  useEffect(() => {
    fetchMaterials()
  }, [filterChannel, filterType, searchKeyword])

  const fetchChannels = async () => {
    try {
      const res = await fetch(`${API_BASE}/channels/`)
      if (res.ok) {
        const data = await res.json()
        setChannels(data.map((c: any) => ({ slug: c.channel_id || c.slug, name: c.channel_name || c.name })))
      }
    } catch (error) {
      console.error('获取频道失败:', error)
    }
  }

  const fetchMaterials = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterChannel && filterChannel !== 'all') params.append('channel', filterChannel)
      if (filterType && filterType !== 'all') params.append('type', filterType)
      if (searchKeyword) params.append('search', searchKeyword)
      
      const res = await fetch(`${API_BASE}/materials/?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMaterials(data)
      }
    } catch (error) {
      console.error('获取素材失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newMaterial.content.trim()) {
      alert('请输入素材内容')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/materials/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMaterial.content,
          material_type: newMaterial.material_type,
          channel_slug: newMaterial.channel_slug === '_global_' ? null : newMaterial.channel_slug,
          tags: newMaterial.tags ? newMaterial.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          source: newMaterial.source || null
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewMaterial({ content: '', material_type: '感悟', channel_slug: '_global_', tags: '', source: '' })
        await fetchMaterials()
      } else {
        throw new Error('创建失败')
      }
    } catch (error) {
      console.error('创建失败:', error)
      alert('创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (materialId: string) => {
    if (!confirm('确定要删除这条素材吗？')) return

    try {
      const res = await fetch(`${API_BASE}/materials/${materialId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchMaterials()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="素材管理" subtitle="Materials" />

      <div className="max-w-7xl mx-auto p-6">
        {/* 筛选栏 */}
        <Card className="border-gray-200 mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="搜索素材内容..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </div>
              
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="选择频道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部频道</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch.slug} value={ch.slug}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="素材类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {MATERIAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#3a5e98] hover:bg-[#2d4a78]">添加素材</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>添加新素材</DialogTitle>
                    <DialogDescription>
                      添加真实经历素材，让 AI 创作更有"人味"
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>素材内容 *</Label>
                      <Textarea
                        placeholder="例如：那天在课堂上，一个三年级的孩子读完《夏洛的网》后说..."
                        rows={5}
                        value={newMaterial.content}
                        onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>素材类型 *</Label>
                        <Select 
                          value={newMaterial.material_type} 
                          onValueChange={(v) => setNewMaterial({ ...newMaterial, material_type: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MATERIAL_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>归属频道</Label>
                        <Select 
                          value={newMaterial.channel_slug} 
                          onValueChange={(v) => setNewMaterial({ ...newMaterial, channel_slug: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="全局通用" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_global_">全局通用</SelectItem>
                            {channels.map((ch) => (
                              <SelectItem key={ch.slug} value={ch.slug}>{ch.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>标签（逗号分隔）</Label>
                        <Input
                          placeholder="阅读, 教育, 案例"
                          value={newMaterial.tags}
                          onChange={(e) => setNewMaterial({ ...newMaterial, tags: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>来源</Label>
                        <Input
                          placeholder="例如：2024年春季阅读课"
                          value={newMaterial.source}
                          onChange={(e) => setNewMaterial({ ...newMaterial, source: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button className="bg-[#3a5e98] hover:bg-[#2d4a78]" onClick={handleCreate} disabled={creating}>
                      {creating ? '添加中...' : '添加'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* 素材列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-20 text-gray-500">
              加载中...
            </div>
          ) : materials.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-500">
              暂无素材
            </div>
          ) : (
            materials.map((material) => (
              <Card key={material.id} className="border-gray-200 hover:border-gray-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 border border-gray-200">
                      {material.material_type}
                    </Badge>
                    {material.channel_slug && (
                      <span className="text-xs text-gray-500">
                        {channels.find(c => c.slug === material.channel_slug)?.name || material.channel_slug}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3 line-clamp-4">
                    {material.content}
                  </p>
                  
                  {material.tags && material.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {material.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-xs text-gray-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span>{material.source || '—'}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(material.id)}
                      className="text-gray-400 hover:text-red-600 h-6 px-2"
                    >
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          共 {materials.length} 条素材
        </div>
      </div>
    </div>
  )
}
