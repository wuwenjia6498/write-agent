/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 配置后端API代理
  async rewrites() {
    return [
      {
        source: '/api/server/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ]
  },
}

module.exports = nextConfig

