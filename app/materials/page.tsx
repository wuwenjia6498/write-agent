'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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

import { API_BASE } from '@/lib/api-config'

// 素材类型定义（带描述）
const MATERIAL_TYPE_CONFIG: Record<string, string> = {
  '专业资料': '上传PDF/Word文档，如：教育理论文献、课程标准、绘本解读手册、研报数据等',
  '实操案例': '记录具体的教学过程、亲子沟通现场、绘本讲读示范等',
  '心得复盘': '项目结束后的总结、对某个教育现象的个人深度思考、教学反思日记',
  '学员反馈': '家长的咨询记录、孩子的阅读变化、课程评价截图',
  '其他': '无法归类的临时性素材'
}
const MATERIAL_TYPES = Object.keys(MATERIAL_TYPE_CONFIG)

interface Material {
  id: string
  content: string
  material_type: string
  channel_id: string | null
  channel_slug: string | null
  tags: string[]
  source: string | null
  created_at: string | null
  import_source?: string | null
  original_filename?: string | null
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
    material_type: '实操案例',  // 默认选择实操案例
    channel_slug: '_global_'   // 使用特殊值表示全局通用
  })
  const [creating, setCreating] = useState(false)
  
  // 文件上传相关状态
  const [uploadTab, setUploadTab] = useState<'manual' | 'file'>('manual')
  const [dragActive, setDragActive] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 查看详情相关状态
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  // 初始化：只加载频道列表
  useEffect(() => {
    fetchChannels()
  }, [])
  
  // 素材加载：依赖筛选条件变化（包括初始加载）
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
          tags: [],
          source: null,
          import_source: 'manual'
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        resetForm()
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

  // 重置表单
  const resetForm = () => {
    setNewMaterial({ 
      content: '', 
      material_type: '实操案例', 
      channel_slug: '_global_'
    })
    setUploadFile(null)
    setUploadTab('manual')
  }

  // 处理文件上传
  const handleFileUpload = async () => {
    if (!uploadFile) {
      alert('请选择文件')
      return
    }

    setCreating(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('material_type', newMaterial.material_type)
      formData.append('channel_slug', newMaterial.channel_slug === '_global_' ? '' : newMaterial.channel_slug)
      formData.append('tags', '')
      formData.append('style_tags', '')
      formData.append('quality_weight', '3')

      const res = await fetch(`${API_BASE}/materials/upload`, {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        resetForm()
        await fetchMaterials()
      } else {
        const error = await res.json()
        throw new Error(error.detail || '上传失败')
      }
    } catch (error: any) {
      console.error('上传失败:', error)
      alert(error.message || '上传失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  // 拖拽处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext === 'md' || ext === 'docx') {
        setUploadFile(file)
      } else {
        alert('仅支持 .md 和 .docx 文件')
      }
    }
  }, [])

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
              
              <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                setIsCreateDialogOpen(open)
                if (!open) resetForm()
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-[#3a5e98] hover:bg-[#2d4a78]">添加素材</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>添加新素材</DialogTitle>
                    <DialogDescription>
                      采集真实经历素材（专业资料、实操案例、心得复盘等），让 AI 创作更有"人味"
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as any)} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">手动输入</TabsTrigger>
                      <TabsTrigger value="file">文件上传</TabsTrigger>
                    </TabsList>
                    
                    {/* 手动输入 Tab */}
                    <TabsContent value="manual" className="space-y-4 mt-4">
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
                      
                      {/* 素材类型说明 */}
                      <p className="text-xs text-gray-500 -mt-2">
                        {MATERIAL_TYPE_CONFIG[newMaterial.material_type]}
                      </p>
                      
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          取消
                        </Button>
                        <Button className="bg-[#3a5e98] hover:bg-[#2d4a78]" onClick={handleCreate} disabled={creating}>
                          {creating ? '添加中...' : '添加'}
                        </Button>
                      </div>
                    </TabsContent>
                    
                    {/* 文件上传 Tab */}
                    <TabsContent value="file" className="space-y-4 mt-4">
                      {/* 拖拽上传区域 */}
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                          dragActive 
                            ? 'border-[#3a5e98] bg-blue-50' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".md,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setUploadFile(file)
                          }}
                          className="hidden"
                        />
                        <div className="text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm">拖拽文件到这里，或点击选择</p>
                          <p className="text-xs text-gray-400 mt-1">支持 .md 和 .docx 格式</p>
                        </div>
                      </div>
                      
                      {uploadFile && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#3a5e98]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-gray-700">{uploadFile.name}</span>
                            <span className="text-xs text-gray-400">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setUploadFile(null)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            移除
                          </Button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>素材类型</Label>
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
                      
                      {/* 素材类型说明 */}
                      <p className="text-xs text-gray-500 -mt-2">
                        {MATERIAL_TYPE_CONFIG[newMaterial.material_type]}
                      </p>
                      
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          取消
                        </Button>
                        <Button 
                          className="bg-[#3a5e98] hover:bg-[#2d4a78]" 
                          onClick={handleFileUpload} 
                          disabled={creating || !uploadFile}
                        >
                          {creating ? '上传中...' : '上传'}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
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
              <Card 
                key={material.id} 
                className="border-gray-200 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                  setSelectedMaterial(material)
                  setIsDetailDialogOpen(true)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className="bg-gray-100 text-gray-700 border border-gray-200"
                      >
                        {material.material_type}
                      </Badge>
                    </div>
                    {material.channel_slug && (
                      <span className="text-xs text-gray-500">
                        {channels.find(c => c.slug === material.channel_slug)?.name || material.channel_slug}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3 line-clamp-4">
                    {material.content}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {/* 显示导入来源图标 */}
                      {material.import_source === 'file' && (
                        <span title="文件导入">📄 文件上传</span>
                      )}
                      {material.import_source === 'url' && (
                        <span title="链接导入">🔗 链接导入</span>
                      )}
                      {material.import_source === 'manual' && (
                        <span title="手动输入">✏️ 手动输入</span>
                      )}
                      {!material.import_source && <span>—</span>}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()  // 阻止冒泡，避免触发卡片点击
                        handleDelete(material.id)
                      }}
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

      {/* 素材详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMaterial && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Badge 
                    variant="secondary" 
                    className="bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {selectedMaterial.material_type}
                  </Badge>
                  {selectedMaterial.channel_slug && (
                    <span className="text-sm text-gray-500 font-normal">
                      频道: {channels.find(c => c.slug === selectedMaterial.channel_slug)?.name || selectedMaterial.channel_slug}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-left mt-2">
                  {selectedMaterial.original_filename && (
                    <span className="text-xs text-gray-400">
                      原文件: {selectedMaterial.original_filename}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4 space-y-4">
                {/* 完整内容 */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedMaterial.content}
                  </p>
                </div>
                
                {/* 元信息 */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 text-sm">
                  <div>
                    <Label className="text-gray-500 text-xs">导入方式</Label>
                    <p className="text-gray-700 mt-1">
                      {selectedMaterial.import_source === 'file' && '📄 文件上传'}
                      {selectedMaterial.import_source === 'url' && '🔗 链接导入'}
                      {selectedMaterial.import_source === 'manual' && '✏️ 手动输入'}
                      {!selectedMaterial.import_source && '—'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">创建时间</Label>
                    <p className="text-gray-700 mt-1">
                      {selectedMaterial.created_at 
                        ? new Date(selectedMaterial.created_at).toLocaleString('zh-CN')
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">内容字数</Label>
                    <p className="text-gray-700 mt-1">{selectedMaterial.content.length} 字</p>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMaterial.content)
                    alert('已复制到剪贴板')
                  }}
                >
                  复制内容
                </Button>
                <Button 
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    handleDelete(selectedMaterial.id)
                    setIsDetailDialogOpen(false)
                  }}
                >
                  删除
                </Button>
                <Button 
                  className="bg-[#3a5e98] hover:bg-[#2d4a78]"
                  onClick={() => setIsDetailDialogOpen(false)}
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
