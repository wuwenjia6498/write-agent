/**
 * API 配置文件
 * 统一管理前端 API 请求地址
 * 自动根据环境切换开发/生产地址
 */

// 获取后端服务器地址（不含 /api）
const getServerBase = (): string => {
  // 1. 如果设置了环境变量，直接使用
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // 2. 自动检测：如果是浏览器环境，根据当前域名判断
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // 本地开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000'
    }
    
    // 生产环境 - Railway 后端
    return 'https://write-agent-production.up.railway.app'
  }
  
  // 3. 服务端渲染时的默认值
  return 'https://write-agent-production.up.railway.app'
}

// 服务器基础地址（不含 /api）
export const SERVER_BASE = getServerBase()

// API 基础地址（含 /api，用于替换原有的 API_BASE 常量）
export const API_BASE = `${SERVER_BASE}/api`

// 导出完整 API 路径的辅助函数
export const apiUrl = (path: string): string => {
  // 确保 path 以 / 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${SERVER_BASE}${normalizedPath}`
}

