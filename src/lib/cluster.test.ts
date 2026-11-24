import { describe, expect, it } from 'vitest'
import { clusterDots } from './cluster'

describe('объединение городов на карте', () => {
  it('склеивает соседей и ставит кружок на самый крупный город', () => {
    const result = clusterDots(
      [
        { x: 10, y: 10, n: 3, name: 'Химки' },
        { x: 0, y: 0, n: 141, name: 'Москва' },
        { x: 300, y: 0, n: 42, name: 'Рязань' },
      ],
      40,
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ x: 0, y: 0, n: 144 })
    expect(result[0].items.map((c) => c.name)).toEqual(['Москва', 'Химки'])
    expect(result[1]).toMatchObject({ n: 42 })
  })

  it('не теряет магазины: сумма по кружкам равна сумме по городам', () => {
    const dots = Array.from({ length: 200 }, (_, i) => ({ x: (i * 37) % 500, y: (i * 91) % 300, n: (i % 7) + 1 }))
    const total = dots.reduce((sum, d) => sum + d.n, 0)
    expect(clusterDots(dots, 44).reduce((sum, c) => sum + c.n, 0)).toBe(total)
    expect(clusterDots(dots, 0)).toHaveLength(new Set(dots.map((d) => `${d.x},${d.y}`)).size)
  })
})
