import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'

const CORNERS: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

export type MeshData = { positions: Float32Array; colors: Float32Array; indices: Uint32Array }

export function marchingCubes(field: Float32Array, rgb: Float32Array, n: number, iso: number): MeshData {
  const idx = (x: number, y: number, z: number) => (x * n + y) * n + z
  const coord = (i: number) => (i / (n - 1)) * 2 - 1
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const edgeVertex = new Map<number, number>()
  const ids = new Int32Array(12)

  const vertexOn = (cx: number, cy: number, cz: number, e: number) => {
    const [a, b] = EDGES[e]
    const ca = CORNERS[a]
    const cb = CORNERS[b]
    const sx = cx + Math.min(ca[0], cb[0])
    const sy = cy + Math.min(ca[1], cb[1])
    const sz = cz + Math.min(ca[2], cb[2])
    const axis = ca[0] !== cb[0] ? 0 : ca[1] !== cb[1] ? 1 : 2
    const key = idx(sx, sy, sz) * 3 + axis
    const found = edgeVertex.get(key)
    if (found !== undefined) return found
    const ia = idx(cx + ca[0], cy + ca[1], cz + ca[2])
    const ib = idx(cx + cb[0], cy + cb[1], cz + cb[2])
    const va = field[ia]
    const vb = field[ib]
    const t = Math.abs(vb - va) < 1e-12 ? 0.5 : (iso - va) / (vb - va)
    const ax = coord(cx + ca[0])
    const ay = coord(cy + ca[1])
    const az = coord(cz + ca[2])
    const bx = coord(cx + cb[0])
    const by = coord(cy + cb[1])
    const bz = coord(cz + cb[2])
    const vi = positions.length / 3
    positions.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)
    colors.push(
      rgb[ia * 3] + (rgb[ib * 3] - rgb[ia * 3]) * t,
      rgb[ia * 3 + 1] + (rgb[ib * 3 + 1] - rgb[ia * 3 + 1]) * t,
      rgb[ia * 3 + 2] + (rgb[ib * 3 + 2] - rgb[ia * 3 + 2]) * t,
    )
    edgeVertex.set(key, vi)
    return vi
  }

  for (let x = 0; x < n - 1; x++)
    for (let y = 0; y < n - 1; y++)
      for (let z = 0; z < n - 1; z++) {
        let cube = 0
        for (let c = 0; c < 8; c++) {
          if (field[idx(x + CORNERS[c][0], y + CORNERS[c][1], z + CORNERS[c][2])] < iso) cube |= 1 << c
        }
        const edges = edgeTable[cube]
        if (!edges) continue
        for (let e = 0; e < 12; e++) ids[e] = edges & (1 << e) ? vertexOn(x, y, z, e) : -1
        const base = cube << 4
        for (let k = 0; triTable[base + k] !== -1; k += 3) indices.push(ids[triTable[base + k]], ids[triTable[base + k + 1]], ids[triTable[base + k + 2]])
      }

  const pos = new Float32Array(positions)
  const ind = new Uint32Array(indices)
  if (signedVolume(pos, ind) < 0)
    for (let i = 0; i < ind.length; i += 3) {
      const t = ind[i + 1]
      ind[i + 1] = ind[i + 2]
      ind[i + 2] = t
    }
  return { positions: pos, colors: new Float32Array(colors), indices: ind }
}

function signedVolume(p: Float32Array, ind: Uint32Array) {
  let v = 0
  for (let i = 0; i < ind.length; i += 3) {
    const a = ind[i] * 3
    const b = ind[i + 1] * 3
    const c = ind[i + 2] * 3
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])
  }
  return v
}
