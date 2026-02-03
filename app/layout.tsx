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
    <html lang="zh-CN">
      <body className="font-sans antialiased bg-background-primary">
        {children}
      </body>
    </html>
  )
}

