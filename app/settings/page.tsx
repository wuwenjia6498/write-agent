'use client'

import { useState, useEffect } from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import BlockingWordsViewer from '@/components/BlockingWordsViewer'

import { API_BASE } from '@/lib/api-config'

interface BrandAsset {
  asset_key: string
  content: string
  content_type: string
  description: string | null
  last_updated: string
}

export default function SettingsPage() {
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<BrandAsset | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newAsset, setNewAsset] = useState({ key: '', content: '', description: '' })
  const [viewMode, setViewMode] = useState<'visual' | 'source'>('visual') // 可视化/源码视图切换

  useEffect(() => {
    fetchAssets()
  }, [])

  // 资产显示顺序配置
  const assetOrder = ['personal_intro', 'core_values', 'writing_principles', 'blocking_words']
  
  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_BASE}/brand-assets/`)
      if (res.ok) {
        const data = await res.json()
        // 按指定顺序排序
        const sortedData = [...data].sort((a, b) => {
          const indexA = assetOrder.indexOf(a.asset_key)
          const indexB = assetOrder.indexOf(b.asset_key)
          // 未在列表中的项放到最后
          const orderA = indexA === -1 ? 999 : indexA
          const orderB = indexB === -1 ? 999 : indexB
          return orderA - orderB
        })
        setAssets(sortedData)
        if (sortedData.length > 0 && !selectedAsset) {
          setSelectedAsset(sortedData[0])
          setEditContent(sortedData[0].content)
        }
      }
    } catch (error) {
      console.error('获取品牌资产失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAsset = (asset: BrandAsset) => {
    setSelectedAsset(asset)
    setEditContent(asset.content)
    // 屏蔽词库默认使用可视化视图，其他资产使用源码视图
    setViewMode(asset.asset_key === 'blocking_words' ? 'visual' : 'source')
  }

  const handleSave = async () => {
    if (!selectedAsset) return
    
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/brand-assets/${selectedAsset.asset_key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          content_type: selectedAsset.content_type,
          description: selectedAsset.description
        })
      })
      
      if (res.ok) {
        await fetchAssets()
        alert('保存成功')
      } else {
        throw new Error('保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!newAsset.key || !newAsset.content) {
      alert('请填写标识符和内容')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/brand-assets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_key: newAsset.key,
          content: newAsset.content,
          content_type: 'markdown',
          description: newAsset.description || null
        })
      })

      if (res.ok) {
        setIsCreateDialogOpen(false)
        setNewAsset({ key: '', content: '', description: '' })
        await fetchAssets()
      } else {
        throw new Error('创建失败')
      }
    } catch (error) {
      console.error('创建失败:', error)
      alert('创建失败，请重试')
    }
  }

  const handleDelete = async (assetKey: string) => {
    if (!confirm(`确定要删除 "${assetKey}" 吗？`)) return

    try {
      const res = await fetch(`${API_BASE}/brand-assets/${assetKey}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchAssets()
        setSelectedAsset(null)
        setEditContent('')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const getAssetLabel = (key: string) => {
    const labels: Record<string, string> = {
      'personal_intro': '个人简介',
      'core_values': '核心价值观',
      'writing_principles': '写作原则',
      'blocking_words': '屏蔽词库'
    }
    return labels[key] || key
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="品牌资产" subtitle="Brand Assets" />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="品牌资产" subtitle="Brand Assets" />

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：资产列表 */}
          <div className="col-span-4">
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">资产列表</CardTitle>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        新增
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>新增品牌资产</DialogTitle>
                        <DialogDescription>
                          创建新的品牌资产配置项
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>标识符</Label>
                          <Input
                            placeholder="例如: brand_story"
                            value={newAsset.key}
                            onChange={(e) => setNewAsset({ ...newAsset, key: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>描述</Label>
                          <Input
                            placeholder="资产用途说明"
                            value={newAsset.description}
                            onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>内容</Label>
                          <Textarea
                            placeholder="输入资产内容..."
                            rows={6}
                            value={newAsset.content}
                            onChange={(e) => setNewAsset({ ...newAsset, content: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          取消
                        </Button>
                        <Button className="bg-[#3a5e98] hover:bg-[#2d4a78]" onClick={handleCreate}>
                          创建
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>
                  共 {assets.length} 项
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {assets.map((asset) => (
                    <button
                      key={asset.asset_key}
                      onClick={() => handleSelectAsset(asset)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedAsset?.asset_key === asset.asset_key
                          ? 'bg-gray-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {getAssetLabel(asset.asset_key)}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {asset.description || asset.asset_key}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2 shrink-0">
                          {asset.content_type}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：编辑器 */}
          <div className="col-span-8">
            {selectedAsset ? (
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{getAssetLabel(selectedAsset.asset_key)}</CardTitle>
                      <CardDescription>
                        {selectedAsset.description || selectedAsset.asset_key}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(selectedAsset.asset_key)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        删除
                      </Button>
                      <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        size="sm"
                        className="bg-[#3a5e98] hover:bg-[#2d4a78]"
                      >
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  {/* 屏蔽词库的可视化视图 */}
                  {selectedAsset.asset_key === 'blocking_words' && viewMode === 'visual' ? (
                    <BlockingWordsViewer 
                      content={selectedAsset.content} 
                      onSwitchToEdit={() => setViewMode('source')}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-3">
                          <span>支持 Markdown 格式</span>
                          {selectedAsset.asset_key === 'blocking_words' && (
                            <button
                              onClick={() => setViewMode('visual')}
                              className="text-[#3a5e98] hover:underline"
                            >
                              切换到可视化视图
                            </button>
                          )}
                        </div>
                        <span>更新于 {new Date(selectedAsset.last_updated).toLocaleString()}</span>
                      </div>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={24}
                        className="font-mono text-sm resize-none"
                        placeholder="在此编辑内容..."
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-200 h-full flex items-center justify-center">
                <div className="text-center text-gray-500 py-20">
                  <p>请从左侧选择一个资产进行编辑</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
