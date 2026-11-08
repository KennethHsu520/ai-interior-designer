'use client'

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Edges, useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRoomStore } from '@/store/useRoomStore'
import { furnitureColors, furnitureDims } from '@/lib/catalog'
import { buildProcedural } from '@/lib/proceduralThree'
import type { CatalogItem, PlacedFurniture } from '@/types/room'

type Capturable = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void }

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Model({ item, stretch, tint }: { item: CatalogItem; stretch: [number, number, number]; tint?: string }) {
  const { scene } = useGLTF(item.file)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        if (tint) {
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          const next = mats.map((mat) => {
            const cm = (mat as THREE.MeshStandardMaterial).clone()
            if (cm.color) cm.color.set(tint)
            return cm
          })
          m.material = Array.isArray(m.material) ? next : next[0]
        }
      }
    })
    return c
  }, [scene, tint])
  const s = item.scale
  return (
    <group scale={stretch}>
      <group
        scale={s}
        position={[-(item.rawMin.x + item.rawSize.width / 2) * s, -item.rawMin.y * s, -(item.rawMin.z + item.rawSize.depth / 2) * s]}
      >
        <primitive object={cloned} />
      </group>
    </group>
  )
}

function ProceduralModel({ kind, size, colors }: { kind: string; size: { width: number; depth: number; height: number }; colors: Record<string, string> }) {
  const key = JSON.stringify([size, colors])
  const group = useMemo(() => {
    const [sz, col] = JSON.parse(key)
    return buildProcedural(kind, sz, col)
  }, [kind, key])
  useEffect(() => () => group.userData.dispose?.(), [group])
  return <primitive object={group} />
}

function Placeholder({ item }: { item: CatalogItem }) {
  return (
    <mesh position={[0, item.size.height / 2, 0]}>
      <boxGeometry args={[item.size.width, item.size.height, item.size.depth]} />
      <meshStandardMaterial color="#cbd5e1" transparent opacity={0.6} />
    </mesh>
  )
}

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export default function FurnitureMesh({ f, item, invalid }: { f: PlacedFurniture; item: CatalogItem; invalid: boolean }) {
  const selected = useRoomStore((s) => s.selectedFurnitureId === f.id)
  const drag = useRef<{ dx: number; dz: number } | null>(null)
  const dims = furnitureDims(f, item)
  const w = dims.width
  const d = dims.depth
  const h = dims.height
  const base = f.size ?? item.size
  const stretch: [number, number, number] = [base.width / item.size.width, base.height / item.size.height, base.depth / item.size.depth]
  const colors = furnitureColors(f, item)

  const hit = (e: ThreeEvent<PointerEvent>) => e.ray.intersectPlane(floorPlane, new THREE.Vector3())

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const st = useRoomStore.getState()
    st.selectFurniture(f.id)
    const p = hit(e)
    if (!p) return
    drag.current = { dx: f.position.x - p.x, dz: f.position.z - p.z }
    st.beginFurnitureDrag()
    ;(e.target as unknown as Capturable).setPointerCapture(e.pointerId)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    e.stopPropagation()
    const p = hit(e)
    if (!p) return
    useRoomStore.getState().updateFurniture(f.id, {
      position: { x: Math.round((p.x + drag.current.dx) * 100) / 100, y: 0, z: Math.round((p.z + drag.current.dz) * 100) / 100 },
    })
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    useRoomStore.getState().endFurnitureDrag()
    ;(e.target as unknown as Capturable).releasePointerCapture(e.pointerId)
  }

  return (
    <group position={[f.position.x, f.position.y, f.position.z]} rotation={[0, f.rotationY, 0]}>
      <group scale={f.scale} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {item.procedural ? (
          <ProceduralModel kind={item.procedural.kind} size={base} colors={colors} />
        ) : (
          <ModelBoundary fallback={<Placeholder item={item} />}>
            <Suspense fallback={<Placeholder item={item} />}>
              <Model item={item} stretch={stretch} tint={f.colors?.main} />
            </Suspense>
          </ModelBoundary>
        )}
      </group>
      {(invalid || selected) && (
        <mesh position={[0, h / 2 + 0.005, 0]} raycast={() => null}>
          <boxGeometry args={[w + 0.02, h + 0.01, d + 0.02]} />
          <meshBasicMaterial color={invalid ? '#ef4444' : '#3b82f6'} transparent opacity={invalid ? 0.28 : 0.08} depthWrite={false} />
          <Edges color={invalid ? '#dc2626' : '#2563eb'} lineWidth={2} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.01, d / 2 + 0.12]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <coneGeometry args={[0.08, 0.16, 3]} />
          <meshBasicMaterial color="#2563eb" />
        </mesh>
      )}
    </group>
  )
}
