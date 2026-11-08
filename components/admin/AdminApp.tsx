'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/adminApi'
import { fetchRemoteCatalog, loadCatalog } from '@/lib/catalogLoader'
import type { CatalogItem } from '@/types/room'
import FurnitureList from './FurnitureList'
import NewFurniture from './NewFurniture'

type Tab = 'list' | 'new'

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
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">尚未設定 Supabase。請在 .env.local 填入 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p>
      </Frame>
    )
  if (!ready) return <Frame>連線中…</Frame>
  if (!session)
    return (
      <Frame>
        <LoginForm />
      </Frame>
    )

  const signOut = () => supabase.auth.signOut()

  if (admin === null) return <Frame>確認權限中…</Frame>
  if (!admin)
    return (
      <Frame email={session.user.email} onSignOut={signOut}>
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-base font-bold">這個帳號還不是管理員</h2>
          <p>請網站負責人在 Supabase 後台的 SQL Editor 執行下面這行，把你加入管理員，然後重新整理本頁：</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`insert into public.admins (user_id) values ('${session.user.id}');`}</pre>
          <p className="text-xs text-slate-500">你的使用者 ID：{session.user.id}</p>
        </div>
      </Frame>
    )

  return (
    <Frame email={session.user.email} onSignOut={signOut}>
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 text-sm font-semibold">
        <button onClick={() => setTab('list')} className={`flex-1 rounded-lg py-2 ${tab === 'list' ? 'bg-white shadow' : 'text-slate-500'}`}>
          家具列表（{items.length}）
        </button>
        <button onClick={() => setTab('new')} className={`flex-1 rounded-lg py-2 ${tab === 'new' ? 'bg-white shadow' : 'text-slate-500'}`}>
          ＋ 新增家具
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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

function Frame({ children, email, onSignOut }: { children: React.ReactNode; email?: string; onSignOut?: () => void }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-black">
            🏠 AI<span className="text-sky-600">室內設計師</span>
          </Link>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white">家具庫管理</span>
          {email && (
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">{email}</span>
              <button onClick={onSignOut} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">
                登出
              </button>
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">{children}</main>
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
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-black">{mode === 'signin' ? '管理員登入' : '註冊管理員帳號'}</h1>
      <p className="text-xs text-slate-500">只有被加入管理員名單的帳號可以新增或修改家具。</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
        Email
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-sky-300" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
        密碼（至少 8 碼）
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-sky-300"
        />
      </label>
      {msg && <p className={`rounded-lg px-3 py-2 text-xs ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <button disabled={!valid || busy} className="rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:bg-slate-300">
        {busy ? '處理中…' : mode === 'signin' ? '登入' : '註冊'}
      </button>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-xs text-sky-600 hover:underline">
        {mode === 'signin' ? '還沒有帳號？註冊' : '已有帳號？登入'}
      </button>
    </form>
  )
}
