'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useRoomStore } from '@/store/useRoomStore'
import { doorSwingGeometry } from '@/lib/geometry'
import type { WallItem } from '@/types/room'

function DoorSwing({ wallIndex, item, highlight }: { wallIndex: number; item: WallItem; highlight: boolean }) {
  const floor = useRoomStore((s) => s.room.floor)
  const g = useMemo(() => doorSwingGeometry(floor, wallIndex, item, 32), [floor, wallIndex, item])
  const fan = useMemo(() => {
    const shape = new THREE.Shape()
    g.polygon.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)))
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [g])
  const arc = useMemo(() => g.arc.map((p) => [p.x, 0.012, p.z] as [number, number, number]), [g])
  const dx = g.leafEnd.x - g.hinge.x
  const dz = g.leafEnd.z - g.hinge.z
  const leafAngle = Math.atan2(-dz, dx)
  const out = g.swing.side === 'out'
  const color = highlight ? '#f59e0b' : out ? '#64748b' : '#b45309'
  return (
    <group>
      <mesh geometry={fan} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} raycast={() => null}>
        <meshBasicMaterial color={color} transparent opacity={out ? 0.06 : 0.14} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={arc} color={color} lineWidth={highlight ? 2.5 : 1.5} dashed dashSize={0.06} gapSize={0.04} />
      <Line points={[[g.hinge.x, 0.012, g.hinge.z], [g.leafEnd.x, 0.012, g.leafEnd.z]]} color={color} lineWidth={highlight ? 2.5 : 1.5} />
      <group position={[g.hinge.x, item.elevation, g.hinge.z]} rotation={[0, leafAngle, 0]}>
        <mesh position={[item.width / 2, item.height / 2, 0]} castShadow raycast={() => null}>
          <boxGeometry args={[item.width - 0.02, item.height - 0.02, 0.04]} />
          <meshStandardMaterial color="#c9a46c" roughness={0.75} transparent opacity={0.9} />
        </mesh>
        <mesh position={[item.width - 0.08, Math.min(1.0, item.height * 0.48), 0.04]} raycast={() => null}>
          <boxGeometry args={[0.12, 0.02, 0.02]} />
          <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

export default function DoorSwings() {
  const walls = useRoomStore((s) => s.room.walls)
  const selectedItemId = useRoomStore((s) => s.selectedItemId)
  return (
    <group>
      {walls.flatMap((w, i) =>
        w.items.filter((it) => it.type === 'door').map((it) => <DoorSwing key={it.id} wallIndex={i} item={it} highlight={it.id === selectedItemId} />),
      )}
    </group>
  )
}
