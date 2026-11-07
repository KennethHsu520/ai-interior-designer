import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI室內設計師',
  description: '輸入真實尺寸、拍下每一面牆，讓 AI 辨識門窗插座，再自己擺放家具或讓 AI 幫你配置。',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  )
}
