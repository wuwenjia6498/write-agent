import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center space-y-8 px-4">
        {/* Logo 区域 */}
        <div className="space-y-4">
          <div className="w-24 h-24 mx-auto bg-brand-primary rounded-3xl shadow-lg flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900">
            老约翰自动化写作AGENT
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI驱动的品牌内容创作平台<br />
            <span className="text-brand-primary font-medium">两层判断机制 + 9步完整SOP</span>
          </p>
        </div>
        
        {/* 核心特点 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
          <div className="card text-left">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">两层判断机制</h3>
            <p className="text-gray-600 text-sm">
              工作区识别 + 频道路由，精准匹配创作人格
            </p>
          </div>
          
          <div className="card text-left">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">9步完整SOP</h3>
            <p className="text-gray-600 text-sm">
              从需求到配图，全流程可视化管理
            </p>
          </div>
          
          <div className="card text-left">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">降AI味机制</h3>
            <p className="text-gray-600 text-sm">
              品牌素材库 + 三遍审校 + 屏蔽词过滤
            </p>
          </div>
        </div>
        
        {/* CTA 按钮 */}
        <div className="flex gap-4 justify-center mt-12">
          <Link href="/workbench" className="btn-primary text-lg px-8 py-3">
            开始创作
          </Link>
          <Link href="/channels" className="btn-secondary text-lg px-8 py-3">
            频道管理
          </Link>
        </div>
        
        {/* 底部说明 */}
        <p className="text-gray-500 text-sm mt-12">
          传承15年品牌调性 · 工业化内容产出
        </p>
      </div>
    </main>
  )
}

