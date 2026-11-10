import { createElement } from 'react'
import { Archive, Armchair, Bath, BedDouble, Frame, Grid2x2, Lamp, Package, Sofa, Sprout, Star, Table2, Tv, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  我的家具: Star,
  床: BedDouble,
  沙發: Sofa,
  桌: Table2,
  椅: Armchair,
  櫃: Archive,
  燈: Lamp,
  裝飾: Frame,
  植物: Sprout,
  地毯: Grid2x2,
  家電: Tv,
  衛浴: Bath,
}

export function categoryIcon(category: string): LucideIcon {
  return MAP[category] ?? Package
}

export default function CategoryIcon({ category, size = 14, className = '' }: { category: string; size?: number; className?: string }) {
  return createElement(categoryIcon(category), { size, strokeWidth: 1.75, className, 'aria-hidden': 'true' })
}
