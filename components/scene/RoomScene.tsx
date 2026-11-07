'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useRoomStore } from '@/store/useRoomStore'
import { bbox, wallSegment } from '@/lib/geometry'
import { CATALOG_MAP } from '@/lib/catalog'
import { useCollisions } from '@/lib/useCollisions'
import { itemTypeInfo } from '@/types/room'
import Wall from './Wall'
import FurnitureMesh from './FurnitureMesh'
import { sceneBridge } from './bridge'

function Floor() {
  const floor = useRoomStore((s) => s.room.floor)
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    floor.forEach((p, i) => (i === 0 ? s.moveTo(p.x, -p.z) : s.lineTo(p.x, -p.z)))
    s.closePath()
    return s
  }, [floor])
  const outline = useMemo(() => [...floor, floor[0]].map((p) => [p.x, 0.005, p.z] as [number, number, number]), [floor])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#d9c7a7" roughness={0.85} />
      </mesh>
      <Line points={outline} color="#64748b" lineWidth={2} />
    </group>
  )
}

function CeilingItems() {
  const items = useRoomStore((s) => s.room.ceilingItems)
  const height = useRoomStore((s) => s.room.height)
  return (
    <group>
      {items.map((c) => (
        <mesh key={c.id} position={[c.offset, height - 0.04, c.elevation]}>
          <boxGeometry args={[Math.max(c.width, 0.15), 0.06, Math.max(c.height, 0.15)]} />
          <meshStandardMaterial color={itemTypeInfo(c.type).color} emissive={itemTypeInfo(c.type).color} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function SceneEnvironment() {
  const gl = useThree((s) => s.gl)
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = new RoomEnvironment()
    const tex = pmrem.fromScene(env, 0.04).texture
    env.dispose()
    pmrem.dispose()
    return tex
  }, [gl])
  useEffect(() => () => texture.dispose(), [texture])
  return <primitive object={texture} attach="environment" />
}

function CameraRig() {
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const selectedWall = useRoomStore((s) => s.selectedWall)
  const target = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; t: number } | null>(null)

  useEffect(() => {
    sceneBridge.camera = camera
    sceneBridge.dom = gl.domElement
  }, [camera, gl])

  useEffect(() => {
    if (selectedWall === null) return
    const { floor, height } = useRoomStore.getState().room
    const s = wallSegment(floor, selectedWall)
    const mid = new THREE.Vector3(s.a.x + (s.dir.x * s.length) / 2, height / 2, s.a.z + (s.dir.z * s.length) / 2)
    const persp = camera as THREE.PerspectiveCamera
    const fov = THREE.MathUtils.degToRad(persp.fov ?? 50)
    const span = Math.max(s.length / (persp.aspect || 1), height) * 1.25
    const dist = span / 2 / Math.tan(fov / 2)
    const pos = mid.clone().add(new THREE.Vector3(s.normal.x * dist, 0.3, s.normal.z * dist))
    target.current = { pos, look: mid, t: 0 }
  }, [selectedWall, camera])

  useFrame((_, dt) => {
    const t = target.current
    if (!t || !controls) return
    t.t += dt
    const k = 1 - Math.pow(0.001, dt)
    camera.position.lerp(t.pos, k)
    controls.target.lerp(t.look, k)
    controls.update()
    if (t.t > 1.2 || camera.position.distanceTo(t.pos) < 0.01) target.current = null
  })

  useEffect(() => {
    if (!controls) return
    const stop = () => {
      target.current = null
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  return null
}

function FurnitureLayer() {
  const furniture = useRoomStore((s) => s.furniture)
  const collisions = useCollisions()
  return (
    <group>
      {furniture.map((f) => {
        const item = CATALOG_MAP.get(f.catalogId)
        if (!item) return null
        return <FurnitureMesh key={f.id} f={f} item={item} invalid={collisions.get(f.id)?.ok === false} />
      })}
    </group>
  )
}

export default function RoomScene() {
  const floor = useRoomStore((s) => s.room.floor)
  const height = useRoomStore((s) => s.room.height)
  const stage = useRoomStore((s) => s.stage)
  const dragging = useRoomStore((s) => s.dragging)
  const b = useMemo(() => bbox(floor), [floor])
  const initialCam = useMemo(() => {
    const r = Math.max(b.width, b.depth)
    return [b.cx + r * 0.9, height + r * 0.9, b.cz + r * 1.4] as [number, number, number]
  }, [b, height])
  const orbitTarget = useMemo(() => [b.cx, 0.8, b.cz] as [number, number, number], [b])

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: initialCam, fov: 50, near: 0.05, far: 200 }}
      onCreated={({ scene }) => {
        scene.environmentIntensity = 0.6
      }}
      onPointerMissed={() => {
        const st = useRoomStore.getState()
        if (st.stage === 'room') st.selectItem(null)
        else st.selectFurniture(null)
      }}
    >
      <color attach="background" args={['#eef1f5']} />
      <hemisphereLight args={['#ffffff', '#b9a98f', 0.7]} />
      <directionalLight
        position={[b.cx + 4, height + 6, b.cz + 3]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Grid
        position={[0, -0.002, 0]}
        infiniteGrid
        cellSize={0.5}
        sectionSize={1}
        cellColor="#cbd5e1"
        sectionColor="#94a3b8"
        fadeDistance={40}
      />
      <Floor />
      {floor.map((_, i) => (
        <Wall key={`${i}-${floor.length}`} index={i} />
      ))}
      <CeilingItems />
      {stage === 'furniture' && <FurnitureLayer />}
      <OrbitControls
        makeDefault
        enabled={!dragging}
        target={orbitTarget}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={0.8}
        maxDistance={30}
      />
      <CameraRig />
      <SceneEnvironment />
    </Canvas>
  )
}
