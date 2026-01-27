/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 老约翰品牌色系 - Apple风格
        brand: {
          primary: '#2563eb', // 深邃蓝
          secondary: '#7c3aed', // 优雅紫
          accent: '#f59e0b', // 温暖橙
          success: '#10b981', // 成功绿
          warning: '#f59e0b', // 警告橙
          error: '#ef4444', // 错误红
        },
        background: {
          primary: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#f3f4f6',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

