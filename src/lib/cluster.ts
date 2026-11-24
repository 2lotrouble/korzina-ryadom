/** Точка на экране с числом магазинов. */
export interface Dot {
  x: number
  y: number
  n: number
}

export interface Cluster<T extends Dot> {
  /** стоит на самом крупном городе группы — так кружок всегда указывает на настоящее место */
  x: number
  y: number
  n: number
  items: T[]
}

/**
 * Собирает близкие на экране города в один кружок, чтобы на карте страны они не налезали друг на друга.
 * Простое жадное объединение: города идут от крупных к мелким и прилипают к ближайшему уже стоящему кружку.
 */
export function clusterDots<T extends Dot>(dots: T[], radius: number): Cluster<T>[] {
  const clusters: Cluster<T>[] = []
  const sorted = [...dots].sort((a, b) => b.n - a.n)
  for (const dot of sorted) {
    let best: Cluster<T> | null = null
    let bestDistance = radius * radius
    for (const cluster of clusters) {
      const d = (cluster.x - dot.x) ** 2 + (cluster.y - dot.y) ** 2
      if (d <= bestDistance) {
        best = cluster
        bestDistance = d
      }
    }
    if (best) {
      best.n += dot.n
      best.items.push(dot)
    } else {
      clusters.push({ x: dot.x, y: dot.y, n: dot.n, items: [dot] })
    }
  }
  return clusters
}
