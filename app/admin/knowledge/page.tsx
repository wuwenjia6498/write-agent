'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import AppHeader from '@/components/AppHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { API_BASE } from '@/lib/api-config'

// ---- 常量 ----

const CHANNEL_OPTIONS = [
  { value: 'deep_reading', label: '小学生深度阅读' },
  { value: 'picture_books', label: '幼儿绘本阅读' },
  { value: 'parenting', label: '育儿频道' },
]

// 频道 → 资料类型的级联映射（Key 为数据库存储的英文值，Value 为前端显示的中文标签）
const MATERIAL_TYPE_MAP: Record<string, { value: string; label: string }[]> = {
  deep_reading: [
    { value: 'lesson_plan', label: '阅读指导卡片' },
    { value: 'article', label: '公号文' },
    { value: 'course_info', label: '课程说明资料' },
    { value: 'theory_book', label: '理论书籍' },
    { value: 'anecdote', label: '真实案例/微素材' },
  ],
  picture_books: [
    { value: 'booklist', label: '主题书单' },
    { value: 'qa', label: '专家问答' },
    { value: 'guide_book', label: '指导与理论书籍' },
    { value: 'anecdote', label: '真实案例/微素材' },
  ],
  parenting: [
    { value: 'article', label: '公号文' },
    { value: 'parenting_book', label: '育儿类书籍' },
    { value: 'anecdote', label: '真实案例/微素材' },
  ],
}

// 所有资料类型的平铺映射，用于列表展示时的中文翻译
const ALL_MATERIAL_TYPE_LABELS: Record<string, string> = Object.values(MATERIAL_TYPE_MAP)
  .flat()
  .reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {} as Record<string, string>)

const ACCEPT_EXTENSIONS = '.docx,.pdf,.md'

// ---- 类型定义 ----

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'
type TabKey = 'upload' | 'list'

interface UploadResult {
  success: boolean
  message: string
  chunks_count: number
  source_filename: string
}

interface FileUploadDetail {
  filename: string
  success: boolean
  chunks_count?: number
  error?: string
}

interface BatchUploadResult {
  total: number
  successCount: number
  failCount: number
  totalChunks: number
  details: FileUploadDetail[]
}

interface KnowledgeFile {
  source_filename: string
  channel_scope: string
  material_type: string
  chunk_count: number
  created_at: string | null
}

interface ChunkItem {
  id: number
  content: string
  created_at: string | null
}

// ---- 工具函数 ----

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---- 拖拽上传区组件 ----

function DropZone({
  files,
  onFilesChange,
  disabled,
}: {
  files: File[]
  onFilesChange: (f: File[]) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // 过滤合法扩展名并去重（按文件名 + 大小判断）
  const mergeFiles = useCallback(
    (incoming: File[]) => {
      const validExts = ACCEPT_EXTENSIONS.split(',')
      const filtered = incoming.filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        return validExts.includes(ext)
      })
      const existing = new Set(files.map((f) => `${f.name}__${f.size}`))
      const deduped = filtered.filter((f) => !existing.has(`${f.name}__${f.size}`))
      if (deduped.length > 0) onFilesChange([...files, ...deduped])
    },
    [files, onFilesChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length > 0) mergeFiles(dropped)
    },
    [disabled, mergeFiles],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length > 0) mergeFiles(selected)
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {/* 拖拽 / 点击区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
          px-6 py-8 transition-all duration-200 cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${dragOver ? 'border-[#3a5e98] bg-[#3a5e98]/5' : 'border-gray-300 hover:border-[#3a5e98]/50 hover:bg-gray-50'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXTENSIONS}
          multiple
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm font-medium">
            {files.length > 0 ? '继续添加文件' : '拖拽文件到此处，或点击选择'}
          </p>
          <p className="text-xs">支持 .docx、.pdf、.md 格式，可一次选择多个文件</p>
        </div>
      </div>

      {/* 已选文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              已选择 {files.length} 个文件
            </span>
            {!disabled && files.length > 1 && (
              <button
                type="button"
                onClick={() => onFilesChange([])}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                清空全部
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
            {files.map((f, i) => {
              const ext = f.name.split('.').pop()?.toUpperCase()
              return (
                <div
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 group hover:border-gray-300 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#3a5e98]/8 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5e98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate" title={f.name}>{f.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ext}</Badge>
                      <span className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md
                                 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors
                                 opacity-0 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Toast 提示组件 ----

function BatchToast({
  status,
  batchResult,
  onClose,
}: {
  status: UploadStatus
  batchResult: BatchUploadResult | null
  onClose: () => void
}) {
  if (status === 'idle' || status === 'uploading' || !batchResult) return null

  const allSuccess = batchResult.failCount === 0
  const allFail = batchResult.successCount === 0
  const borderColor = allFail ? 'border-red-200' : 'border-emerald-200'
  const bgColor = allFail ? 'bg-red-50' : 'bg-emerald-50'

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden`}>
      {/* 汇总信息 */}
      <div className="flex items-start gap-3 px-5 py-4">
        {allFail ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${allFail ? 'text-red-800' : 'text-emerald-800'}`}>
            {allSuccess
              ? `全部上传成功（${batchResult.total} 个文件）`
              : allFail
                ? `全部上传失败（${batchResult.total} 个文件）`
                : `部分上传成功（${batchResult.successCount} 成功 / ${batchResult.failCount} 失败）`}
          </p>
          {batchResult.successCount > 0 && (
            <p className="text-xs mt-0.5 text-emerald-600">
              共生成 {batchResult.totalChunks} 个知识切片
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 逐文件明细（超过 1 个文件时展示） */}
      {batchResult.total > 1 && (
        <div className="border-t border-gray-200/60 px-5 py-3 space-y-1.5 bg-white/50">
          {batchResult.details.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {d.success ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              <span className={`truncate ${d.success ? 'text-gray-700' : 'text-red-700'}`}>
                {d.filename}
              </span>
              <span className="text-gray-400 shrink-0 ml-auto">
                {d.success ? `${d.chunks_count} 个切片` : d.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- 删除二次确认弹窗组件 ----

function ConfirmDialog({
  filename,
  onConfirm,
  onCancel,
}: {
  filename: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />

      {/* 弹窗主体 */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* 警告图标 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">确认删除</p>
            <p className="text-xs text-gray-500 mt-0.5">此操作不可撤销</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 mb-1">
          即将删除文件 <span className="font-medium text-gray-900">"{filename}"</span> 的所有知识切片。
        </p>
        <p className="text-xs text-gray-400 mb-6">删除后该文件的向量数据将从知识库中永久移除。</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- 切片详情侧边抽屉组件 ----

function ChunksDrawer({
  filename,
  onClose,
}: {
  filename: string
  onClose: () => void
}) {
  const [chunks, setChunks] = useState<ChunkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchChunks = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `${API_BASE}/admin/knowledge/chunks?source_filename=${encodeURIComponent(filename)}`,
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: '请求失败' }))
          throw new Error(err.detail || `HTTP ${res.status}`)
        }
        const data: ChunkItem[] = await res.json()
        setChunks(data)
      } catch (err: any) {
        setError(err.message || '获取切片数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchChunks()
  }, [filename])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {/* 头部 */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 shrink-0">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-gray-400 mb-0.5">切片详情</p>
            <h2 className="text-sm font-semibold text-gray-900 truncate" title={filename}>
              {filename}
            </h2>
            {!loading && !error && (
              <p className="text-xs text-gray-400 mt-0.5">共 {chunks.length} 个切片</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">加载切片数据...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {!loading && !error && chunks.map((chunk, i) => (
            <div key={chunk.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* 切片编号栏 */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-[#3a5e98]">切片 {i + 1}</span>
                <span className="text-xs text-gray-400">{chunk.content.length} 字</span>
              </div>
              {/* 切片文本：按换行分割为段落，避免 whitespace-pre-wrap 产生过大空白 */}
              <div className="px-4 py-3 space-y-1.5">
                {chunk.content
                  .split(/\n+/)
                  .filter((p) => p.trim() !== '')
                  .map((para, pi) => (
                    <p key={pi} className="text-sm text-gray-700 leading-relaxed break-words">
                      {para.trim()}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* 底部关闭按钮 */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-700
                       bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- 主页面 ----

export default function AdminKnowledgePage() {
  // ---- Tab 状态 ----
  const [activeTab, setActiveTab] = useState<TabKey>('upload')

  // ---- 上传表单状态 ----
  const [channelScope, setChannelScope] = useState(CHANNEL_OPTIONS[0].value)
  const [materialType, setMaterialType] = useState(
    MATERIAL_TYPE_MAP[CHANNEL_OPTIONS[0].value][0].value,
  )
  // 上传模式：文件上传 or 手动录入
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file')
  // 文件上传（支持多文件）
  const [files, setFiles] = useState<File[]>([])
  // 手动录入
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [batchResult, setBatchResult] = useState<BatchUploadResult | null>(null)
  // 上传进度追踪（当前处理到第几个文件）
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

  // ---- 列表状态 ----
  const [fileList, setFileList] = useState<KnowledgeFile[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [listFilterChannel, setListFilterChannel] = useState('')
  const [listFilterType, setListFilterType] = useState('')

  // ---- 删除确认弹窗状态 ----
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ---- 切片详情抽屉状态 ----
  const [chunksTarget, setChunksTarget] = useState<string | null>(null)

  const isUploading = uploadStatus === 'uploading'

  // 当前频道对应的资料类型选项
  const currentMaterialTypes = MATERIAL_TYPE_MAP[channelScope] ?? []

  // 切换频道时同步重置资料类型
  const handleChannelChange = (value: string) => {
    setChannelScope(value)
    const firstType = MATERIAL_TYPE_MAP[value]?.[0]?.value ?? ''
    setMaterialType(firstType)
  }

  // ---- 获取列表数据 ----
  const fetchList = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      const qs = new URLSearchParams()
      if (listFilterChannel) qs.set('channel_scope', listFilterChannel)
      if (listFilterType) qs.set('material_type', listFilterType)
      const params = qs.toString() ? `?${qs.toString()}` : ''
      const res = await fetch(`${API_BASE}/admin/knowledge/list${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '服务器响应异常' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const data: KnowledgeFile[] = await res.json()
      setFileList(data)
    } catch (err: any) {
      setListError(err.message || '获取列表失败')
    } finally {
      setListLoading(false)
    }
  }, [listFilterChannel, listFilterType])

  // 切换到列表 Tab 或筛选条件变化时自动拉取
  useEffect(() => {
    if (activeTab === 'list') {
      fetchList()
    }
  }, [activeTab, fetchList])

  // ---- 批量上传提交：逐文件串行处理 ----
  const handleSubmit = async () => {
    if (files.length === 0 || isUploading) return

    setUploadStatus('uploading')
    setBatchResult(null)

    const total = files.length
    setUploadProgress({ current: 0, total })

    const details: FileUploadDetail[] = []
    let successCount = 0
    let failCount = 0
    let totalChunks = 0

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total })

      try {
        const formData = new FormData()
        formData.append('file', files[i])
        formData.append('channel_scope', channelScope)
        formData.append('material_type', materialType)

        const res = await fetch(`${API_BASE}/admin/knowledge/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ detail: '服务器响应异常' }))
          throw new Error(errBody.detail || `HTTP ${res.status}`)
        }

        const data: UploadResult = await res.json()
        details.push({ filename: files[i].name, success: true, chunks_count: data.chunks_count })
        successCount++
        totalChunks += data.chunks_count
      } catch (err: any) {
        details.push({ filename: files[i].name, success: false, error: err.message || '处理失败' })
        failCount++
      }
    }

    setBatchResult({ total, successCount, failCount, totalChunks, details })
    setUploadStatus(failCount === total ? 'error' : 'success')
    setFiles([])
    fetchList()
  }

  // ---- 手动录入提交 ----
  const handleTextSubmit = async () => {
    if (!textTitle.trim() || !textContent.trim() || isUploading) return

    setUploadStatus('uploading')
    setBatchResult(null)

    try {
      const res = await fetch(`${API_BASE}/admin/knowledge/upload_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
          channel_scope: channelScope,
          material_type: materialType,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: '服务器响应异常' }))
        throw new Error(errBody.detail || `HTTP ${res.status}`)
      }

      const data: UploadResult = await res.json()
      setBatchResult({
        total: 1,
        successCount: 1,
        failCount: 0,
        totalChunks: data.chunks_count,
        details: [{ filename: data.source_filename, success: true, chunks_count: data.chunks_count }],
      })
      setUploadStatus('success')
      setTextTitle('')
      setTextContent('')
      fetchList()
    } catch (err: any) {
      setBatchResult({
        total: 1,
        successCount: 0,
        failCount: 1,
        totalChunks: 0,
        details: [{ filename: textTitle.trim(), success: false, error: err.message || '处理失败' }],
      })
      setUploadStatus('error')
    }
  }

  // ---- 删除逻辑 ----
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(
        `${API_BASE}/admin/knowledge/delete?source_filename=${encodeURIComponent(deleteTarget)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '删除失败' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setDeleteTarget(null)
      // 删除后刷新列表
      await fetchList()
    } catch (err: any) {
      setListError(err.message || '删除操作失败')
      setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const channelLabel = CHANNEL_OPTIONS.find((o) => o.value === channelScope)?.label ?? ''
  const materialLabel = currentMaterialTypes.find((o) => o.value === materialType)?.label ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="知识库管理" subtitle="Knowledge Base" />

      {/* 删除确认弹窗 */}
      {deleteTarget && !isDeleting && (
        <ConfirmDialog
          filename={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 切片详情抽屉 */}
      {chunksTarget && (
        <ChunksDrawer
          filename={chunksTarget}
          onClose={() => setChunksTarget(null)}
        />
      )}

      <div className="max-w-5xl mx-auto p-6 space-y-5">
        {/* Toast（仅上传 Tab 显示） */}
        {activeTab === 'upload' && (
          <BatchToast
            status={uploadStatus}
            batchResult={batchResult}
            onClose={() => setUploadStatus('idle')}
          />
        )}

        {/* ---- Tab 切换栏 ---- */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          {([
            {
              key: 'upload' as TabKey,
              label: '上传资料',
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              ),
            },
            {
              key: 'list' as TabKey,
              label: '资料库列表',
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              ),
            },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${activeTab === tab.key
                  ? 'bg-[#3a5e98] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========== Tab: 上传资料 ========== */}
        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* 左：表单区 (3/5) */}
            <div className="lg:col-span-3">
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a5e98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {inputMode === 'file' ? '上传知识文档' : '手动录入文本'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {inputMode === 'file'
                          ? '上传 .docx 或 .pdf 文件，系统将自动完成文本解析、切片和向量化入库'
                          : '直接粘贴或输入文本内容，将自动切片并向量化入库'}
                      </CardDescription>
                    </div>

                    {/* 文件/手动录入 Toggle */}
                    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
                      {(['file', 'text'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setInputMode(mode)}
                          disabled={isUploading}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 disabled:opacity-50
                            ${inputMode === mode
                              ? 'bg-white text-[#3a5e98] shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                          {mode === 'file' ? '文件上传' : '手动录入'}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="pt-5 space-y-5">
                  {/* 频道选择（共用） */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">频道范围</Label>
                    <select
                      value={channelScope}
                      onChange={(e) => handleChannelChange(e.target.value)}
                      disabled={isUploading}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30 focus:border-[#3a5e98]
                                 disabled:opacity-50 transition-all"
                    >
                      {CHANNEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 文档类型选择（共用） */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">资料类型</Label>
                    <select
                      value={materialType}
                      onChange={(e) => setMaterialType(e.target.value)}
                      disabled={isUploading}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30 focus:border-[#3a5e98]
                                 disabled:opacity-50 transition-all"
                    >
                      {currentMaterialTypes.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* ---- 文件上传模式 ---- */}
                  {inputMode === 'file' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">选择文件</Label>
                        <DropZone files={files} onFilesChange={setFiles} disabled={isUploading} />
                      </div>

                      <Button
                        onClick={handleSubmit}
                        disabled={files.length === 0 || isUploading}
                        className="w-full bg-[#3a5e98] hover:bg-[#2d4a78] text-white h-11 text-sm font-medium
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isUploading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            正在处理第 {uploadProgress.current}/{uploadProgress.total} 个文件...
                          </span>
                        ) : files.length > 1
                          ? `上传并向量化（${files.length} 个文件）`
                          : '上传并向量化'}
                      </Button>
                    </>
                  )}

                  {/* ---- 手动录入模式 ---- */}
                  {inputMode === 'text' && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                          标题 <span className="text-red-400">*</span>
                        </Label>
                        <input
                          type="text"
                          value={textTitle}
                          onChange={(e) => setTextTitle(e.target.value)}
                          disabled={isUploading}
                          placeholder="例如：三年级阅读课堂实录-2024春"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30
                                     focus:border-[#3a5e98] disabled:opacity-50 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                          素材内容 <span className="text-red-400">*</span>
                        </Label>
                        <textarea
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          disabled={isUploading}
                          rows={8}
                          placeholder="例如：那天在课堂上，一个三年级的孩子读完《夏洛的网》后说..."
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30
                                     focus:border-[#3a5e98] disabled:opacity-50 transition-all resize-none leading-relaxed"
                        />
                        <p className="text-xs text-gray-400 text-right">{textContent.length} 字</p>
                      </div>

                      <Button
                        onClick={handleTextSubmit}
                        disabled={!textTitle.trim() || !textContent.trim() || isUploading}
                        className="w-full bg-[#3a5e98] hover:bg-[#2d4a78] text-white h-11 text-sm font-medium
                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isUploading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            正在处理，请稍候...
                          </span>
                        ) : '保存并向量化'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 右：信息面板 (2/5) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-500 font-medium">当前配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">频道</span>
                    <Badge variant="outline" className="text-xs">{channelLabel}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">类型</span>
                    <Badge variant="outline" className="text-xs">{materialLabel}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {inputMode === 'file' ? '文件' : '标题'}
                    </span>
                    <span className="text-xs text-gray-700 truncate max-w-[140px]">
                      {inputMode === 'file'
                        ? (files.length > 0
                            ? `已选 ${files.length} 个文件`
                            : '未选择')
                        : (textTitle.trim() || '未填写')}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 bg-gray-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-500 font-medium">处理流程</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2.5 text-xs text-gray-600">
                    {[
                      '上传文档，系统自动识别 .docx / .pdf / .md 格式',
                      '提取全文纯文本内容',
                      '按 600 字切片（100 字重叠），保持语义连贯',
                      '调用 OpenAI Embedding 生成 1536 维语义向量',
                      '存入 PostgreSQL + pgvector，支持语义检索',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#3a5e98]/10 text-[#3a5e98] text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ========== Tab: 资料库列表 ========== */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* 频道筛选 */}
                <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">频道筛选</Label>
                <select
                  value={listFilterChannel}
                  onChange={(e) => {
                    setListFilterChannel(e.target.value)
                    // 频道切换时重置类型筛选
                    setListFilterType('')
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30 focus:border-[#3a5e98] transition-all"
                >
                  <option value="">全部频道</option>
                  {CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* 类型筛选：选项根据当前频道动态生成 */}
                <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">类型筛选</Label>
                <select
                  value={listFilterType}
                  onChange={(e) => setListFilterType(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-[#3a5e98]/30 focus:border-[#3a5e98] transition-all"
                >
                  <option value="">全部类型</option>
                  {(listFilterChannel
                    ? MATERIAL_TYPE_MAP[listFilterChannel] ?? []
                    // 未选频道时，合并所有类型并按 value 去重（避免 article 等重复出现）
                    : [
                        ...new Map(
                          Object.values(MATERIAL_TYPE_MAP)
                            .flat()
                            .map((o) => [o.value, o]),
                        ).values(),
                      ]
                  ).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchList}
                disabled={listLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600
                           border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={listLoading ? 'animate-spin' : ''}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                刷新
              </button>
            </div>

            {/* 错误提示 */}
            {listError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {listError}
              </div>
            )}

            {/* 列表表格 */}
            <Card className="border-gray-200 overflow-hidden">
              {listLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">加载中...</span>
                </div>
              ) : fileList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <p className="text-sm">暂无资料，请先上传文档</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">文件名</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">所属频道</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">资料类型</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">切片数量</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">上传时间</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 tracking-wide">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fileList.map((item, idx) => {
                        const channelLabel = CHANNEL_OPTIONS.find((o) => o.value === item.channel_scope)?.label ?? item.channel_scope
                        const typeLabel = ALL_MATERIAL_TYPE_LABELS[item.material_type] ?? item.material_type
                        return (
                          <tr key={`${item.source_filename}-${item.channel_scope}-${item.material_type}-${idx}`} className="hover:bg-gray-50/70 transition-colors">
                            {/* 文件名 */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span className="text-gray-900 font-medium truncate max-w-[240px]" title={item.source_filename}>
                                  {item.source_filename}
                                </span>
                              </div>
                            </td>
                            {/* 所属频道 */}
                            <td className="px-4 py-3.5">
                              <Badge variant="outline" className="text-xs font-normal">{channelLabel}</Badge>
                            </td>
                            {/* 资料类型 */}
                            <td className="px-4 py-3.5">
                              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{typeLabel}</span>
                            </td>
                            {/* 切片数量 */}
                            <td className="px-4 py-3.5 text-center">
                              <span className="text-sm font-semibold text-[#3a5e98]">{item.chunk_count}</span>
                            </td>
                            {/* 上传时间 */}
                            <td className="px-4 py-3.5 text-xs text-gray-500">
                              {formatDate(item.created_at)}
                            </td>
                            {/* 操作 */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-2">
                                {/* 查看切片 */}
                                <button
                                  onClick={() => setChunksTarget(item.source_filename)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium
                                             text-[#3a5e98] bg-[#3a5e98]/8 hover:bg-[#3a5e98]/15 transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  查看
                                </button>
                                {/* 删除 */}
                                <button
                                  onClick={() => setDeleteTarget(item.source_filename)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium
                                             text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  </svg>
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* 底部统计 */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                    共 {fileList.length} 个文件，合计{' '}
                    <span className="font-medium text-gray-600">
                      {fileList.reduce((sum, f) => sum + f.chunk_count, 0)}
                    </span>{' '}
                    个知识切片
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
