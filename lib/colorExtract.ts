'use client'

type RGB = [number, number, number]

const hex = (c: RGB) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

async function samplePixels(src: string, size = 72): Promise<RGB[]> {
  const img = new Image()
  img.src = src
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  const sw = img.naturalWidth * 0.6
  const sh = img.naturalHeight * 0.6
  ctx.drawImage(img, img.naturalWidth * 0.2, img.naturalHeight * 0.2, sw, sh, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const out: RGB[] = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) out.push([data[i], data[i + 1], data[i + 2]])
  return out
}

function kmeans(points: RGB[], k: number, iterations = 12) {
  const centers: RGB[] = []
  centers.push(points[Math.floor(points.length / 2)])
  while (centers.length < k) {
    let best = points[0]
    let bestD = -1
    for (const p of points) {
      const d = Math.min(...centers.map((c) => dist2(p, c)))
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
    centers.push(best)
  }
  let counts = new Array(k).fill(0)
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0])
    counts = new Array(k).fill(0)
    for (const p of points) {
      let bi = 0
      let bd = Infinity
      centers.forEach((c, i) => {
        const d = dist2(p, c)
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      sums[bi][0] += p[0]
      sums[bi][1] += p[1]
      sums[bi][2] += p[2]
      counts[bi] += 1
    }
    centers.forEach((_, i) => {
      if (counts[i]) centers[i] = [sums[i][0] / counts[i], sums[i][1] / counts[i], sums[i][2] / counts[i]]
    })
  }
  return centers.map((c, i) => ({ color: c, weight: counts[i] / points.length })).sort((a, b) => b.weight - a.weight)
}

export async function extractColors(src: string, k = 4): Promise<string[]> {
  const pts = await samplePixels(src)
  if (pts.length < k) return []
  const clusters = kmeans(pts, k).filter((c) => c.weight > 0.04)
  const picked: RGB[] = []
  for (const c of clusters) if (!picked.some((p) => dist2(p, c.color) < 900)) picked.push(c.color)
  return picked.map(hex)
}
