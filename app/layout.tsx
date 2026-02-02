import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '老约翰自动化写作AGENT',
  description: 'AI驱动的品牌内容创作平台 - 两层判断 + 9步SOP',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: 允许浏览器扩展修改 html/body 属性而不触发水合警告
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background-primary" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

