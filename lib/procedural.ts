import type { CatalogItem } from '@/types/room'

export type Role = 'main' | 'wood' | 'metal' | 'accent' | 'white' | 'dark' | 'glass' | 'light' | 'leaf' | 'pot' | 'screen'

export type Part = {
  s: 'box' | 'cyl' | 'sph'
  p: [number, number, number]
  d: [number, number, number]
  c: Role
  r?: [number, number, number]
}

type Gen = (w: number, d: number, h: number) => Part[]

const B = (x: number, y0: number, z: number, w: number, h: number, d: number, c: Role, r?: [number, number, number]): Part => ({
  s: 'box',
  p: [x, y0 + h / 2, z],
  d: [w, h, d],
  c,
  r,
})
const C = (x: number, y0: number, z: number, r: number, h: number, c: Role, rb = r, rot?: [number, number, number]): Part => ({
  s: 'cyl',
  p: [x, y0 + h / 2, z],
  d: [r, h, rb],
  c,
  r: rot,
})
const S = (x: number, y: number, z: number, rx: number, ry: number, rz: number, c: Role): Part => ({ s: 'sph', p: [x, y, z], d: [rx, ry, rz], c })

function legs4(w: number, d: number, inset: number, h: number, t: number, c: Role, y0 = 0, round = false): Part[] {
  const xs = [-w / 2 + inset + t / 2, w / 2 - inset - t / 2]
  const zs = [-d / 2 + inset + t / 2, d / 2 - inset - t / 2]
  return xs.flatMap((x) => zs.map((z) => (round ? C(x, y0, z, t / 2, h, c) : B(x, y0, z, t, h, t, c))))
}

function bed(head: 'wood' | 'soft' | 'low'): Gen {
  return (w, d, h) => {
    const frameH = head === 'low' ? 0.16 : 0.3
    const out: Part[] = []
    if (head === 'low') out.push(B(0, 0, 0.02, w, frameH, d - 0.04, 'wood'))
    else out.push(B(0, 0.1, 0.02, w, frameH - 0.1, d - 0.04, 'wood'), ...legs4(w, d - 0.04, 0.04, 0.1, 0.06, 'wood'))
    out.push(B(0, frameH, 0.04, w - 0.06, 0.2, d - 0.14, 'white'))
    out.push(B(0, frameH + 0.2, d * 0.15, w - 0.02, 0.05, d * 0.64, 'main'))
    const n = w > 1.3 ? 2 : 1
    const pw = (w - 0.2) / n - 0.06
    for (let i = 0; i < n; i++) out.push(B(-w / 2 + 0.13 + pw / 2 + i * (pw + 0.08), frameH + 0.2, -d / 2 + 0.3, pw, 0.12, 0.34, 'accent'))
    if (head === 'soft') out.push(B(0, 0, -d / 2 + 0.06, w + 0.06, h, 0.12, 'main'))
    else if (head === 'wood') out.push(B(0, 0, -d / 2 + 0.03, w, h, 0.06, 'wood'))
    else out.push(B(0, 0, -d / 2 + 0.03, w, Math.min(h, 0.7), 0.06, 'wood'))
    return out
  }
}

const bunk: Gen = (w, d, h) => {
  const out: Part[] = []
  const post = 0.07
  for (const x of [-w / 2 + post / 2, w / 2 - post / 2]) for (const z of [-d / 2 + post / 2, d / 2 - post / 2]) out.push(B(x, 0, z, post, h, post, 'wood'))
  for (const y of [0.25, h * 0.58]) {
    out.push(B(0, y, 0, w, 0.06, d, 'wood'))
    out.push(B(0, y + 0.06, 0, w - 0.1, 0.16, d - 0.1, 'white'))
    out.push(B(0, y + 0.22, d * 0.12, w - 0.08, 0.04, d * 0.6, 'main'))
  }
  out.push(B(0, h * 0.58 + 0.22, d / 2 - 0.03, w * 0.6, 0.2, 0.03, 'wood', undefined))
  out.push(B(0, h - 0.18, -d / 2 + 0.03, w - 0.1, 0.12, 0.03, 'wood'))
  for (let i = 1; i <= 4; i++) out.push(B(w / 2 - 0.25, (h * 0.58 * i) / 5, d / 2 + 0.02, 0.36, 0.03, 0.03, 'wood'))
  return out
}

function sofa(arm: 'square' | 'thin' | 'none', legs: 'wood' | 'metal' | 'none', seats: number): Gen {
  return (w, d, h) => {
    const legH = legs === 'none' ? 0.02 : 0.12
    const armW = arm === 'none' ? 0 : arm === 'thin' ? 0.09 : 0.18
    const out: Part[] = []
    out.push(B(0, legH, 0, w, 0.24, d, 'main'))
    out.push(B(0, legH, -d / 2 + 0.11, w, h - legH, 0.22, 'main'))
    if (armW) for (const s of [-1, 1]) out.push(B(s * (w / 2 - armW / 2), legH, 0.01, armW, 0.6 - legH, d - 0.02, 'main'))
    const inner = w - armW * 2
    const cw = inner / seats
    for (let i = 0; i < seats; i++) {
      const x = -inner / 2 + cw / 2 + i * cw
      out.push(B(x, legH + 0.24, 0.1, cw - 0.02, 0.13, d - 0.3, 'main'))
      out.push(B(x, legH + 0.37, -d / 2 + 0.3, cw - 0.04, Math.max(0.1, h - legH - 0.42), 0.17, 'main'))
    }
    if (seats > 1) for (const s of [-1, 1]) out.push(B(s * (inner / 2 - 0.2), legH + 0.4, -d / 2 + 0.42, 0.34, 0.32, 0.12, 'accent', [-0.25, 0, 0]))
    if (legs !== 'none') out.push(...legs4(w, d, 0.05, legH, 0.045, legs === 'metal' ? 'metal' : 'wood', 0, true))
    return out
  }
}

const lSofa: Gen = (w, d, h) => {
  const main = sofa('square', 'wood', 3)(w, 0.92, h).map((p) => ({ ...p, p: [p.p[0], p.p[1], p.p[2] - d / 2 + 0.46] as [number, number, number] }))
  const cw = 0.85
  return [
    ...main,
    B(w / 2 - 0.18 - cw / 2, 0.12, 0.46 - d / 2 + (d - 0.46) / 2 + 0.23, cw, 0.24, d - 0.92 + 0.02, 'main'),
    B(w / 2 - 0.18 - cw / 2, 0.36, 0.46 - d / 2 + (d - 0.46) / 2 + 0.25, cw - 0.04, 0.12, d - 0.95, 'main'),
    ...legs4(cw, 0.4, 0.04, 0.12, 0.045, 'wood').map((p) => ({ ...p, p: [p.p[0] + w / 2 - 0.18 - cw / 2, p.p[1], p.p[2] + d / 2 - 0.25] as [number, number, number] })),
  ]
}

const beanbag: Gen = (w, d, h) => [S(0, h * 0.42, 0, w / 2, h * 0.45, d / 2, 'main'), S(0, h * 0.62, -d * 0.2, w * 0.42, h * 0.38, d * 0.3, 'main')]
const ottoman: Gen = (w, d, h) => [B(0, 0.06, 0, w, h - 0.06, d, 'main'), ...legs4(w, d, 0.04, 0.06, 0.04, 'wood', 0, true)]
const pouf: Gen = (w, _d, h) => [C(0, 0, 0, w / 2, h, 'main', w / 2 - 0.02)]

function table(leg: 'wood' | 'metal' | 'trestle'): Gen {
  return (w, d, h) => {
    const top = 0.04
    const out = [B(0, h - top, 0, w, top, d, 'wood')]
    if (leg === 'trestle') {
      for (const s of [-1, 1]) {
        out.push(B(s * (w / 2 - 0.18), 0, 0, 0.05, h - top, 0.05, 'metal'))
        out.push(B(s * (w / 2 - 0.18), 0, 0, 0.06, 0.04, d - 0.12, 'metal'))
        out.push(B(s * (w / 2 - 0.18), h - top - 0.05, 0, 0.06, 0.05, d - 0.12, 'metal'))
      }
      out.push(B(0, 0.25, 0, w - 0.36, 0.04, 0.04, 'metal'))
    } else out.push(...legs4(w, d, 0.05, h - top, leg === 'metal' ? 0.035 : 0.06, leg === 'metal' ? 'metal' : 'wood', 0, leg === 'metal'))
    return out
  }
}

const roundTable: Gen = (w, _d, h) => [C(0, h - 0.04, 0, w / 2, 0.04, 'wood'), C(0, 0.03, 0, 0.05, h - 0.07, 'metal'), C(0, 0, 0, w * 0.24, 0.03, 'metal')]

const desk: Gen = (w, d, h) => {
  const out = [B(0, h - 0.03, 0, w, 0.03, d, 'wood'), B(-w / 2 + 0.21, 0, 0, 0.4, h - 0.03, d - 0.04, 'wood')]
  for (let i = 0; i < 3; i++) out.push(B(-w / 2 + 0.21, 0.04 + i * ((h - 0.1) / 3), d / 2 - 0.015, 0.37, (h - 0.1) / 3 - 0.02, 0.01, 'main'))
  out.push(B(w / 2 - 0.03, 0, 0, 0.04, h - 0.03, d - 0.04, 'metal'), B(w / 2 - 0.25, h - 0.18, -d / 2 + 0.03, w * 0.5, 0.12, 0.02, 'metal'))
  return out
}

const lDesk: Gen = (w, d, h) => {
  const dd = 0.6
  return [
    B(0, h - 0.03, -d / 2 + dd / 2, w, 0.03, dd, 'wood'),
    B(-w / 2 + dd / 2, h - 0.03, dd / 2, dd, 0.03, d - dd, 'wood'),
    B(w / 2 - 0.03, 0, -d / 2 + dd / 2, 0.04, h - 0.03, dd - 0.04, 'metal'),
    B(-w / 2 + dd / 2, 0, d / 2 - 0.03, dd - 0.04, h - 0.03, 0.04, 'metal'),
    B(-w / 2 + 0.03, 0, -d / 2 + 0.03, 0.04, h - 0.03, 0.04, 'metal'),
    B(-w / 2 + dd / 2 + 0.05, 0, -d / 2 + dd / 2, 0.4, h * 0.6, dd - 0.06, 'main'),
  ]
}

const coffeeTable: Gen = (w, d, h) => [B(0, h - 0.04, 0, w, 0.04, d, 'wood'), B(0, 0.1, 0, w - 0.1, 0.02, d - 0.1, 'wood'), ...legs4(w, d, 0.03, h - 0.04, 0.045, 'metal', 0, true)]
const roundCoffee: Gen = (w, _d, h) => [C(0, h - 0.04, 0, w / 2, 0.04, 'wood'), C(0, 0, 0, w / 2 - 0.03, 0.05, 'wood'), ...[0, 1, 2].map((i) => C(Math.cos((i * 2 * Math.PI) / 3) * w * 0.3, 0.05, Math.sin((i * 2 * Math.PI) / 3) * w * 0.3, 0.02, h - 0.09, 'metal'))]
const sideTable: Gen = (w, _d, h) => [C(0, h - 0.03, 0, w / 2, 0.03, 'wood'), C(0, 0.02, 0, 0.025, h - 0.05, 'metal'), C(0, 0, 0, w * 0.32, 0.02, 'metal')]

const vanity: Gen = (w, d, h) => [
  ...desk(w, d, 0.76),
  B(0, 0.76, -d / 2 + 0.03, w * 0.62, h - 0.76, 0.03, 'wood'),
  B(0, 0.8, -d / 2 + 0.05, w * 0.55, h - 0.84, 0.01, 'glass'),
]

const barTable: Gen = (w, _d, h) => [C(0, h - 0.04, 0, w / 2, 0.04, 'wood'), C(0, 0.03, 0, 0.04, h - 0.07, 'metal'), C(0, 0, 0, w * 0.32, 0.03, 'metal')]

function chair(kind: 'wood' | 'metal' | 'soft'): Gen {
  return (w, d, h) => {
    const seatH = 0.46
    const legC: Role = kind === 'metal' ? 'metal' : 'wood'
    const out: Part[] = [...legs4(w, d, 0.03, seatH - 0.04, kind === 'metal' ? 0.03 : 0.04, legC, 0, kind === 'metal')]
    if (kind === 'soft') {
      out.push(B(0, seatH - 0.08, 0.01, w, 0.1, d - 0.02, 'main'), B(0, seatH, -d / 2 + 0.05, w, h - seatH, 0.08, 'main', [-0.08, 0, 0]))
    } else {
      out.push(B(0, seatH - 0.04, 0, w, 0.04, d, kind === 'wood' ? 'wood' : 'main'))
      out.push(B(-w / 2 + 0.03, seatH, -d / 2 + 0.03, 0.035, h - seatH, 0.035, legC), B(w / 2 - 0.03, seatH, -d / 2 + 0.03, 0.035, h - seatH, 0.035, legC))
      out.push(B(0, h - 0.16, -d / 2 + 0.03, w - 0.04, 0.14, 0.025, kind === 'wood' ? 'wood' : 'main'))
      if (kind === 'wood') out.push(B(0, seatH + 0.08, -d / 2 + 0.03, w - 0.04, 0.06, 0.02, 'wood'))
    }
    return out
  }
}

const officeChair: Gen = (w, d, h) => {
  const out: Part[] = [
    B(0, 0.42, 0.02, w * 0.85, 0.09, d * 0.8, 'main'),
    B(0, 0.56, -d / 2 + 0.07, w * 0.8, h - 0.58, 0.08, 'main', [-0.1, 0, 0]),
    C(0, 0.1, 0, 0.03, 0.33, 'metal'),
    B(-w / 2 + 0.04, 0.6, 0.02, 0.05, 0.04, d * 0.45, 'dark'),
    B(w / 2 - 0.04, 0.6, 0.02, 0.05, 0.04, d * 0.45, 'dark'),
    B(-w / 2 + 0.04, 0.5, 0.02, 0.03, 0.1, 0.03, 'dark'),
    B(w / 2 - 0.04, 0.5, 0.02, 0.03, 0.1, 0.03, 'dark'),
  ]
  const L = Math.min(w, d) / 2 - 0.03
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5
    out.push(B(Math.sin(a) * L * 0.5, 0.05, Math.cos(a) * L * 0.5, 0.05, 0.04, L, 'metal', [0, a, 0]))
    out.push(S(Math.sin(a) * L, 0.03, Math.cos(a) * L, 0.03, 0.03, 0.03, 'dark'))
  }
  return out
}

const barStool: Gen = (w, _d, h) => [
  C(0, h - 0.06, 0, w / 2, 0.06, 'main'),
  C(0, 0.03, 0, 0.03, h - 0.09, 'metal'),
  C(0, 0, 0, w * 0.42, 0.03, 'metal'),
  C(0, h * 0.35, 0, w * 0.38, 0.02, 'metal', w * 0.38),
]
const stool: Gen = (w, _d, h) => [C(0, h - 0.04, 0, w / 2, 0.04, 'wood'), ...[0, 1, 2].map((i) => C(Math.cos((i * 2 * Math.PI) / 3) * w * 0.32, 0, Math.sin((i * 2 * Math.PI) / 3) * w * 0.32, 0.018, h - 0.04, 'wood'))]
const bench: Gen = (w, d, h) => [B(0, h - 0.05, 0, w, 0.05, d, 'wood'), B(-w / 2 + 0.08, 0, 0, 0.04, h - 0.05, d - 0.04, 'wood'), B(w / 2 - 0.08, 0, 0, 0.04, h - 0.05, d - 0.04, 'wood'), B(0, h - 0.04, 0.01, w - 0.06, 0.04, d - 0.06, 'main')]

function wardrobe(doors: number): Gen {
  return (w, d, h) => {
    const out: Part[] = [B(0, 0, 0, w, h, d, 'wood')]
    const dw = w / doors
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + dw / 2 + i * dw
      out.push(B(x, 0.06, d / 2 + 0.005, dw - 0.012, h - 0.1, 0.012, 'main'))
      const hx = x + (i % 2 === 0 ? dw / 2 - 0.06 : -dw / 2 + 0.06)
      out.push(B(hx, h * 0.45, d / 2 + 0.022, 0.018, 0.28, 0.02, 'metal'))
    }
    return out
  }
}

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const bookshelf: Gen = (w, d, h) => {
  const t = 0.022
  const out: Part[] = [B(-w / 2 + t / 2, 0, 0, t, h, d, 'wood'), B(w / 2 - t / 2, 0, 0, t, h, d, 'wood'), B(0, 0, -d / 2 + 0.005, w, h, 0.01, 'main')]
  const n = Math.max(2, Math.round(h / 0.36))
  const gap = (h - t) / n
  for (let i = 0; i <= n; i++) out.push(B(0, i * gap, 0, w - t * 2, t, d - 0.01, 'wood'))
  const roles: Role[] = ['accent', 'white', 'dark', 'accent', 'main']
  for (let i = 0; i < n; i++) {
    let x = -w / 2 + t + 0.03
    let k = 0
    while (x < w / 2 - t - 0.1 && k < 20) {
      const bw = 0.025 + hash(i * 31 + k) * 0.035
      const bh = gap * (0.55 + hash(i * 17 + k * 3) * 0.3)
      if (hash(i * 7 + k * 11) > 0.2) out.push(B(x + bw / 2, i * gap + t, 0.02, bw, bh, d * 0.7, roles[(i + k) % roles.length]))
      x += bw + 0.004
      k++
      if (hash(i * 13 + k) > 0.85) x += 0.12
    }
  }
  return out
}

const openShelf: Gen = (w, d, h) => {
  const out: Part[] = []
  for (const x of [-w / 2 + 0.015, w / 2 - 0.015]) for (const z of [-d / 2 + 0.015, d / 2 - 0.015]) out.push(C(x, 0, z, 0.012, h, 'metal'))
  const n = Math.max(3, Math.round(h / 0.4))
  for (let i = 0; i < n; i++) out.push(B(0, 0.08 + (i * (h - 0.11)) / (n - 1), 0, w, 0.025, d, 'wood'))
  for (let i = 0; i < n - 1; i++) {
    const y = 0.105 + (i * (h - 0.11)) / (n - 1)
    out.push(B(-w * 0.2, y, 0, 0.16, 0.12, d * 0.5, 'main'), S(w * 0.22, y + 0.06, 0, 0.06, 0.06, 0.06, 'accent'))
  }
  return out
}

const tvStand: Gen = (w, d, h) => {
  const out: Part[] = [B(0, 0.1, 0, w, h - 0.1, d, 'wood'), ...legs4(w, d, 0.05, 0.1, 0.035, 'metal', 0, true)]
  const n = w > 1.5 ? 3 : 2
  const dw = w / n
  for (let i = 0; i < n; i++) {
    out.push(B(-w / 2 + dw / 2 + i * dw, 0.13, d / 2 + 0.005, dw - 0.015, h - 0.16, 0.012, i === 1 && n === 3 ? 'wood' : 'main'))
    out.push(B(-w / 2 + dw / 2 + i * dw, h - 0.07, d / 2 + 0.02, 0.12, 0.012, 0.012, 'metal'))
  }
  return out
}

function drawers(rows: number, cols = 1, legH = 0.08): Gen {
  return (w, d, h) => {
    const out: Part[] = [B(0, legH, 0, w, h - legH, d, 'wood'), ...legs4(w, d, 0.04, legH, 0.04, 'wood', 0, true)]
    const rh = (h - legH - 0.04) / rows
    const cw = (w - 0.03) / cols
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + 0.015 + cw / 2 + c * cw
        const y = legH + 0.02 + r * rh
        out.push(B(x, y + 0.006, d / 2 + 0.005, cw - 0.012, rh - 0.012, 0.012, 'main'))
        out.push(B(x, y + rh / 2 - 0.006, d / 2 + 0.02, Math.min(0.14, cw * 0.4), 0.014, 0.014, 'metal'))
      }
    return out
  }
}

const shoeCabinet: Gen = (w, d, h) => {
  const out: Part[] = [B(0, 0.06, 0, w, h - 0.06, d, 'wood'), B(0, 0, 0, w - 0.04, 0.06, d - 0.04, 'dark')]
  const n = 3
  const rh = (h - 0.08) / n
  for (let i = 0; i < n; i++) {
    out.push(B(0, 0.07 + i * rh, d / 2 + 0.005, w - 0.02, rh - 0.012, 0.012, 'main', [-0.04, 0, 0]))
    out.push(C(0, 0.07 + i * rh + rh * 0.8, d / 2 + 0.025, 0.012, 0.02, 'metal', 0.012, [Math.PI / 2, 0, 0]))
  }
  return out
}

const displayCabinet: Gen = (w, d, h) => {
  const out: Part[] = [B(0, 0, 0, w, 0.08, d, 'wood'), B(0, h - 0.04, 0, w, 0.04, d, 'wood'), B(-w / 2 + 0.02, 0, 0, 0.04, h, d, 'wood'), B(w / 2 - 0.02, 0, 0, 0.04, h, d, 'wood'), B(0, 0, -d / 2 + 0.01, w, h, 0.02, 'main')]
  for (let i = 1; i <= 3; i++) {
    const y = 0.08 + (i * (h - 0.12)) / 4
    out.push(B(0, y, 0, w - 0.08, 0.015, d - 0.04, 'glass'))
    out.push(C(-w * 0.2, y + 0.015, 0, 0.04, 0.14, 'accent'), C(w * 0.15, y + 0.015, 0, 0.05, 0.08, 'white'))
  }
  out.push(B(0, 0.08, d / 2 - 0.01, w - 0.08, h - 0.12, 0.01, 'glass'))
  return out
}

const toyBox: Gen = (w, d, h) => [B(0, 0, 0, w, h - 0.04, d, 'main'), B(0, h - 0.04, 0, w + 0.02, 0.04, d + 0.02, 'wood'), B(0, h * 0.55, d / 2 + 0.01, 0.12, 0.05, 0.02, 'accent')]

const clothesRack: Gen = (w, d, h) => {
  const out: Part[] = [B(-w / 2 + 0.02, 0, 0, 0.04, 0.03, d, 'metal'), B(w / 2 - 0.02, 0, 0, 0.04, 0.03, d, 'metal'), C(-w / 2 + 0.02, 0.03, 0, 0.014, h - 0.03, 'metal'), C(w / 2 - 0.02, 0.03, 0, 0.014, h - 0.03, 'metal'), B(0, h - 0.03, 0, w, 0.025, 0.025, 'metal'), B(0, 0.12, 0, w - 0.04, 0.02, d * 0.8, 'wood')]
  const roles: Role[] = ['main', 'accent', 'white', 'main', 'dark']
  for (let i = 0; i < 5; i++) out.push(B(-w / 2 + 0.2 + (i * (w - 0.4)) / 4, h - 0.75, 0, 0.04, 0.68, d * 0.75, roles[i]))
  return out
}

const floorLamp: Gen = (w, _d, h) => [C(0, 0, 0, w * 0.4, 0.03, 'metal'), C(0, 0.03, 0, 0.012, h - 0.35, 'metal'), C(0, h - 0.34, 0, w * 0.32, 0.32, 'main', w / 2), S(0, h - 0.2, 0, 0.05, 0.05, 0.05, 'light')]
const tripodLamp: Gen = (w, _d, h) => [
  ...[0, 1, 2].map((i) => {
    const a = (i * 2 * Math.PI) / 3
    return C(Math.cos(a) * w * 0.18, 0, Math.sin(a) * w * 0.18, 0.012, h - 0.3, 'wood', 0.012, [Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18])
  }),
  C(0, h - 0.36, 0, w / 2, 0.34, 'main', w / 2),
  S(0, h - 0.22, 0, 0.05, 0.05, 0.05, 'light'),
]
const arcLamp: Gen = (w, d, h) => {
  const bx = -w / 2 + 0.15
  return [
    B(bx, 0, 0, 0.28, 0.06, Math.min(d, 0.28), 'white'),
    C(bx, 0.06, 0, 0.012, h * 0.55, 'metal'),
    C(bx + w * 0.18, h * 0.55, 0, 0.012, h * 0.35, 'metal', 0.012, [0, 0, -0.6]),
    C(bx + w * 0.45, h * 0.82, 0, 0.012, w * 0.35, 'metal', 0.012, [0, 0, -1.3]),
    S(w / 2 - 0.2, h - 0.18, 0, 0.2, 0.14, 0.2, 'main'),
    S(w / 2 - 0.2, h - 0.26, 0, 0.06, 0.04, 0.06, 'light'),
  ]
}

function plant(shape: 'bush' | 'tall' | 'cactus' | 'snake' | 'monstera'): Gen {
  return (w, _d, h) => {
    const r = w / 2
    const potH = Math.min(0.4, h * 0.3)
    const out: Part[] = [C(0, 0, 0, r * 0.8, potH, 'pot', r * 0.62), C(0, potH - 0.02, 0, r * 0.74, 0.02, 'dark')]
    if (shape === 'bush') {
      for (let i = 0; i < 7; i++) {
        const a = i * 1.3
        out.push(S(Math.cos(a) * r * 0.45, potH + (h - potH) * (0.35 + hash(i) * 0.35), Math.sin(a) * r * 0.45, r * 0.55, (h - potH) * 0.32, r * 0.55, 'leaf'))
      }
    } else if (shape === 'tall') {
      out.push(C(0, potH, 0, 0.02, (h - potH) * 0.55, 'wood'))
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05
        out.push(S(Math.cos(a) * r * 0.5, potH + (h - potH) * (0.55 + hash(i + 3) * 0.3), Math.sin(a) * r * 0.5, r * 0.6, (h - potH) * 0.22, r * 0.6, 'leaf'))
      }
    } else if (shape === 'cactus') {
      out.push(C(0, potH, 0, r * 0.35, h - potH, 'leaf', r * 0.4))
      out.push(C(r * 0.42, potH + (h - potH) * 0.35, 0, r * 0.16, (h - potH) * 0.4, 'leaf'), C(-r * 0.4, potH + (h - potH) * 0.5, 0, r * 0.14, (h - potH) * 0.3, 'leaf'))
    } else if (shape === 'snake') {
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8
        out.push(B(Math.cos(a) * r * 0.3, potH, Math.sin(a) * r * 0.3, 0.05, (h - potH) * (0.6 + hash(i + 9) * 0.4), 0.012, 'leaf', [(hash(i) - 0.5) * 0.3, a, (hash(i + 1) - 0.5) * 0.3]))
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7
        const y = potH + (h - potH) * (0.3 + hash(i + 5) * 0.6)
        out.push(C(Math.cos(a) * r * 0.25, potH, Math.sin(a) * r * 0.25, 0.008, y - potH, 'leaf'))
        out.push(S(Math.cos(a) * r * 0.55, y, Math.sin(a) * r * 0.55, r * 0.35, 0.02, r * 0.28, 'leaf'))
      }
    }
    return out
  }
}

const rugRect: Gen = (w, d) => [B(0, 0, 0, w, 0.008, d, 'accent'), B(0, 0.008, 0, w - 0.12, 0.006, d - 0.12, 'main')]
const rugRound: Gen = (w) => [C(0, 0, 0, w / 2, 0.008, 'accent'), C(0, 0.008, 0, w / 2 - 0.06, 0.006, 'main')]
const rugRunner: Gen = (w, d) => {
  const out = [B(0, 0, 0, w, 0.01, d, 'main')]
  for (let i = 0; i < 5; i++) out.push(B(-w / 2 + ((i + 0.5) * w) / 5, 0.01, 0, 0.06, 0.003, d - 0.1, 'accent'))
  return out
}

const floorMirror: Gen = (w, d, h) => [B(0, 0, 0, w, h, 0.04, 'wood', [-0.12, 0, 0]), B(0, 0.04, 0.025, w - 0.08, h - 0.08, 0.01, 'glass', [-0.12, 0, 0]), B(0, 0, -d / 2 + 0.03, 0.04, h * 0.5, 0.04, 'wood', [0.4, 0, 0])]

const tv: Gen = (w, d, h) => [B(0, 0, 0, w * 0.4, 0.02, d, 'dark'), B(0, 0.02, -d * 0.1, 0.06, 0.12, 0.04, 'dark'), B(0, 0.12, 0, w, h - 0.12, 0.05, 'dark'), B(0, 0.135, 0.026, w - 0.03, h - 0.15, 0.002, 'screen')]
const fridge: Gen = (w, d, h) => [B(0, 0, 0, w, h, d, 'main'), B(0, h * 0.62, d / 2 + 0.002, w - 0.01, 0.008, 0.004, 'dark'), B(-w / 2 + 0.06, h * 0.68, d / 2 + 0.03, 0.025, h * 0.22, 0.03, 'metal'), B(-w / 2 + 0.06, h * 0.32, d / 2 + 0.03, 0.025, h * 0.22, 0.03, 'metal')]
const washer: Gen = (w, d, h) => [B(0, 0, 0, w, h, d, 'main'), C(0, h * 0.42, d / 2, w * 0.3, 0.02, 'glass', w * 0.3, [Math.PI / 2, 0, 0]), C(0, h * 0.42, d / 2 - 0.004, w * 0.34, 0.02, 'metal', w * 0.34, [Math.PI / 2, 0, 0]), B(0, h - 0.12, d / 2 + 0.002, w - 0.04, 0.1, 0.006, 'dark')]
const piano: Gen = (w, d, h) => [B(0, 0, -d * 0.15, w, h, d * 0.7, 'main'), B(0, 0.68, d * 0.25, w - 0.08, 0.06, d * 0.4, 'main'), B(0, 0.74, d * 0.22, w - 0.14, 0.02, d * 0.22, 'white'), B(-w / 2 + 0.04, 0, d * 0.25, 0.06, 0.68, 0.06, 'main'), B(w / 2 - 0.04, 0, d * 0.25, 0.06, 0.68, 0.06, 'main')]
const purifier: Gen = (w, d, h) => [B(0, 0, 0, w, h, d, 'main'), B(0, h - 0.01, 0, w - 0.06, 0.012, d - 0.06, 'dark'), S(0, h * 0.75, d / 2 + 0.002, 0.03, 0.03, 0.005, 'light')]
const standFan: Gen = (w, _d, h) => [C(0, 0, 0, w * 0.4, 0.03, 'main'), C(0, 0.03, 0, 0.015, h - 0.25, 'main'), C(0, h - 0.22, 0, w / 2, 0.08, 'white', w / 2, [Math.PI / 2, 0, 0]), C(0, h - 0.22, 0.05, 0.05, 0.05, 'main', 0.05, [Math.PI / 2, 0, 0])]

const bathtub: Gen = (w, d, h) => [B(0, 0, 0, w, 0.08, d, 'main'), B(0, 0, -d / 2 + 0.04, w, h, 0.08, 'main'), B(0, 0, d / 2 - 0.04, w, h, 0.08, 'main'), B(-w / 2 + 0.04, 0, 0, 0.08, h, d, 'main'), B(w / 2 - 0.04, 0, 0, 0.08, h, d, 'main'), B(0, 0.08, 0, w - 0.16, 0.01, d - 0.16, 'white'), C(w / 2 - 0.05, h, 0, 0.02, 0.14, 'metal')]
const toilet: Gen = (w, d, h) => [C(0, 0, d * 0.1, w * 0.3, 0.38, 'main', w * 0.24), S(0, 0.4, d * 0.12, w * 0.45, 0.04, d * 0.38, 'main'), B(0, 0.35, -d / 2 + 0.1, w, h - 0.35, 0.18, 'main'), B(0, h - 0.01, -d / 2 + 0.1, w * 0.3, 0.015, 0.05, 'metal')]
const basinCabinet: Gen = (w, d, h) => [B(0, 0.1, 0, w, h - 0.14, d, 'wood'), B(0, 0.12, d / 2 + 0.005, w - 0.02, h - 0.2, 0.012, 'main'), B(0, h - 0.04, 0, w, 0.04, d, 'white'), S(0, h - 0.02, 0.02, w * 0.3, 0.04, d * 0.3, 'white'), C(0, h, -d / 2 + 0.06, 0.015, 0.2, 'metal'), C(0, h + 0.18, -d / 2 + 0.12, 0.012, 0.12, 'metal', 0.012, [Math.PI / 2, 0, 0])]

type Kind = {
  kind: string
  name: string
  category: string
  size: [number, number, number]
  gen: Gen
  soft?: boolean
  mainLabel?: string
  styles?: StyleKey[]
  fixedColors?: Partial<Record<Role, string>>
}

type StyleKey = 'nordic' | 'modern' | 'industrial' | 'japanese' | 'luxury' | 'cute'

const ALL: StyleKey[] = ['nordic', 'modern', 'industrial', 'japanese', 'luxury', 'cute']

export const KINDS: Kind[] = [
  { kind: 'bed-single-wood', name: '單人床・木作床頭', category: '床', size: [1.0, 2.0, 0.95], gen: bed('wood'), soft: true },
  { kind: 'bed-single-soft', name: '單人床・軟包床頭', category: '床', size: [1.05, 2.05, 1.05], gen: bed('soft'), soft: true },
  { kind: 'bed-double-wood', name: '雙人床・木作床頭', category: '床', size: [1.5, 2.05, 1.0], gen: bed('wood'), soft: true },
  { kind: 'bed-double-soft', name: '雙人床・軟包床頭', category: '床', size: [1.55, 2.1, 1.15], gen: bed('soft'), soft: true },
  { kind: 'bed-queen-soft', name: '加大雙人床', category: '床', size: [1.7, 2.15, 1.2], gen: bed('soft'), soft: true },
  { kind: 'bed-king-wood', name: '特大雙人床', category: '床', size: [1.95, 2.15, 1.1], gen: bed('wood'), soft: true },
  { kind: 'bed-low', name: '和室低床', category: '床', size: [1.5, 2.05, 0.6], gen: bed('low'), soft: true, styles: ['nordic', 'japanese', 'modern'] },
  { kind: 'bed-bunk', name: '上下舖', category: '床', size: [1.05, 2.05, 1.7], gen: bunk, soft: true, styles: ['nordic', 'cute', 'industrial'] },
  { kind: 'sofa-1', name: '單人沙發', category: '沙發', size: [0.85, 0.85, 0.82], gen: sofa('square', 'wood', 1), soft: true },
  { kind: 'sofa-1-thin', name: '單人沙發・細扶手', category: '沙發', size: [0.75, 0.8, 0.8], gen: sofa('thin', 'metal', 1), soft: true },
  { kind: 'sofa-2', name: '雙人沙發', category: '沙發', size: [1.5, 0.88, 0.82], gen: sofa('square', 'wood', 2), soft: true },
  { kind: 'sofa-2-thin', name: '雙人沙發・細扶手', category: '沙發', size: [1.4, 0.82, 0.8], gen: sofa('thin', 'metal', 2), soft: true },
  { kind: 'sofa-3', name: '三人沙發', category: '沙發', size: [2.1, 0.92, 0.84], gen: sofa('square', 'wood', 3), soft: true },
  { kind: 'sofa-3-low', name: '三人沙發・落地款', category: '沙發', size: [2.2, 0.98, 0.75], gen: sofa('square', 'none', 3), soft: true },
  { kind: 'sofa-4', name: '四人沙發', category: '沙發', size: [2.6, 0.95, 0.84], gen: sofa('thin', 'wood', 4), soft: true },
  { kind: 'sofa-l', name: 'L 型沙發', category: '沙發', size: [2.6, 1.65, 0.84], gen: lSofa, soft: true },
  { kind: 'sofa-armless', name: '無扶手沙發', category: '沙發', size: [1.6, 0.85, 0.78], gen: sofa('none', 'metal', 2), soft: true },
  { kind: 'beanbag', name: '懶骨頭', category: '沙發', size: [0.85, 0.85, 0.75], gen: beanbag, soft: true },
  { kind: 'ottoman', name: '方形腳凳', category: '沙發', size: [0.6, 0.6, 0.42], gen: ottoman, soft: true },
  { kind: 'pouf', name: '圓形坐墩', category: '沙發', size: [0.5, 0.5, 0.42], gen: pouf, soft: true },
  { kind: 'table-dining-4', name: '四人餐桌', category: '桌', size: [1.2, 0.8, 0.75], gen: table('wood'), mainLabel: '主色' },
  { kind: 'table-dining-6', name: '六人餐桌', category: '桌', size: [1.8, 0.9, 0.75], gen: table('trestle'), mainLabel: '主色' },
  { kind: 'table-metal', name: '鐵腳桌', category: '桌', size: [1.4, 0.75, 0.75], gen: table('metal'), mainLabel: '主色' },
  { kind: 'table-round', name: '圓餐桌', category: '桌', size: [1.0, 1.0, 0.75], gen: roundTable, mainLabel: '主色' },
  { kind: 'desk', name: '書桌', category: '桌', size: [1.2, 0.6, 0.75], gen: desk, mainLabel: '抽屜' },
  { kind: 'desk-l', name: 'L 型電腦桌', category: '桌', size: [1.5, 1.3, 0.75], gen: lDesk, mainLabel: '抽屜櫃' },
  { kind: 'coffee-table', name: '茶几', category: '桌', size: [1.1, 0.6, 0.42], gen: coffeeTable, mainLabel: '主色' },
  { kind: 'coffee-round', name: '圓茶几', category: '桌', size: [0.8, 0.8, 0.4], gen: roundCoffee, mainLabel: '主色' },
  { kind: 'side-table', name: '邊几', category: '桌', size: [0.45, 0.45, 0.55], gen: sideTable, mainLabel: '主色' },
  { kind: 'vanity', name: '化妝台', category: '桌', size: [1.0, 0.45, 1.45], gen: vanity, mainLabel: '抽屜' },
  { kind: 'bar-table', name: '吧台桌', category: '桌', size: [0.65, 0.65, 1.05], gen: barTable, mainLabel: '主色' },
  { kind: 'chair-wood', name: '木餐椅', category: '椅', size: [0.45, 0.5, 0.85], gen: chair('wood'), mainLabel: '主色' },
  { kind: 'chair-metal', name: '鐵件餐椅', category: '椅', size: [0.45, 0.5, 0.85], gen: chair('metal'), mainLabel: '椅面' },
  { kind: 'chair-soft', name: '布面餐椅', category: '椅', size: [0.5, 0.55, 0.9], gen: chair('soft'), soft: true },
  { kind: 'chair-office', name: '辦公椅', category: '椅', size: [0.62, 0.62, 1.1], gen: officeChair, soft: true },
  { kind: 'stool-bar', name: '吧台椅', category: '椅', size: [0.4, 0.4, 0.75], gen: barStool, soft: true },
  { kind: 'stool', name: '三腳圓凳', category: '椅', size: [0.35, 0.35, 0.45], gen: stool, mainLabel: '主色' },
  { kind: 'bench', name: '長凳', category: '椅', size: [1.2, 0.38, 0.45], gen: bench, soft: true },
  { kind: 'wardrobe-2', name: '雙門衣櫃', category: '櫃', size: [1.0, 0.6, 2.0], gen: wardrobe(2), mainLabel: '門板' },
  { kind: 'wardrobe-3', name: '三門衣櫃', category: '櫃', size: [1.5, 0.6, 2.1], gen: wardrobe(3), mainLabel: '門板' },
  { kind: 'wardrobe-4', name: '四門大衣櫃', category: '櫃', size: [2.0, 0.6, 2.2], gen: wardrobe(4), mainLabel: '門板' },
  { kind: 'bookshelf', name: '書櫃', category: '櫃', size: [0.9, 0.32, 1.9], gen: bookshelf, mainLabel: '背板' },
  { kind: 'bookshelf-low', name: '矮書櫃', category: '櫃', size: [1.2, 0.32, 0.9], gen: bookshelf, mainLabel: '背板' },
  { kind: 'shelf-open', name: '開放式層架', category: '櫃', size: [0.9, 0.4, 1.8], gen: openShelf, mainLabel: '收納盒' },
  { kind: 'tv-stand', name: '電視櫃', category: '櫃', size: [1.6, 0.42, 0.5], gen: tvStand, mainLabel: '門板' },
  { kind: 'tv-stand-long', name: '長版電視櫃', category: '櫃', size: [2.2, 0.42, 0.45], gen: tvStand, mainLabel: '門板' },
  { kind: 'dresser', name: '五斗櫃', category: '櫃', size: [0.8, 0.45, 1.15], gen: drawers(5), mainLabel: '抽屜' },
  { kind: 'dresser-wide', name: '六抽斗櫃', category: '櫃', size: [1.2, 0.45, 0.85], gen: drawers(3, 2), mainLabel: '抽屜' },
  { kind: 'nightstand', name: '床頭櫃', category: '櫃', size: [0.45, 0.4, 0.55], gen: drawers(2, 1, 0.1), mainLabel: '抽屜' },
  { kind: 'shoe-cabinet', name: '鞋櫃', category: '櫃', size: [0.9, 0.3, 1.1], gen: shoeCabinet, mainLabel: '門板' },
  { kind: 'display-cabinet', name: '玻璃展示櫃', category: '櫃', size: [0.8, 0.4, 1.8], gen: displayCabinet, mainLabel: '背板' },
  { kind: 'sideboard', name: '餐邊櫃', category: '櫃', size: [1.4, 0.45, 0.85], gen: drawers(2, 3, 0.15), mainLabel: '抽屜' },
  { kind: 'toy-box', name: '收納箱', category: '櫃', size: [0.7, 0.45, 0.5], gen: toyBox, mainLabel: '主色' },
  { kind: 'clothes-rack', name: '吊衣架', category: '櫃', size: [1.2, 0.45, 1.6], gen: clothesRack, mainLabel: '衣服' },
  { kind: 'lamp-floor', name: '落地燈', category: '燈', size: [0.4, 0.4, 1.6], gen: floorLamp, mainLabel: '燈罩' },
  { kind: 'lamp-tripod', name: '三腳落地燈', category: '燈', size: [0.5, 0.5, 1.55], gen: tripodLamp, mainLabel: '燈罩' },
  { kind: 'lamp-arc', name: '弧形落地燈', category: '燈', size: [1.3, 0.35, 1.9], gen: arcLamp, mainLabel: '燈罩' },
  { kind: 'plant-bush', name: '桌上型盆栽', category: '植物', size: [0.4, 0.4, 0.55], gen: plant('bush'), mainLabel: '主色' },
  { kind: 'plant-tall', name: '大型盆栽', category: '植物', size: [0.6, 0.6, 1.6], gen: plant('tall'), mainLabel: '主色' },
  { kind: 'plant-cactus', name: '仙人掌', category: '植物', size: [0.35, 0.35, 0.8], gen: plant('cactus'), mainLabel: '主色' },
  { kind: 'plant-snake', name: '虎尾蘭', category: '植物', size: [0.35, 0.35, 0.9], gen: plant('snake'), mainLabel: '主色' },
  { kind: 'plant-monstera', name: '龜背芋', category: '植物', size: [0.7, 0.7, 1.2], gen: plant('monstera'), mainLabel: '主色' },
  { kind: 'rug-rect', name: '長方形地毯', category: '地毯', size: [2.0, 1.4, 0.015], gen: rugRect, soft: true },
  { kind: 'rug-large', name: '大地毯', category: '地毯', size: [2.4, 1.7, 0.015], gen: rugRect, soft: true },
  { kind: 'rug-round', name: '圓形地毯', category: '地毯', size: [1.5, 1.5, 0.015], gen: rugRound, soft: true },
  { kind: 'rug-runner', name: '走道地毯', category: '地毯', size: [0.7, 2.0, 0.015], gen: rugRunner, soft: true },
  { kind: 'mirror-floor', name: '立鏡', category: '裝飾', size: [0.55, 0.4, 1.6], gen: floorMirror, mainLabel: '主色' },
  { kind: 'tv-55', name: '55 吋電視', category: '家電', size: [1.24, 0.25, 0.8], gen: tv, styles: ['modern'], fixedColors: { dark: '#1b1b1d' } },
  { kind: 'tv-65', name: '65 吋電視', category: '家電', size: [1.46, 0.3, 0.92], gen: tv, styles: ['modern'], fixedColors: { dark: '#1b1b1d' } },
  { kind: 'fridge', name: '雙門冰箱', category: '家電', size: [0.7, 0.7, 1.75], gen: fridge, mainLabel: '外殼', styles: ['modern', 'nordic', 'cute'] },
  { kind: 'washer', name: '滾筒洗衣機', category: '家電', size: [0.6, 0.6, 0.85], gen: washer, mainLabel: '外殼', styles: ['modern', 'nordic'] },
  { kind: 'piano', name: '直立式鋼琴', category: '家電', size: [1.5, 0.6, 1.25], gen: piano, mainLabel: '琴身', styles: ['modern', 'luxury', 'nordic'] },
  { kind: 'purifier', name: '空氣清淨機', category: '家電', size: [0.35, 0.35, 0.65], gen: purifier, mainLabel: '外殼', styles: ['modern', 'nordic'] },
  { kind: 'fan', name: '立扇', category: '家電', size: [0.4, 0.4, 1.2], gen: standFan, mainLabel: '主色', styles: ['modern', 'nordic', 'cute'] },
  { kind: 'bathtub', name: '浴缸', category: '衛浴', size: [1.6, 0.75, 0.55], gen: bathtub, mainLabel: '外殼', styles: ['modern', 'nordic', 'luxury'] },
  { kind: 'toilet', name: '馬桶', category: '衛浴', size: [0.4, 0.68, 0.78], gen: toilet, mainLabel: '主色', styles: ['modern', 'nordic'] },
  { kind: 'basin-cabinet', name: '浴櫃洗手台', category: '衛浴', size: [0.8, 0.48, 0.85], gen: basinCabinet, mainLabel: '門板', styles: ['modern', 'nordic', 'japanese', 'luxury'] },
]

type Palette = {
  name: string
  wood: string
  metal: string
  accent: string
  pot: string
  leaf: string
  fabrics: [string, string][]
  paints: [string, string][]
}

export const PALETTES: Record<StyleKey, Palette> = {
  nordic: {
    name: '北歐',
    wood: '#d9bf94',
    metal: '#2d2d2d',
    accent: '#e2b48a',
    pot: '#ebe7df',
    leaf: '#5f8a5a',
    fabrics: [
      ['淺灰', '#c8c6c1'],
      ['米白', '#e9e2d3'],
      ['灰綠', '#9fb0a8'],
    ],
    paints: [
      ['白', '#f2f0eb'],
      ['原木', '#d9bf94'],
    ],
  },
  modern: {
    name: '現代',
    wood: '#4a4542',
    metal: '#1c1c1e',
    accent: '#c0c4ca',
    pot: '#2f3033',
    leaf: '#4c7a4a',
    fabrics: [
      ['深灰', '#5c6066'],
      ['黑', '#2b2c30'],
      ['霧藍', '#7d8fa3'],
    ],
    paints: [
      ['霧黑', '#2f3033'],
      ['白', '#ededed'],
    ],
  },
  industrial: {
    name: '工業',
    wood: '#7a5536',
    metal: '#151515',
    accent: '#b7793f',
    pot: '#5b5f63',
    leaf: '#55704a',
    fabrics: [
      ['焦糖皮', '#8b5a2b'],
      ['炭灰', '#45474b'],
    ],
    paints: [
      ['鐵灰', '#4b4f54'],
      ['舊木', '#7a5536'],
    ],
  },
  japanese: {
    name: '日式',
    wood: '#c9a475',
    metal: '#5a4532',
    accent: '#7c8c5c',
    pot: '#b9a58a',
    leaf: '#6b8f5e',
    fabrics: [
      ['亞麻', '#e6dcc8'],
      ['抹茶', '#9fae84'],
    ],
    paints: [
      ['原木', '#d8bb8f'],
      ['米白', '#efe8da'],
    ],
  },
  luxury: {
    name: '奢華',
    wood: '#4b2b1c',
    metal: '#c8a24a',
    accent: '#c8a24a',
    pot: '#2b2b2b',
    leaf: '#3f6b48',
    fabrics: [
      ['海軍藍', '#1f3557'],
      ['墨綠', '#244d42'],
      ['酒紅', '#6e1f2b'],
    ],
    paints: [
      ['胡桃', '#5a3524'],
      ['象牙白', '#efe6d2'],
    ],
  },
  cute: {
    name: '可愛',
    wood: '#f1e2cf',
    metal: '#f7f7f7',
    accent: '#ffb3c1',
    pot: '#fde2e4',
    leaf: '#7fb77e',
    fabrics: [
      ['櫻花粉', '#f6c3cf'],
      ['薄荷', '#bfe3d6'],
      ['奶油黃', '#fbe3a6'],
    ],
    paints: [
      ['粉', '#f8d5dd'],
      ['薄荷', '#cdebe1'],
    ],
  },
}

export const ROLE_DEFAULTS: Record<Role, string> = {
  main: '#cccccc',
  wood: '#c8a27a',
  metal: '#333333',
  accent: '#e5b98f',
  white: '#f5f3ef',
  dark: '#2a2a2a',
  glass: '#cfe8f3',
  light: '#fff3c4',
  leaf: '#5f8a5a',
  pot: '#e8e4dc',
  screen: '#0f1720',
}

export const ROLE_LABEL: Partial<Record<Role, string>> = {
  main: '主色',
  wood: '木頭／框架',
  metal: '金屬',
  accent: '點綴',
  leaf: '葉子',
  pot: '花盆',
  white: '白色部分',
}

export const EDITABLE_ROLES: Role[] = ['main', 'wood', 'metal', 'accent', 'leaf', 'pot', 'white']

export const SWATCHES = [
  '#f5f3ef', '#e9e2d3', '#c8c6c1', '#9ca3af', '#5c6066', '#2b2c30',
  '#d9bf94', '#c9a475', '#a87b4f', '#7a5536', '#4b2b1c', '#c8a24a',
  '#f6c3cf', '#e57373', '#6e1f2b', '#fbe3a6', '#f2a65a', '#b7793f',
  '#bfe3d6', '#9fb0a8', '#5f8a5a', '#244d42', '#7d8fa3', '#1f3557',
]

const KIND_MAP = new Map(KINDS.map((k) => [k.kind, k]))

export function proceduralParts(kind: string, size: { width: number; depth: number; height: number }) {
  const k = KIND_MAP.get(kind)
  if (!k) return []
  return k.gen(size.width, size.depth, size.height)
}

export function kindInfo(kind: string) {
  return KIND_MAP.get(kind)
}

export function rolesOf(kind: string) {
  const k = KIND_MAP.get(kind)
  if (!k) return []
  const used = new Set(k.gen(k.size[0], k.size[1], k.size[2]).map((p) => p.c))
  return EDITABLE_ROLES.filter((r) => used.has(r))
}

export function roleLabel(kind: string, role: Role) {
  if (role === 'main') {
    const k = KIND_MAP.get(kind)
    return k?.mainLabel ?? (k?.soft ? '布料' : '主色')
  }
  return ROLE_LABEL[role] ?? role
}

function buildCatalog(): CatalogItem[] {
  const out: CatalogItem[] = []
  for (const k of KINDS) {
    const styles = k.styles ?? ALL
    for (const sk of styles) {
      const pal = PALETTES[sk]
      const variants = k.soft ? pal.fabrics : pal.paints
      variants.forEach(([label, color], vi) => {
        if (!k.soft && vi > 0 && (k.category === '植物' || k.category === '家電' || k.category === '燈')) return
        const [w, d, h] = k.size
        const colors: Record<string, string> = { main: color, wood: pal.wood, metal: pal.metal, accent: pal.accent, pot: pal.pot, leaf: pal.leaf, ...k.fixedColors }
        if (k.category === '植物') colors.main = pal.pot
        if (k.kind.startsWith('rug')) colors.accent = vi === 0 ? pal.accent : pal.wood
        out.push({
          id: `gen/${k.kind}/${sk}/${vi}`,
          name: `${k.name}・${pal.name}${variants.length > 1 && !(k.category === '植物' || k.category === '家電' || k.category === '燈') ? label : ''}`,
          category: k.category,
          styles: [pal.name],
          source: '本站自製（程式生成）',
          license: 'CC0 1.0',
          file: '',
          size: { width: w, depth: d, height: h },
          rawSize: { width: w, depth: d, height: h },
          rawMin: { x: -w / 2, y: 0, z: -d / 2 },
          scale: 1,
          procedural: { kind: k.kind, colors },
        })
      })
    }
  }
  return out
}

export const PROCEDURAL_CATALOG = buildCatalog()
