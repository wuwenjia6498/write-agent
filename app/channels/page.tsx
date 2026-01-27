'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
  
  const loadChannelDetails = async (channelId: string) => {
    try {
      const response = await fetch(`/api/server/api/channels/${channelId}`)
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
    <div className="min-h-screen bg-background-secondary">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">频道管理</h1>
              <p className="text-sm text-gray-500">Channel Management</p>
            </div>
          </div>
          
          <Link href="/workbench" className="btn-primary">
            开始创作
          </Link>
        </div>
      </header>
      
      {/* 主内容 */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：频道列表 */}
          <div className="col-span-4">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">内容频道</h2>
              
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.map((channel) => (
                    <button
                      key={channel.channel_id}
                      onClick={() => loadChannelDetails(channel.channel_id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedChannel === channel.channel_id
                          ? 'border-brand-primary bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {channel.channel_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {channel.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧：频道详情 */}
          <div className="col-span-8">
            {!channelDetails ? (
              <div className="card text-center py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <p className="text-gray-500">请从左侧选择一个频道查看详情</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 基本信息 */}
                <div className="card">
                  <h2 className="text-2xl font-bold mb-4">{channelDetails.channel_name}</h2>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">频道描述</span>
                      <p className="mt-1 text-gray-900">{channelDetails.description}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">目标读者</span>
                      <p className="mt-1 text-gray-900">{channelDetails.target_audience}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">品牌人格</span>
                      <p className="mt-1 text-gray-900">{channelDetails.brand_personality}</p>
                    </div>
                  </div>
                </div>
                
                {/* System Prompt */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">AI写作人格</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">角色定位</p>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {channelDetails.system_prompt.role}
                      </p>
                    </div>
                    
                    {channelDetails.system_prompt.writing_style && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">写作风格</p>
                        <ul className="space-y-1">
                          {channelDetails.system_prompt.writing_style.map((style: string, index: number) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start">
                              <span className="text-brand-primary mr-2">•</span>
                              <span>{style}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 频道规则 */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">频道规则</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 mb-2">✓ 必须遵守</p>
                      <ul className="space-y-1">
                        {channelDetails.channel_specific_rules.must_do.map((rule: string, index: number) => (
                          <li key={index} className="text-xs text-green-700">
                            • {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-red-800 mb-2">✗ 严格禁止</p>
                      <ul className="space-y-1">
                        {channelDetails.channel_specific_rules.must_not_do.map((rule: string, index: number) => (
                          <li key={index} className="text-xs text-red-700">
                            • {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* 屏蔽词 */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">频道屏蔽词</h3>
                  <div className="flex flex-wrap gap-2">
                    {channelDetails.blocked_phrases.map((phrase: string, index: number) => (
                      <span key={index} className="px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* 素材标签 */}
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">素材标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {channelDetails.material_tags.map((tag: string, index: number) => (
                      <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

