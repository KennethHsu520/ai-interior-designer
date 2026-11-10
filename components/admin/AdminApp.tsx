'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, Plus, Sofa } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/adminApi'
import { fetchRemoteCatalog, loadCatalog } from '@/lib/catalogLoader'
import type { CatalogItem } from '@/types/room'
import Wordmark from '@/components/ui/Wordmark'
import Button from '@/components/ui/Button'
import { inputClass, labelClass, noteClass, smallBtnClass } from '@/components/ui/fields'
import FurnitureList from './FurnitureList'
import NewFurniture from './NewFurniture'

type Tab = 'list' | 'new'

const tabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-soft ${
    active ? 'bg-white text-ink shadow-card' : 'text-ink-3 hover:text-ink'
  }`

export default function AdminApp() {
  const supabase = getSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('list')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [supabase])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchRemoteCatalog(true))
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let alive = true
    isAdmin(session.user.id)
      .then((v) => {
        if (!alive) return
        setAdmin(v)
        if (v) refresh()
      })
      .catch(() => alive && setAdmin(false))
    return () => {
      alive = false
    }
  }, [session, refresh])

  const afterChange = useCallback(async () => {
    try {
      localStorage.removeItem('furniture-catalog-cache-v1')
    } catch {}
    await refresh()
    loadCatalog(true)
  }, [refresh])

  if (!supabase)
    return (
      <Frame>
        <p className={noteClass.warn}>尚未設定 Supabase。請在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p>
      </Frame>
    )
  if (!ready) return <Frame><Pending text="連線中…" /></Frame>
  if (!session)
    return (
      <Frame>
        <LoginForm />
      </Frame>
    )

  const signOut = () => supabase.auth.signOut()

  if (admin === null) return <Frame email={session.user.email} onSignOut={signOut}><Pending text="確認權限中…" /></Frame>
  if (!admin)
    return (
      <Frame email={session.user.email} onSignOut={signOut}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-card border border-line bg-white p-6 text-sm text-ink-2 shadow-hairline">
          <h2 className="text-[17px] font-bold tracking-tight text-ink">這個帳號還不是管理員</h2>
          <p>請網站負責人在 Supabase 後台的 SQL Editor 執行下面這行，把你加入管理員，然後重新整理本頁：</p>
          <pre className="overflow-x-auto rounded-field bg-ink p-3 text-xs text-white">{`insert into public.admins (user_id) values ('${session.user.id}');`}</pre>
          <p className="text-xs text-ink-3">你的使用者 ID：{session.user.id}</p>
        </div>
      </Frame>
    )

  return (
    <Frame email={session.user.email} onSignOut={signOut}>
      <div className="flex rounded-pill bg-surface p-1">
        <button onClick={() => setTab('list')} className={tabClass(tab === 'list')}>
          <Sofa size={15} strokeWidth={1.75} />
          家具列表
          <span className="tabular-nums text-xs font-normal text-ink-4">{items.length}</span>
        </button>
        <button onClick={() => setTab('new')} className={tabClass(tab === 'new')}>
          <Plus size={15} strokeWidth={2} />
          新增家具
        </button>
      </div>
      {error && <p className={noteClass.error}>{error}</p>}
      {tab === 'list' ? (
        <FurnitureList items={items} loading={loading} onChanged={afterChange} />
      ) : (
        <NewFurniture
          existing={items}
          onCreated={async () => {
            await afterChange()
            setTab('list')
          }}
        />
      )}
    </Frame>
  )
}

function Pending({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-ink-3">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-500" aria-hidden="true" />
      {text}
    </div>
  )
}

function Frame({ children, email, onSignOut }: { children: React.ReactNode; email?: string; onSignOut?: () => void }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-6">
          <Wordmark compact />
          <span className="rounded-pill bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">家具庫管理</span>
          {email && (
            <span className="ml-auto flex items-center gap-3 text-xs text-ink-3">
              <span className="hidden sm:inline">{email}</span>
              <button onClick={onSignOut} className={smallBtnClass}>
                <LogOut size={14} strokeWidth={1.75} />
                登出
              </button>
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-8">{children}</main>
    </div>
  )
}

function LoginForm() {
  const supabase = getSupabase()!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const valid = useMemo(() => /\S+@\S+\.\S+/.test(email) && password.length >= 8, [email, password])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/admin` } })
        if (error) throw error
        setMsg({ kind: 'ok', text: data.session ? '註冊完成。' : '已寄出確認信，請到信箱點連結完成註冊後再回來登入。' })
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : '失敗'
      setMsg({ kind: 'error', text: /Invalid login/i.test(m) ? '帳號或密碼錯誤' : /not confirmed/i.test(m) ? '這個信箱還沒確認，請先到信箱點確認連結' : m })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-4 rounded-hero border border-line bg-white p-8 shadow-card">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-h3 font-bold text-ink">{mode === 'signin' ? '管理員登入' : '註冊管理員帳號'}</h1>
        <p className="text-sm text-ink-3">只有被加入管理員名單的帳號可以新增或修改家具。</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Email</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>密碼（至少 8 碼）</span>
        <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </label>
      {msg && <p className={noteClass[msg.kind]}>{msg.text}</p>}
      <Button disabled={!valid || busy} className="mt-1 w-full">
        {busy ? '處理中…' : mode === 'signin' ? '登入' : '註冊'}
      </Button>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-sm text-brand-600 transition-colors hover:text-brand-700">
        {mode === 'signin' ? '還沒有帳號？註冊' : '已有帳號？登入'}
      </button>
    </form>
  )
}
