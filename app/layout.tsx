import type { Metadata, Viewport } from 'next'
import './globals.css'

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'

export const metadata: Metadata = {
  title: 'AI室內設計師',
  description: '輸入真實尺寸、拍下每一面牆並標出門窗插座，再自己擺放家具或一鍵自動配置。完全免費。',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fbfaf8',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_URL} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
