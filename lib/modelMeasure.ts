export type FitAxis = 'width' | 'depth' | 'height'

export type ModelMeasure = {
  rawSize: { width: number; depth: number; height: number }
  rawMin: { x: number; y: number; z: number }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

export function measureBounds(min: ArrayLike<number>, max: ArrayLike<number>): ModelMeasure {
  return {
    rawSize: { width: r3(max[0] - min[0]), depth: r3(max[2] - min[2]), height: r3(max[1] - min[1]) },
    rawMin: { x: r3(min[0]), y: r3(min[1]), z: r3(min[2]) },
  }
}

export function fitModel(rawSize: ModelMeasure['rawSize'], axis: FitAxis, value: number) {
  const scale = value / (rawSize[axis] || 1)
  return {
    scale: Math.round(scale * 10000) / 10000,
    size: { width: r3(rawSize.width * scale), depth: r3(rawSize.depth * scale), height: r3(rawSize.height * scale) },
  }
}
