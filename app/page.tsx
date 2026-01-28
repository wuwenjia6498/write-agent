import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-8 px-4">
        {/* Logo 区域 */}
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl shadow-sm overflow-hidden">
            <Image 
              src="/logo-1.png" 
              alt="老约翰" 
              width={80} 
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
          
          <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
            老约翰写作 AGENT
          </h1>
          
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            AI 驱动的品牌内容创作平台
          </p>
        </div>
        
        {/* 核心特点 */}
        <div className="flex justify-center gap-8 text-sm text-gray-400 mt-6">
          <span>两层判断机制</span>
          <span>·</span>
          <span>9步完整SOP</span>
          <span>·</span>
          <span>降AI味机制</span>
        </div>
        
        {/* CTA 按钮 */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link 
            href="/workbench" 
            className="inline-flex items-center px-8 py-3 bg-[#3a5e98] text-white rounded-lg hover:bg-[#2d4a78] transition-colors text-base font-medium"
          >
            开始创作
          </Link>
          <Link 
            href="/channels" 
            className="inline-flex items-center px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-base font-medium"
          >
            频道管理
          </Link>
        </div>
        
        {/* 三大功能入口 */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-12">
          <Link 
            href="/tasks" 
            className="group p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="text-2xl mb-2 text-gray-400 group-hover:text-[#3a5e98]">
              <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900">任务历史</span>
          </Link>
          
          <Link 
            href="/materials" 
            className="group p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="text-2xl mb-2 text-gray-400 group-hover:text-[#3a5e98]">
              <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900">素材管理</span>
          </Link>
          
          <Link 
            href="/settings" 
            className="group p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="text-2xl mb-2 text-gray-400 group-hover:text-[#3a5e98]">
              <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900">品牌资产</span>
          </Link>
        </div>
        
        {/* 底部说明 */}
        <p className="text-gray-400 text-xs mt-8">
          传承15年品牌调性 · 工业化内容产出
        </p>
      </div>
    </main>
  )
}
