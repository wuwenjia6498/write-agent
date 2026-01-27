'use client'

import { useEffect, useState } from 'react'

interface Channel {
  channel_id: string
  channel_name: string
  description: string
  target_audience: string
  brand_personality: string
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
        const response = await fetch('/api/server/api/channels/')
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
              ? 'border-brand-primary bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          {/* 频道图标 */}
          <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center ${
            channel.channel_id === 'deep_reading' ? 'bg-blue-100' :
            channel.channel_id === 'picture_books' ? 'bg-purple-100' :
            'bg-orange-100'
          }`}>
            {channel.channel_id === 'deep_reading' && (
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            )}
            {channel.channel_id === 'picture_books' && (
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            )}
            {channel.channel_id === 'parenting' && (
              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
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
            <div className="mt-3 flex items-center text-brand-primary text-sm font-medium">
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

