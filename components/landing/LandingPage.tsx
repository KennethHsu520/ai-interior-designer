import Link from 'next/link'
import { ArrowRight, Camera, Cpu, FileText, HardDrive, Ruler, ScanSearch, ShieldCheck, Sofa, Sparkles, Check } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import HeroVisual from './HeroVisual'
import Reveal from './Reveal'

const ICON = { size: 22, strokeWidth: 1.75 } as const

const FEATURES = [
  { icon: Ruler, title: '真實尺寸的 3D 房間', text: '輸入長、寬、高，或在俯視圖拖曳頂點做出 L 型格局。每面牆都標著長度，和現場一模一樣。' },
  { icon: Camera, title: '拍下每一面牆', text: '用手機對著牆拍一張，在照片上框出門、窗、開關、插座與冷氣，它們就會出現在 3D 牆上。' },
  { icon: ScanSearch, title: '自動找找看', text: '瀏覽器裡的視覺模型會先幫你標出可能的門窗位置，你只要確認或修正，不用從零開始。' },
  { icon: Sofa, title: '近千件家具', text: '依分類、風格篩選與搜尋，拖進房間就能擺。找不到的，拍張照自己做一件。' },
  { icon: Sparkles, title: '一鍵自動配置', text: '勾選想要的家具與需求，例如床靠窗、留輪椅動線，配置引擎會避開門、插座與走道。' },
  { icon: FileText, title: '輸出專業設計圖', text: '平面圖、立面圖與家具清單，一鍵輸出 PDF 或 DXF，直接交給設計師或施工單位。' },
]

const STEPS = [
  { no: '01', title: '量好尺寸，建立房間', text: '拿出捲尺量長寬高，填進去，一間空白的 3D 房間就在你眼前。需要 L 型或不規則格局也可以拖出來。' },
  { no: '02', title: '拍每一面牆，標出門窗', text: '點一面牆，拍照，框出門窗插座。全部牆面確認完，房間格局就和現場一致了。' },
  { no: '03', title: '擺家具，輸出設計圖', text: '自己拖曳，或讓系統自動配置。滿意了就輸出 PDF 與 DXF，帶去找設計師、傢俱行或施工團隊。' },
]

const TRUST = [
  { icon: ShieldCheck, title: '照片不會離開你的裝置', text: '牆面照片、房間資料與自製家具都只存在你的瀏覽器裡，不會上傳到任何伺服器。' },
  { icon: Cpu, title: 'AI 在你的電腦上執行', text: '視覺辨識與照片生成 3D 都在瀏覽器內運算，模型下載前會先告訴你大小並徵求同意。' },
  { icon: HardDrive, title: '隨時匯出、永久免費', text: '房間可以匯出成 JSON 備份或換台裝置繼續。沒有付費方案，也不需要註冊帳號。' },
]

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand-500 text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6 10v9h12v-9" />
        </svg>
      </span>
      AI室內設計師
    </Link>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[15px] text-ink-2 md:flex">
          <a href="#features" className="transition-colors hover:text-ink">
            功能
          </a>
          <a href="#how" className="transition-colors hover:text-ink">
            使用流程
          </a>
          <a href="#trust" className="transition-colors hover:text-ink">
            隱私與費用
          </a>
          <Link href="/licenses" className="transition-colors hover:text-ink">
            素材授權
          </Link>
        </nav>
        <LinkButton href="/design" size="sm">
          開始設計
          <ArrowRight size={16} strokeWidth={2} />
        </LinkButton>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_50%_at_70%_0%,rgba(166,90,58,0.08),transparent_70%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pb-32 lg:pt-24">
        <div className="max-w-xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-white px-3 py-1 text-[13px] font-medium text-ink-2 shadow-hairline">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              完全免費・不需註冊
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 text-[40px] font-bold leading-[1.12] tracking-[-0.02em] text-ink sm:text-[52px] lg:text-[64px]">
              把房間搬進螢幕，
              <br />
              先試過再動手。
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-body text-ink-2 sm:text-[18px]">
              輸入真實尺寸、拍下每一面牆，建立和現場一致的 3D 房間。再從近千件家具中挑選、擺放，或讓系統自動配置，最後輸出設計圖給設計師。
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LinkButton href="/design" size="lg">
                免費開始設計
                <ArrowRight size={18} strokeWidth={2} />
              </LinkButton>
              <LinkButton href="#how" variant="secondary" size="lg">
                看看怎麼運作
              </LinkButton>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-3">
              {['照片只留在你的瀏覽器', '近千件可商用家具', '輸出 PDF 與 DXF'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={15} strokeWidth={2} className="text-brand-500" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  )
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-brand-500">{eyebrow}</p>
      <h2 className="mt-3 text-[30px] font-bold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[40px]">{title}</h2>
      {text && <p className="mt-4 text-body text-ink-2">{text}</p>}
    </Reveal>
  )
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-surface py-20 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="功能" title="從真實格局開始，每一步都看得見。" text="先讓房間和現場一樣，再談家具。所有操作都在瀏覽器裡完成，手機也能用。" />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} as="li" delay={(i % 3) * 80}>
              <article className="group flex h-full flex-col rounded-card bg-white p-7 shadow-card transition-[box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                  <f.icon {...ICON} />
                </span>
                <h3 className="mt-6 text-h3 font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-body-sm text-ink-2">{f.text}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 py-20 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="使用流程" title="三個步驟，從空房間到設計圖。" />
        <div className="relative mt-14 lg:mt-20">
          <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-line lg:block" />
          <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.no} as="li" delay={i * 120} className="relative">
              <div className="flex items-center gap-4">
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-canvas font-semibold tabular-nums text-brand-500 shadow-hairline">
                  {s.no}
                </span>
                <span className="h-px flex-1 bg-line lg:hidden" />
              </div>
              <h3 className="mt-6 text-h3 font-bold text-ink">{s.title}</h3>
              <p className="mt-2 max-w-sm text-body-sm text-ink-2">{s.text}</p>
            </Reveal>
          ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section id="trust" className="scroll-mt-16 bg-ink py-20 text-white lg:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-brand-300">隱私與費用</p>
          <h2 className="mt-3 text-[30px] font-bold leading-[1.2] tracking-[-0.015em] sm:text-[40px]">零上傳，也零費用。</h2>
          <p className="mt-4 max-w-md text-body text-white/70">
            這個網站沒有後端在看你的照片。AI 模型在你的電腦或手機上執行，房間資料存在你自己的瀏覽器，隨時可以匯出帶走。
          </p>
        </Reveal>
        <ul className="grid gap-4">
          {TRUST.map((t, i) => (
            <Reveal key={t.title} as="li" delay={i * 100}>
              <div className="flex gap-5 rounded-card border border-white/10 bg-white/[0.04] p-6 transition-colors duration-300 hover:bg-white/[0.07]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-300">
                  <t.icon {...ICON} />
                </span>
                <div>
                  <h3 className="text-[17px] font-bold">{t.title}</h3>
                  <p className="mt-1.5 text-body-sm text-white/65">{t.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CallToAction() {
  return (
    <section className="py-20 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-hero bg-brand-500 px-8 py-16 text-center text-white sm:px-12 lg:py-24">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_80%_100%,rgba(255,255,255,0.14),transparent_70%)]" />
            <h2 className="relative text-[30px] font-bold leading-[1.2] tracking-[-0.015em] sm:text-[44px]">
              現在就開始佈置你的房間。
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-body text-white/80">不用下載、不用註冊。打開就能量尺寸、拍牆、擺家具。</p>
            <div className="relative mt-9 flex justify-center">
              <LinkButton href="/design" variant="inverse" size="lg">
                免費開始設計
                <ArrowRight size={18} strokeWidth={2} />
              </LinkButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-3 text-[14px] text-ink-3">把房間搬進螢幕，先試過再動手。一個完全在瀏覽器裡執行的室內設計工具。</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-[14px] text-ink-2 sm:grid-cols-3">
          <Link href="/design" className="transition-colors hover:text-ink">
            設計工作台
          </Link>
          <Link href="/plan" className="transition-colors hover:text-ink">
            設計圖輸出
          </Link>
          <Link href="/licenses" className="transition-colors hover:text-ink">
            素材來源與授權
          </Link>
          <a href="#features" className="transition-colors hover:text-ink">
            功能
          </a>
          <a href="#how" className="transition-colors hover:text-ink">
            使用流程
          </a>
          <Link href="/admin" className="transition-colors hover:text-ink">
            家具庫管理
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-[13px] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 AI室內設計師</span>
          <span>家具模型來自 KayKit 與 Poly Haven（CC0）</span>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Trust />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}
