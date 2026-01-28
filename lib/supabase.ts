/**
 * Supabase 客户端配置
 * 用于前端实时订阅和数据操作
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 从环境变量获取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 创建 Supabase 客户端（如果配置存在）
let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('[Supabase] 环境变量未配置，实时订阅功能将不可用')
}

export { supabase }

/**
 * 订阅写作任务状态变化
 * 
 * @param taskId 任务 ID
 * @param callback 状态变化回调函数
 * @returns 取消订阅函数
 */
export function subscribeToTask(
  taskId: string,
  callback: (payload: any) => void
) {
  // 如果 Supabase 未配置，返回空函数
  if (!supabase) {
    console.warn('[Supabase] 客户端未初始化，跳过订阅')
    return () => {}
  }

  const channel = supabase
    .channel(`task:${taskId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'writing_tasks',
        filter: `id=eq.${taskId}`
      },
      (payload) => {
        console.log('[Supabase] Task updated:', payload)
        callback(payload.new)
      }
    )
    .subscribe()

  // 返回取消订阅函数
  return () => {
    supabase?.removeChannel(channel)
  }
}

/**
 * 获取任务详情
 */
export async function getTask(taskId: string) {
  if (!supabase) {
    console.warn('[Supabase] 客户端未初始化')
    return null
  }

  const { data, error } = await supabase
    .from('writing_tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (error) {
    console.error('[Supabase] Get task error:', error)
    return null
  }

  return data
}

/**
 * 获取频道列表
 */
export async function getChannels() {
  if (!supabase) {
    console.warn('[Supabase] 客户端未初始化')
    return []
  }

  const { data, error } = await supabase
    .from('channels')
    .select('id, name, slug, description')
    .eq('is_active', true)

  if (error) {
    console.error('[Supabase] Get channels error:', error)
    return []
  }

  return data
}

