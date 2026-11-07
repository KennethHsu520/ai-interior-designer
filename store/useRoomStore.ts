'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CeilingItem, PhotoBounds, PlacedFurniture, Room, Vec2, WallItem } from '@/types/room'
import {
  clampItem,
  rectFloor,
  removeVertex,
  scaleFloor,
  scaleWalls,
  splitWall,
  syncWalls,
  uid,
  wallSegment,
} from '@/lib/geometry'

export type Stage = 'room' | 'furniture'

export function createDefaultRoom(): Room {
  const floor = rectFloor(4, 3)
  return {
    id: uid('room'),
    name: '我的房間',
    floor,
    height: 2.8,
    walls: syncWalls(floor, []),
    ceilingItems: [],
  }
}

type State = {
  room: Room
  furniture: PlacedFurniture[]
  stage: Stage
  selectedWall: number | null
  selectedItemId: string | null
  selectedFurnitureId: string | null
  hoveredWall: number | null
  dragging: boolean
  floorEditorOpen: boolean
}

type Actions = {
  setSize: (width: number, depth: number) => void
  setHeight: (h: number) => void
  setName: (name: string) => void
  setFloor: (floor: Vec2[]) => void
  insertVertex: (wallIndex: number, t?: number) => void
  deleteVertex: (vertexIndex: number) => void
  resetRect: (width: number, depth: number) => void
  selectWall: (i: number | null) => void
  selectItem: (id: string | null) => void
  setHoveredWall: (i: number | null) => void
  setDragging: (v: boolean) => void
  setFloorEditorOpen: (v: boolean) => void
  setWallPhoto: (i: number, ref: string | undefined) => void
  setPhotoBounds: (i: number, bounds: PhotoBounds | undefined) => void
  setWallItems: (i: number, items: WallItem[]) => void
  addItem: (i: number, item: WallItem) => void
  updateItem: (i: number, id: string, patch: Partial<WallItem>) => void
  removeItem: (i: number, id: string) => void
  confirmWall: (i: number, value: boolean) => void
  addCeilingItems: (items: CeilingItem[]) => void
  updateCeilingItem: (id: string, patch: Partial<CeilingItem>) => void
  removeCeilingItem: (id: string) => void
  setStage: (s: Stage) => void
  addFurniture: (catalogId: string, x: number, z: number, rotationY?: number) => string
  updateFurniture: (id: string, patch: Partial<PlacedFurniture>) => void
  removeFurniture: (id: string) => void
  setFurnitureList: (list: PlacedFurniture[]) => void
  selectFurniture: (id: string | null) => void
  importData: (data: { room: Room; furniture?: PlacedFurniture[] }) => void
  resetAll: () => void
}

export const useRoomStore = create<State & Actions>()(
  persist(
    (set) => ({
      room: createDefaultRoom(),
      furniture: [],
      stage: 'room',
      selectedWall: null,
      selectedItemId: null,
      selectedFurnitureId: null,
      hoveredWall: null,
      dragging: false,
      floorEditorOpen: false,

      setSize: (width, depth) =>
        set((s) => {
          const floor = scaleFloor(s.room.floor, width, depth)
          const walls = scaleWalls(s.room.floor, floor, s.room.walls, s.room.height, s.room.height)
          return { room: { ...s.room, floor, walls } }
        }),
      setHeight: (h) =>
        set((s) => {
          const walls = scaleWalls(s.room.floor, s.room.floor, s.room.walls, s.room.height, h)
          return { room: { ...s.room, height: h, walls } }
        }),
      setName: (name) => set((s) => ({ room: { ...s.room, name } })),
      setFloor: (floor) =>
        set((s) => {
          const walls = syncWalls(floor, s.room.walls).map((w, i) => {
            const len = wallSegment(floor, i).length
            return { ...w, items: w.items.map((it) => clampItem(it, len, s.room.height)) }
          })
          return { room: { ...s.room, floor, walls } }
        }),
      insertVertex: (wallIndex, t = 0.5) =>
        set((s) => {
          const r = splitWall(s.room.floor, s.room.walls, wallIndex, t)
          return { room: { ...s.room, ...r }, selectedWall: null, selectedItemId: null }
        }),
      deleteVertex: (vertexIndex) =>
        set((s) => {
          if (s.room.floor.length <= 3) return {}
          const r = removeVertex(s.room.floor, s.room.walls, vertexIndex)
          return { room: { ...s.room, ...r }, selectedWall: null, selectedItemId: null }
        }),
      resetRect: (width, depth) =>
        set((s) => {
          const floor = rectFloor(width, depth)
          return { room: { ...s.room, floor, walls: syncWalls(floor, []) }, selectedWall: null, selectedItemId: null }
        }),
      selectWall: (i) => set({ selectedWall: i, selectedItemId: null }),
      selectItem: (id) => set({ selectedItemId: id }),
      setHoveredWall: (i) => set({ hoveredWall: i }),
      setDragging: (v) => set({ dragging: v }),
      setFloorEditorOpen: (v) => set({ floorEditorOpen: v }),
      setWallPhoto: (i, ref) =>
        set((s) => ({ room: { ...s.room, walls: s.room.walls.map((w) => (w.index === i ? { ...w, photoUrl: ref, photoBounds: undefined } : w)) } })),
      setPhotoBounds: (i, bounds) =>
        set((s) => ({ room: { ...s.room, walls: s.room.walls.map((w) => (w.index === i ? { ...w, photoBounds: bounds } : w)) } })),
      setWallItems: (i, items) =>
        set((s) => ({ room: { ...s.room, walls: s.room.walls.map((w) => (w.index === i ? { ...w, items, confirmed: false } : w)) } })),
      addItem: (i, item) =>
        set((s) => ({
          room: { ...s.room, walls: s.room.walls.map((w) => (w.index === i ? { ...w, items: [...w.items, item], confirmed: false } : w)) },
          selectedItemId: item.id,
        })),
      updateItem: (i, id, patch) =>
        set((s) => {
          const len = wallSegment(s.room.floor, i).length
          return {
            room: {
              ...s.room,
              walls: s.room.walls.map((w) =>
                w.index === i
                  ? { ...w, items: w.items.map((it) => (it.id === id ? clampItem({ ...it, ...patch }, len, s.room.height) : it)) }
                  : w,
              ),
            },
          }
        }),
      removeItem: (i, id) =>
        set((s) => ({
          room: { ...s.room, walls: s.room.walls.map((w) => (w.index === i ? { ...w, items: w.items.filter((it) => it.id !== id) } : w)) },
          selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
        })),
      confirmWall: (i, value) =>
        set((s) => ({
          room: {
            ...s.room,
            walls: s.room.walls.map((w) =>
              w.index === i ? { ...w, confirmed: value, items: value ? w.items.map((it) => ({ ...it, confirmed: true })) : w.items } : w,
            ),
          },
        })),
      addCeilingItems: (items) => set((s) => ({ room: { ...s.room, ceilingItems: [...s.room.ceilingItems, ...items] } })),
      updateCeilingItem: (id, patch) =>
        set((s) => ({ room: { ...s.room, ceilingItems: s.room.ceilingItems.map((c) => (c.id === id ? { ...c, ...patch } : c)) } })),
      removeCeilingItem: (id) => set((s) => ({ room: { ...s.room, ceilingItems: s.room.ceilingItems.filter((c) => c.id !== id) } })),
      setStage: (stage) => set({ stage, selectedWall: null, selectedItemId: null, selectedFurnitureId: null }),
      addFurniture: (catalogId, x, z, rotationY = 0) => {
        const id = uid('furn')
        set((s) => ({
          furniture: [...s.furniture, { id, catalogId, position: { x, y: 0, z }, rotationY, scale: 1 }],
          selectedFurnitureId: id,
        }))
        return id
      },
      updateFurniture: (id, patch) => set((s) => ({ furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      removeFurniture: (id) =>
        set((s) => ({
          furniture: s.furniture.filter((f) => f.id !== id),
          selectedFurnitureId: s.selectedFurnitureId === id ? null : s.selectedFurnitureId,
        })),
      setFurnitureList: (list) => set({ furniture: list }),
      selectFurniture: (id) => set({ selectedFurnitureId: id }),
      importData: (data) =>
        set({
          room: { ...data.room, walls: syncWalls(data.room.floor, data.room.walls), ceilingItems: data.room.ceilingItems ?? [] },
          furniture: data.furniture ?? [],
          selectedWall: null,
          selectedItemId: null,
          selectedFurnitureId: null,
          stage: 'room',
        }),
      resetAll: () =>
        set({
          room: createDefaultRoom(),
          furniture: [],
          stage: 'room',
          selectedWall: null,
          selectedItemId: null,
          selectedFurnitureId: null,
        }),
    }),
    {
      name: 'ai-interior-designer',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ room: s.room, furniture: s.furniture, stage: s.stage }),
    },
  ),
)

export function allWallsConfirmed(room: Room) {
  return room.walls.length > 0 && room.walls.every((w) => w.confirmed)
}

export function useSelectedWall() {
  return useRoomStore((s) => (s.selectedWall === null ? null : s.room.walls[s.selectedWall] ?? null))
}

export function getState() {
  return useRoomStore.getState()
}
