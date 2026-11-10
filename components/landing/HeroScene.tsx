'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildProcedural } from '@/lib/proceduralThree'

const ROOM_W = 4.2
const ROOM_D = 3.4
const ROOM_H = 2.7
const WALL_T = 0.08

const PALETTE = {
  main: '#d9c9b8',
  wood: '#b58a62',
  metal: '#2b2b2e',
  accent: '#a65a3a',
  white: '#f5f3ef',
  dark: '#2a2a2a',
  glass: '#dbe9f0',
  light: '#fff1cf',
  leaf: '#6f8a66',
  pot: '#efe9df',
  screen: '#0f1720',
}

type Piece = { kind: string; size: [number, number, number]; pos: [number, number]; rot?: number; colors?: Partial<typeof PALETTE> }

const PIECES: Piece[] = [
  { kind: 'rug-large', size: [2.4, 1.7, 0.015], pos: [0.25, 0.35], colors: { main: '#e6ddd0', accent: '#c9b8a6' } },
  { kind: 'sofa-3', size: [2.1, 0.92, 0.84], pos: [0.25, -0.75], colors: { main: '#cfc1b1', accent: '#a65a3a' } },
  { kind: 'coffee-table', size: [1.1, 0.6, 0.42], pos: [0.25, 0.45], colors: { main: '#b58a62' } },
  { kind: 'sofa-1-thin', size: [0.75, 0.8, 0.8], pos: [1.75, 0.6], rot: -Math.PI / 2, colors: { main: '#a65a3a' } },
  { kind: 'bookshelf-low', size: [1.2, 0.32, 0.9], pos: [-1.4, -1.5], colors: { main: '#efe9df' } },
  { kind: 'plant-monstera', size: [0.7, 0.7, 1.2], pos: [-1.75, 0.9] },
  { kind: 'lamp-tripod', size: [0.5, 0.5, 1.55], pos: [1.75, -1.3], colors: { main: '#f5f3ef' } },
  { kind: 'side-table', size: [0.45, 0.45, 0.55], pos: [-1.1, -0.95], colors: { main: '#b58a62' } },
]

function Furniture({ piece }: { piece: Piece }) {
  const group = useMemo(() => {
    const g = buildProcedural(piece.kind, { width: piece.size[0], depth: piece.size[1], height: piece.size[2] }, { ...PALETTE, ...piece.colors })
    g.position.set(piece.pos[0], 0, piece.pos[1])
    g.rotation.y = piece.rot ?? 0
    return g
  }, [piece])
  useEffect(() => () => group.userData.dispose?.(), [group])
  return <primitive object={group} />
}

function Walls() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ebe5dd', roughness: 0.95 }), [])
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cdb897', roughness: 0.9 }), [])
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), [])
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dbe9f0', transparent: true, opacity: 0.35, roughness: 0.05 }), [])
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b58a62', roughness: 0.7 }), [])
  useEffect(() => () => [wallMat, floorMat, frameMat, glassMat, doorMat].forEach((m) => m.dispose()), [wallMat, floorMat, frameMat, glassMat, doorMat])

  const winW = 1.6
  const winH = 1.25
  const winY = 0.95
  const sideW = (ROOM_W - winW) / 2

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
      </mesh>
      <mesh position={[0, ROOM_H / 2, -ROOM_D / 2 - WALL_T / 2]} receiveShadow material={wallMat}>
        <boxGeometry args={[ROOM_W + WALL_T, ROOM_H, WALL_T]} />
      </mesh>
      <mesh position={[-ROOM_W / 2 - WALL_T / 2, ROOM_H / 2, 0]} receiveShadow material={wallMat}>
        <boxGeometry args={[WALL_T, ROOM_H, ROOM_D + WALL_T]} />
      </mesh>
      <group position={[0, 0, -ROOM_D / 2 + 0.005]}>
        <mesh position={[0, winY + winH / 2, 0]} material={frameMat}>
          <boxGeometry args={[winW + 0.1, winH + 0.1, 0.05]} />
        </mesh>
        <mesh position={[0, winY + winH / 2, 0.03]} material={glassMat}>
          <boxGeometry args={[winW - 0.04, winH - 0.04, 0.01]} />
        </mesh>
        <mesh position={[0, winY + winH / 2, 0.04]} material={frameMat}>
          <boxGeometry args={[0.04, winH, 0.02]} />
        </mesh>
        <mesh position={[0, winY + winH / 2, 0.04]} material={frameMat}>
          <boxGeometry args={[winW, 0.04, 0.02]} />
        </mesh>
      </group>
      <group position={[-ROOM_W / 2 + 0.005, 0, ROOM_D / 2 - 0.75]}>
        <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 2, 0]} material={doorMat}>
          <boxGeometry args={[0.85, 2.1, 0.04]} />
        </mesh>
        <mesh position={[0.03, 1.05, 0]} rotation={[0, Math.PI / 2, 0]} material={frameMat}>
          <boxGeometry args={[0.95, 2.15, 0.02]} />
        </mesh>
      </group>
      <mesh position={[sideW / 2 - ROOM_W / 2, 1.3, -ROOM_D / 2 + 0.02]} material={frameMat}>
        <boxGeometry args={[0.08, 0.12, 0.02]} />
      </mesh>
    </group>
  )
}

function Env() {
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

function Rig({ enabled }: { enabled: boolean }) {
  const ref = useRef<OrbitControlsImpl>(null)
  const active = useRef(false)
  const clock = useRef(0)
  useEffect(() => {
    const controls = ref.current
    if (!controls) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) {
      controls.enableRotate = false
      if (controls.domElement) controls.domElement.style.touchAction = 'pan-y'
    }
    const start = () => {
      active.current = true
    }
    const end = () => {
      active.current = false
    }
    controls.addEventListener('start', start)
    controls.addEventListener('end', end)
    return () => {
      controls.removeEventListener('start', start)
      controls.removeEventListener('end', end)
    }
  }, [])
  useFrame((_, dt) => {
    const controls = ref.current
    if (!controls || !enabled || active.current) return
    clock.current += dt
    const target = 0.55 + Math.sin(clock.current * 0.22) * 0.32
    const current = controls.getAzimuthalAngle()
    const next = current + (target - current) * Math.min(1, dt * 1.5)
    controls.minAzimuthAngle = next
    controls.maxAzimuthAngle = next
    controls.update()
    controls.minAzimuthAngle = -Infinity
    controls.maxAzimuthAngle = Infinity
  })
  return <OrbitControls ref={ref} enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 2.4} target={[0, 0.1, 0]} />
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

export default function HeroScene() {
  const reduced = useReducedMotion()
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [5.2, 3.6, 5.6], fov: 32 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ background: 'transparent' }}
    >
      <Env />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 2]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002}>
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.5, 20]} />
      </directionalLight>
      <group position={[0, -0.9, 0]}>
        <Walls />
        {PIECES.map((p) => (
          <Furniture key={p.kind + p.pos.join()} piece={p} />
        ))}
        <ContactShadows position={[0, 0.002, 0]} opacity={0.35} scale={8} blur={2.2} far={2} />
      </group>
      <Rig enabled={!reduced} />
    </Canvas>
  )
}
