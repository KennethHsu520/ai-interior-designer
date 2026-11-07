'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export default function Label({
  text,
  position,
  background = 'rgba(255,255,255,0.9)',
  color = '#334155',
  size = 0.16,
  visible = true,
}: {
  text: string
  position: [number, number, number]
  background?: string
  color?: string
  size?: number
  visible?: boolean
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 4
    const fontPx = 26 * scale
    const font = `600 ${fontPx}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif`
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    ctx.font = font
    const padX = 14 * scale
    const w = Math.ceil(ctx.measureText(text).width + padX * 2)
    const h = Math.ceil(fontPx * 1.6)
    canvas.width = w
    canvas.height = h
    const c = canvas.getContext('2d')!
    c.font = font
    c.fillStyle = background
    const r = h / 2
    c.beginPath()
    c.roundRect(0, 0, w, h, r)
    c.fill()
    c.fillStyle = color
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, w / 2, h / 2 + scale)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { texture: tex, aspect: w / h }
  }, [text, background, color])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10} visible={visible} raycast={() => null}>
      <spriteMaterial map={texture} depthTest={false} depthWrite={false} transparent />
    </sprite>
  )
}
