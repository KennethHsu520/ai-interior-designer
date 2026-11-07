'use client'

import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from '@/lib/catalog'
import { cornerAngle, wallSegment } from '@/lib/geometry'
import { cm, furnitureSchedule, roomSummary, swingText, tagWallItems, type Tagged } from '@/lib/planData'
import { buildDxf } from '@/lib/dxf'
import { itemTypeInfo, type WallItem } from '@/types/room'
import PlanDrawing, { pickScale } from './PlanDrawing'
import ElevationDrawing, { type ElevationFurniture } from './ElevationDrawing'

const noop = () => () => {}

function TitleBlock({ project, title, no, scale, total }: { project: string; title: string; no: string; scale?: string; total: number }) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
  return (
    <div className="grid grid-cols-[1.4fr_1.6fr_0.8fr_0.7fr_0.7fr_0.9fr] border-t-2 border-slate-900 text-[8pt] leading-tight">
      <Cell label="專案名稱">{project}</Cell>
      <Cell label="圖名">{title}</Cell>
      <Cell label="圖號">
        {no} / {total}
      </Cell>
      <Cell label="比例">{scale ?? '—'}</Cell>
      <Cell label="單位">cm</Cell>
      <Cell label="日期">{date}</Cell>
      <div className="col-span-6 border-t border-slate-300 px-2 py-1 text-[7pt] text-slate-500">
        註：1. 所有尺寸以公分（cm）為單位，以室內淨尺寸標示。2. 本圖由使用者自行量測輸入，施工前請由設計師或施工單位至現場複核尺寸。3. 開關、插座、冷氣等設備高度為中心離地（FL）高度；門窗為下緣高度。
      </div>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-l border-slate-300 px-2 py-1 first:border-l-0">
      <div className="text-[6.5pt] text-slate-500">{label}</div>
      <div className="font-bold text-slate-900">{children}</div>
    </div>
  )
}

function Sheet({ children, title, no, scale, project, total }: { children: ReactNode; title: string; no: string; scale?: string; project: string; total: number }) {
  return (
    <section className="sheet mx-auto mb-6 flex flex-col bg-white shadow-lg print:mb-0 print:shadow-none">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-[8mm] pb-[3mm]">{children}</div>
      <div className="px-[8mm] pb-[6mm]">
        <TitleBlock project={project} title={title} no={no} scale={scale} total={total} />
      </div>
    </section>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="border border-slate-400 bg-slate-100 px-1.5 py-1 text-left font-bold">{children}</th>
}
function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border border-slate-300 px-1.5 py-0.5 align-top ${className}`}>{children}</td>
}

export default function PlanSheets() {
  const client = useSyncExternalStore(noop, () => true, () => false)
  const room = useRoomStore((s) => s.room)
  const furniture = useRoomStore((s) => s.furniture)

  const data = useMemo(() => {
    const tags = tagWallItems(room)
    const schedule = furnitureSchedule(room, furniture, CATALOG_MAP)
    const summary = roomSummary(room)
    return { tags, schedule, summary }
  }, [room, furniture])

  if (!client) return null

  const { tags, schedule, summary } = data
  const project = room.name || '我的房間'
  const outerW = (summary.bbox.width + 0.24) * 100
  const outerH = (summary.bbox.depth + 0.24) * 100
  const planScale = pickScale(outerW, outerH, 277, 150, 52, 52)
  const planFurniture = schedule.map((r) => {
    const c = r.corners
    return { tag: r.tag, corners: c, rug: r.item.category === '地毯', front: [c[3], c[2]] }
  })
  const allItems = [...tags.doors, ...tags.windows, ...tags.electric, ...tags.others]
  const elevations = room.floor.map((_, i) => {
    const s = wallSegment(room.floor, i)
    const items = allItems.filter((it) => it.wallIndex === i)
    const near: ElevationFurniture[] = schedule.flatMap((r) => {
      const d = r.distances.find((x) => x.wall === i)
      if (!d || d.distance > 0.3) return []
      const ts = r.corners.map((p) => (p.x - s.a.x) * s.dir.x + (p.z - s.a.z) * s.dir.z)
      const lo = Math.max(0, Math.min(...ts))
      const hi = Math.min(s.length, Math.max(...ts))
      if (hi - lo < 0.02) return []
      return [{ tag: r.tag, offset: lo, width: hi - lo, height: r.dims.height }]
    })
    const scale = pickScale(s.length * 100, room.height * 100, 132, items.length > 3 ? 95 : 118, 26, 30)
    return { i, s, items, near, scale }
  })
  const elevationPages: (typeof elevations)[] = []
  for (let k = 0; k < elevations.length; k += 2) elevationPages.push(elevations.slice(k, k + 2))
  const issues: string[] = [
    ...room.walls.flatMap((w, i) => (w.confirmed ? [] : [`牆 ${i + 1} 尚未確認牆面物件`])),
    ...schedule.flatMap((r) => r.problems.map((p) => `${r.tag} ${r.item.name}：${p}`)),
  ]
  const total = 4 + elevationPages.length

  const downloadDxf = () => {
    const text = buildDxf(room, furniture, CATALOG_MAP)
    const blob = new Blob([text], { type: 'application/dxf' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project}-平面圖.dxf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const itemRow = (it: Tagged<WallItem>) => (
    <tr key={it.id}>
      <Td className="font-bold">{it.tag}</Td>
      <Td>{itemTypeInfo(it.type).label}</Td>
      <Td>{it.label}</Td>
      <Td>牆 {it.wallIndex + 1}</Td>
      <Td className="tabular-nums">{cm(it.offset)}</Td>
      <Td className="tabular-nums">
        {cm(it.width)} × {cm(it.height)}
      </Td>
      <Td className="tabular-nums">{it.type === 'door' || it.type === 'window' ? cm(it.elevation) : `${cm(it.elevation + it.height / 2)}（中心）`}</Td>
      <Td>{it.type === 'door' ? swingText(it) : it.type === 'window' ? `窗台高 ${cm(it.elevation)}` : it.confirmed ? '' : '待確認'}</Td>
    </tr>
  )

  return (
    <div className="min-h-dvh bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mx-auto mb-6 flex max-w-[297mm] flex-wrap items-center gap-2 rounded-xl bg-white/95 px-4 py-3 shadow backdrop-blur">
        <Link href="/" className="text-sm text-sky-700 hover:underline">
          ← 回到設計
        </Link>
        <h1 className="mr-auto text-base font-black text-slate-800">設計圖輸出（共 {total} 張 A4 橫式）</h1>
        <button onClick={downloadDxf} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          下載 DXF（AutoCAD）
        </button>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          列印／存成 PDF
        </button>
        <p className="w-full text-[11px] text-slate-500">列印時請選「橫向」、邊界「無」，並勾選「背景圖形」，顏色與線條才會正確。</p>
      </div>

      <Sheet project={project} title="平面尺寸及門窗水電圖" no="A-01" scale={`1:${planScale}`} total={total}>
        <div className="flex flex-1 items-center justify-center">
          <PlanDrawing room={room} furniture={[]} showFurniture={false} doors={tags.doors} windows={tags.windows} electric={tags.electric} ceiling={room.ceilingItems} scale={planScale} title={project} />
        </div>
        <Legend />
      </Sheet>

      <Sheet project={project} title="家具配置平面圖" no="A-02" scale={`1:${planScale}`} total={total}>
        <div className="flex flex-1 items-center justify-center">
          <PlanDrawing room={room} furniture={planFurniture} doors={tags.doors} windows={tags.windows} electric={tags.electric} ceiling={room.ceilingItems} scale={planScale} />
        </div>
        <p className="text-[7pt] text-slate-500">家具外框為俯視投影，粗線邊為家具正面。編號對照 A-03 家具表；虛線框為地毯。</p>
      </Sheet>

      <Sheet project={project} title="家具表" no="A-03" total={total}>
        <h2 className="mb-1 text-[10pt] font-bold">家具表（{schedule.length} 件）</h2>
        {schedule.length === 0 ? (
          <p className="text-[9pt] text-slate-500">尚未擺放家具。</p>
        ) : (
          <table className="w-full border-collapse text-[7.5pt]">
            <thead>
              <tr>
                <Th>編號</Th>
                <Th>品名</Th>
                <Th>分類</Th>
                <Th>尺寸 寬×深×高</Th>
                <Th>顏色／材質</Th>
                <Th>定位（家具邊緣到牆）</Th>
                <Th>方向</Th>
                <Th>備註</Th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((r) => (
                <tr key={r.tag}>
                  <Td className="font-bold">{r.tag}</Td>
                  <Td>{r.item.name}</Td>
                  <Td>{r.item.category}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {cm(r.dims.width)} × {cm(r.dims.depth)} × {cm(r.dims.height)}
                  </Td>
                  <Td>
                    {r.colors.length === 0 ? (
                      <span className="text-slate-500">原廠材質</span>
                    ) : (
                      <span className="flex flex-col gap-0.5">
                        {r.colors.map((c) => (
                          <span key={c.label} className="flex items-center gap-1 whitespace-nowrap">
                            <span className="inline-block h-2.5 w-2.5 border border-black/30" style={{ background: c.hex, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
                            {c.label} {c.hex.toUpperCase()}
                          </span>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{r.distances.length ? r.distances.map((d) => `牆${d.wall + 1}：${cm(d.distance)}`).join('／') : '—'}</Td>
                  <Td className="tabular-nums">{r.deg}°</Td>
                  <Td className={r.problems.length ? 'text-red-700' : ''}>{r.problems.join('；') || ''}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-1 text-[7pt] text-slate-500">定位：家具外框最靠近該牆的一邊到牆面的淨距離。方向：家具正面朝向，以平面圖為準順時針角度。</p>
      </Sheet>

      <Sheet project={project} title="門窗表・水電設備表・格局資料" no="A-04" total={total}>
        <div className="grid grid-cols-[1.6fr_1fr] gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="mb-1 text-[10pt] font-bold">門窗及牆面設備表</h2>
              <table className="w-full border-collapse text-[7.5pt]">
                <thead>
                  <tr>
                    <Th>編號</Th>
                    <Th>類型</Th>
                    <Th>名稱</Th>
                    <Th>位置</Th>
                    <Th>距牆左端</Th>
                    <Th>寬 × 高</Th>
                    <Th>離地</Th>
                    <Th>說明</Th>
                  </tr>
                </thead>
                <tbody>{allItems.length ? allItems.map(itemRow) : <tr><Td>—</Td><Td>尚無資料</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td></tr>}</tbody>
              </table>
              <p className="mt-1 text-[7pt] text-slate-500">距牆左端：從房間內面向該牆時，牆左端到物件左緣。門窗離地為下緣高度；開關、插座、冷氣等設備為中心高度。左鉸／右鉸同樣以房間內面向該牆判斷。</p>
            </div>
            <div>
              <h2 className="mb-1 text-[10pt] font-bold">設計檢查</h2>
              {issues.length === 0 ? (
                <p className="text-[8pt] text-emerald-700">✓ 未發現穿牆、重疊、擋門或使用空間不足的問題。</p>
              ) : (
                <ul className="list-disc pl-4 text-[8pt] text-red-700">
                  {issues.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="mb-1 text-[10pt] font-bold">格局資料</h2>
              <table className="w-full border-collapse text-[7.5pt]">
                <tbody>
                  <tr>
                    <Td className="bg-slate-50 font-bold">室內面積</Td>
                    <Td className="tabular-nums">
                      {summary.area.toFixed(2)} m²（{summary.ping.toFixed(2)} 坪）
                    </Td>
                  </tr>
                  <tr>
                    <Td className="bg-slate-50 font-bold">室內周長</Td>
                    <Td className="tabular-nums">{cm(summary.perimeter)} cm</Td>
                  </tr>
                  <tr>
                    <Td className="bg-slate-50 font-bold">室內淨高</Td>
                    <Td className="tabular-nums">{cm(room.height)} cm</Td>
                  </tr>
                  <tr>
                    <Td className="bg-slate-50 font-bold">外框尺寸</Td>
                    <Td className="tabular-nums">
                      {cm(summary.bbox.width)} × {cm(summary.bbox.depth)} cm
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table className="w-full border-collapse text-[7.5pt]">
              <thead>
                <tr>
                  <Th>牆</Th>
                  <Th>淨長</Th>
                  <Th>與下一面牆夾角</Th>
                  <Th>狀態</Th>
                </tr>
              </thead>
              <tbody>
                {room.floor.map((_, i) => (
                  <tr key={i}>
                    <Td className="font-bold">牆 {i + 1}</Td>
                    <Td className="tabular-nums">{cm(wallSegment(room.floor, i).length)}</Td>
                    <Td className="tabular-nums">{(Math.round(cornerAngle(room.floor, (i + 1) % room.floor.length) * 10) / 10).toString()}°</Td>
                    <Td>{room.walls[i]?.lengthLocked ? '已實測鎖定' : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Sheet>

      {elevationPages.map((page, k) => (
        <Sheet key={k} project={project} title={`牆面立面圖（${page.map((e) => `牆 ${e.i + 1}`).join('、')}）`} no={`A-${String(5 + k).padStart(2, '0')}`} scale={page.map((e) => `1:${e.scale}`).join('、')} total={total}>
          <div className="grid flex-1 grid-cols-2 gap-4">
            {page.map((e) => (
              <div key={e.i} className="flex min-w-0 flex-col">
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="text-[10pt] font-bold">
                    牆 {e.i + 1} 立面圖 <span className="font-normal text-slate-500">（由室內面向牆面）</span>
                  </h2>
                  <span className="text-[8pt] text-slate-500">1:{e.scale}</span>
                </div>
                <div className="flex justify-center">
                  <ElevationDrawing length={e.s.length} height={room.height} items={e.items} furniture={e.near} scale={e.scale} />
                </div>
                {e.items.length > 0 && (
                  <table className="mt-1 w-full border-collapse text-[7pt]">
                    <thead>
                      <tr>
                        <Th>編號</Th>
                        <Th>類型</Th>
                        <Th>距左</Th>
                        <Th>離地</Th>
                        <Th>寬×高</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.items.map((it) => (
                        <tr key={it.id}>
                          <Td className="font-bold">{it.tag}</Td>
                          <Td>
                            {itemTypeInfo(it.type).label}
                            {it.type === 'door' ? `（${swingText(it)}）` : ''}
                          </Td>
                          <Td className="tabular-nums">{cm(it.offset)}</Td>
                          <Td className="tabular-nums">{it.type === 'door' || it.type === 'window' ? cm(it.elevation) : `${cm(it.elevation + it.height / 2)}（中心）`}</Td>
                          <Td className="tabular-nums">
                            {cm(it.width)}×{cm(it.height)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
          <p className="text-[7pt] text-slate-500">灰色虛線框為靠在該牆前方（30 cm 內）的家具輪廓，編號對照家具表。</p>
        </Sheet>
      ))}
    </div>
  )
}

function Legend() {
  const sw = 'inline-flex items-center gap-1'
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[7pt] text-slate-600">
      <span className={sw}>
        <svg width="18" height="10">
          <rect x="1" y="2" width="16" height="6" fill="#374151" />
        </svg>
        牆（示意厚度 12）
      </span>
      <span className={sw}>
        <svg width="18" height="12">
          <path d="M2 11 L2 1 M2 11 A10 10 0 0 1 12 1" fill="none" stroke="#0f172a" strokeDasharray="2 1" />
        </svg>
        D 門（含開門方向）
      </span>
      <span className={sw}>
        <svg width="18" height="10">
          <rect x="1" y="2" width="16" height="6" fill="none" stroke="#0f172a" />
          <line x1="1" y1="4.5" x2="17" y2="4.5" stroke="#0f172a" />
          <line x1="1" y1="5.5" x2="17" y2="5.5" stroke="#0f172a" />
        </svg>
        W 窗
      </span>
      <span className={sw}>
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="#7c3aed" />
          <line x1="4" y1="3" x2="4" y2="9" stroke="#7c3aed" />
          <line x1="8" y1="3" x2="8" y2="9" stroke="#7c3aed" />
        </svg>
        插座
      </span>
      <span className={sw}>
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="#7c3aed" />
          <text x="6" y="8.5" fontSize="7" textAnchor="middle" fill="#7c3aed">
            S
          </text>
        </svg>
        開關
      </span>
      <span className={sw}>
        <svg width="12" height="12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="#ca8a04" />
          <path d="M3 3 L9 9 M9 3 L3 9" stroke="#ca8a04" />
        </svg>
        燈具
      </span>
      <span className={sw}>
        <svg width="18" height="10">
          <rect x="1" y="2" width="16" height="6" fill="none" stroke="#0e7490" strokeDasharray="2 1" />
        </svg>
        AC 冷氣
      </span>
      <span>E 編號＝水電設備，對照 A-04</span>
    </div>
  )
}
