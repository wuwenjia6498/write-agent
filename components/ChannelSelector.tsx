'use client'

import { useEffect, useState } from 'react'
import { API_BASE } from '@/lib/api-config'

interface Channel {
  channel_id: string
  channel_name: string
  slug: string
  description: string
  target_audience?: string
  brand_personality?: string
}

interface Props {
  selectedChannel: string
  onSelectChannel: (channelId: string) => void
}

export default function ChannelSelector({ selectedChannel, onSelectChannel }: Props) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch(`${API_BASE}/channels/`)
        if (response.ok) {
          const data = await response.json()
          const formattedChannels = data.map((ch: any) => ({
            channel_id: ch.slug || ch.channel_id,
            channel_name: ch.name || ch.channel_name,
            slug: ch.slug,
            description: ch.description || '',
            target_audience: ch.target_audience || '',
            brand_personality: ch.brand_personality || ''
          }))
          setChannels(formattedChannels)
        }
      } catch (error) {
        console.error('获取频道列表失败:', error)
        setChannels([
          { channel_id: 'deep_reading', channel_name: '深度阅读（小学段）', slug: 'deep_reading', description: '经典文学拆解、整本书阅读策略', target_audience: '小学生家长' },
          { channel_id: 'picture_books', channel_name: '绘本阅读（幼儿段）', slug: 'picture_books', description: '高品质绘本推荐、亲子共读', target_audience: '幼儿家长' },
          { channel_id: 'parenting', channel_name: '育儿方向（家长随笔）', slug: 'parenting', description: '缓解家长焦虑、教育观察', target_audience: '所有家长' }
        ])
      } finally {
        setLoading(false)
      }
    }
    
    fetchChannels()
  }, [])
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {channels.map((channel) => (
        <button
          key={channel.channel_id}
          onClick={() => onSelectChannel(channel.channel_id)}
          className={`text-left p-4 rounded-lg border-2 transition-all ${
            selectedChannel === channel.channel_id
              ? 'border-[#3a5e98] bg-gray-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          {/* 频道信息 */}
          <h4 className="font-semibold text-gray-900 mb-1">
            {channel.channel_name}
          </h4>
          <p className="text-sm text-gray-600 mb-2">
            {channel.description}
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-medium">目标读者：</span>
            {channel.target_audience}
          </p>
          
          {/* 选中标识 */}
          {selectedChannel === channel.channel_id && (
            <div className="mt-3 flex items-center text-[#3a5e98] text-sm font-medium">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              已选择
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
