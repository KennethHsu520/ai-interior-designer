'use client'

import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRoomStore } from '@/store/useRoomStore'
import { isConvexVertex, wallSegment } from '@/lib/geometry'
import type { WallItem } from '@/types/room'
import WallItemMesh from './WallItemMesh'
import Label from './Label'

export const WALL_THICKNESS = 0.12

type Opening = { x0: number; x1: number; y0: number; y1: number }

function buildWallGeometry(length: number, height: number, items: WallItem[], ext0: number, ext1: number) {
  const accepted: Opening[] = []
  for (const it of items) {
    if (it.type !== 'door' && it.type !== 'window') continue
    const o = {
      x0: Math.max(0.02, it.offset),
      x1: Math.min(length - 0.02, it.offset + it.width),
      y0: Math.max(0, it.elevation),
      y1: Math.min(height - 0.03, it.elevation + it.height),
    }
    if (o.x1 - o.x0 < 0.05 || o.y1 - o.y0 < 0.05) continue
    if (accepted.some((a) => o.x0 < a.x1 + 0.02 && o.x1 > a.x0 - 0.02 && o.y0 < a.y1 + 0.02 && o.y1 > a.y0 - 0.02)) continue
    accepted.push(o)
  }
  const floorOpenings = accepted.filter((o) => o.y0 < 0.03).sort((a, b) => a.x0 - b.x0)
  const holes = accepted.filter((o) => o.y0 >= 0.03)
  const shape = new THREE.Shape()
  shape.moveTo(-ext0, 0)
  for (const o of floorOpenings) {
    shape.lineTo(o.x0, 0)
    shape.lineTo(o.x0, o.y1)
    shape.lineTo(o.x1, o.y1)
    shape.lineTo(o.x1, 0)
  }
  shape.lineTo(length + ext1, 0)
  shape.lineTo(length + ext1, height)
  shape.lineTo(-ext0, height)
  shape.lineTo(-ext0, 0)
  for (const o of holes) {
    const p = new THREE.Path()
    p.moveTo(o.x0, o.y0)
    p.lineTo(o.x0, o.y1)
    p.lineTo(o.x1, o.y1)
    p.lineTo(o.x1, o.y0)
    p.lineTo(o.x0, o.y0)
    shape.holes.push(p)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_THICKNESS, bevelEnabled: false })
  geo.translate(0, 0, -WALL_THICKNESS)
  geo.computeVertexNormals()
  return geo
}

export default function Wall({ index }: { index: number }) {
  const floor = useRoomStore((s) => s.room.floor)
  const height = useRoomStore((s) => s.room.height)
  const wall = useRoomStore((s) => s.room.walls[index])
  const stage = useRoomStore((s) => s.stage)
  const selectedWall = useRoomStore((s) => s.selectedWall)
  const hoveredWall = useRoomStore((s) => s.hoveredWall)
  const selectWall = useRoomStore((s) => s.selectWall)
  const setHoveredWall = useRoomStore((s) => s.setHoveredWall)
  const groupRef = useRef<THREE.Group>(null)
  const hiddenRef = useRef(false)
  const [hidden, setHidden] = useState(false)

  const seg = useMemo(() => wallSegment(floor, index), [floor, index])
  const n = floor.length
  const ext0 = isConvexVertex(floor, index) ? WALL_THICKNESS : 0
  const ext1 = isConvexVertex(floor, (index + 1) % n) ? WALL_THICKNESS : 0
  const items = wall?.items
  const geometry = useMemo(() => buildWallGeometry(seg.length, height, items ?? [], ext0, ext1), [seg.length, height, items, ext0, ext1])

  useFrame(({ camera }) => {
    const mx = seg.a.x + seg.dir.x * (seg.length / 2)
    const mz = seg.a.z + seg.dir.z * (seg.length / 2)
    const d = (camera.position.x - mx) * seg.normal.x + (camera.position.z - mz) * seg.normal.z
    const h = d < -0.05 && selectedWall !== index
    if (h !== hiddenRef.current) {
      hiddenRef.current = h
      setHidden(h)
    }
  })

  const interactive = stage === 'room'
  const isSelected = selectedWall === index
  const isHovered = hoveredWall === index && interactive
  const color = isSelected ? '#ebd3c6' : isHovered ? '#f6ece6' : wall?.confirmed && interactive ? '#e8ece6' : '#f4f1ec'

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    setHoveredWall(index)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (!interactive) return
    if (useRoomStore.getState().hoveredWall === index) setHoveredWall(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.delta > 6) return
    e.stopPropagation()
    selectWall(index)
  }

  return (
    <group ref={groupRef} position={[seg.a.x, 0, seg.a.z]} rotation={[0, seg.angle, 0]} visible={!hidden}>
      <mesh geometry={geometry} castShadow receiveShadow onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {wall?.items.map((it) => (
        <WallItemMesh key={it.id} item={it} wallIndex={index} parentRef={groupRef} interactive={interactive && !hidden} />
      ))}
      <Label text={`${seg.length.toFixed(2)} m`} position={[seg.length / 2, 0.08, 0.3]} size={0.18} visible={!hidden} />
      <Label
        text={`牆 ${index + 1}${wall?.confirmed ? '・已確認' : wall?.photoUrl ? '・已拍照' : ''}`}
        position={[seg.length / 2, height + 0.22, 0]}
        size={0.22}
        background={wall?.confirmed ? '#3a7d5c' : wall?.photoUrl ? '#a65a3a' : 'rgba(255,255,255,0.92)'}
        color={wall?.confirmed || wall?.photoUrl ? '#ffffff' : '#424245'}
        visible={!hidden && interactive}
      />
    </group>
  )
}
