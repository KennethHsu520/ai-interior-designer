'use client'

import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRoomStore } from '@/store/useRoomStore'
import { itemTypeInfo, type WallItem } from '@/types/room'

const DEPTH: Record<string, number> = {
  switch: 0.02,
  outlet: 0.02,
  light: 0.12,
  air_conditioner: 0.25,
  furniture: 0.45,
  other: 0.05,
}

type Capturable = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void }

export default function WallItemMesh({
  item,
  wallIndex,
  parentRef,
  interactive,
}: {
  item: WallItem
  wallIndex: number
  parentRef: RefObject<THREE.Group | null>
  interactive: boolean
}) {
  const selectedItemId = useRoomStore((s) => s.selectedItemId)
  const selectedWall = useRoomStore((s) => s.selectedWall)
  const drag = useRef<{ startX: number; startY: number; offset: number; elevation: number } | null>(null)
  const color = itemTypeInfo(item.type).color
  const selected = selectedItemId === item.id && selectedWall === wallIndex
  const cx = item.offset + item.width / 2
  const cy = item.elevation + item.height / 2

  const toLocal = (e: ThreeEvent<PointerEvent>) => {
    const parent = parentRef.current
    if (!parent) return null
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()))
    const origin = parent.getWorldPosition(new THREE.Vector3())
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
    const hit = e.ray.intersectPlane(plane, new THREE.Vector3())
    return hit ? parent.worldToLocal(hit) : null
  }

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    const st = useRoomStore.getState()
    if (st.selectedWall !== wallIndex) st.selectWall(wallIndex)
    st.selectItem(item.id)
    const p = toLocal(e)
    if (!p) return
    drag.current = { startX: p.x, startY: p.y, offset: item.offset, elevation: item.elevation }
    st.setDragging(true)
    ;(e.target as unknown as Capturable).setPointerCapture(e.pointerId)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    const p = toLocal(e)
    if (!p) return
    const d = drag.current
    useRoomStore.getState().updateItem(wallIndex, item.id, {
      offset: Math.round((d.offset + p.x - d.startX) * 100) / 100,
      elevation: Math.round((d.elevation + p.y - d.startY) * 100) / 100,
    })
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    useRoomStore.getState().setDragging(false)
    ;(e.target as unknown as Capturable).releasePointerCapture(e.pointerId)
  }

  const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp }
  const opacity = item.confirmed ? 0.95 : 0.6

  if (item.type === 'door' || item.type === 'window') {
    const f = 0.05
    const w = item.width
    const h = item.height
    const isDoor = item.type === 'door'
    return (
      <group position={[cx, cy, 0]}>
        <mesh position={[0, h / 2 - f / 2, 0.01]} castShadow>
          <boxGeometry args={[w + f, f, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {!isDoor && (
          <mesh position={[0, -h / 2 + f / 2, 0.01]}>
            <boxGeometry args={[w + f, f, 0.08]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )}
        <mesh position={[-w / 2, 0, 0.01]}>
          <boxGeometry args={[f, h, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[w / 2, 0, 0.01]}>
          <boxGeometry args={[f, h, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0, isDoor ? -0.04 : -0.06]} {...handlers}>
          <boxGeometry args={[w, h, 0.03]} />
          <meshStandardMaterial
            color={isDoor ? '#c9a46c' : '#bfe3ff'}
            transparent
            opacity={isDoor ? opacity * 0.85 : 0.35}
            roughness={isDoor ? 0.8 : 0.1}
          />
          {selected && <Edges color="#f59e0b" lineWidth={3} />}
        </mesh>
      </group>
    )
  }

  const depth = DEPTH[item.type] ?? 0.05
  return (
    <mesh position={[cx, cy, depth / 2 + 0.005]} castShadow {...handlers}>
      <boxGeometry args={[item.width, item.height, depth]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} emissive={item.type === 'light' ? color : '#000'} emissiveIntensity={0.3} />
      <Edges color={selected ? '#f59e0b' : '#1e293b'} lineWidth={selected ? 3 : 1} />
    </mesh>
  )
}
