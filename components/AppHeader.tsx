'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface AppHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode  // 中间区域的自定义内容
}

export default function AppHeader({ title, subtitle, children }: AppHeaderProps) {
  const pathname = usePathname()
  
  const navLinks = [
    { href: '/', label: '首页' },
    { href: '/workbench', label: '工作台' },
    { href: '/channels', label: '频道管理' },
    { href: '/tasks', label: '任务历史' },
    { href: '/materials', label: '素材管理' },
    { href: '/settings', label: '品牌资产' },
  ]
  
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* 左侧：Logo 和标题 */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <Image 
              src="/logo-1.png" 
              alt="老约翰" 
              width={40} 
              height={40}
              className="w-full h-full object-cover"
            />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        
        {/* 中间：自定义内容 */}
        {children && (
          <div className="flex items-center space-x-4">
            {children}
          </div>
        )}
        
        {/* 右侧：导航链接 */}
        <nav className="flex items-center space-x-1">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === link.href
                  ? 'text-[#3a5e98] bg-gray-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

