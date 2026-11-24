import { describe, expect, it } from 'vitest'
import type { Campaign, City, Store } from './data'
import { cityPost } from './post'

const campaign = { id: 't', title: 'Корзина доброты', year: 2026, dates: ['2026-11-20', '2026-11-21'] } as Campaign
const city = { name: 'Рязань', region: 'Рязанская область', lat: 54.6, lon: 39.7, n: 3 } as City
const store = (id: string, a: string, sl: Store['sl'], ch: Store['ch'] = 'p') => ({ id, ch, c: 0, a, sl, pr: 'h' }) as Store

describe('текст поста для города', () => {
  it('собирает магазины с одинаковым расписанием под одним заголовком', () => {
    const text = cityPost(
      city,
      [
        store('a', 'Ленина ул., 1', [['2026-11-20', '16:00', '20:00']]),
        store('b', 'Гагарина ул., 7', [['2026-11-20', '16:00', '20:00']]),
        store('c', 'Введенская ул., 115', [['2026-11-21', '12:00', '18:00']], 'x'),
      ],
      campaign,
      'https://example.org/?city=Рязань',
    )
    expect(text).toContain('«Корзина доброты» — Рязань, 20–21 ноября')
    expect(text).toContain('Где и когда (3 магазина):')
    expect(text.match(/пт 20 ноя, 16:00–20:00:/g)).toHaveLength(1)
    expect(text).toContain('• Пятёрочка, Гагарина ул., 7')
    expect(text).toContain('• Перекрёсток, Введенская ул., 115')
    expect(text.trim().endsWith('https://example.org/?city=Рязань')).toBe(true)
  })

  it('не выходит за размер сообщения в мессенджере и честно говорит, сколько адресов не поместилось', () => {
    const many = Array.from({ length: 200 }, (_, i) => store(`s${i}`, `Очень длинная улица имени кого-то там, ${i + 1}`, [['2026-11-20', '16:00', '20:00']]))
    const text = cityPost(city, many, campaign, 'https://example.org/')
    expect(text.length).toBeLessThan(4096)
    const listed = text.match(/^• /gm)!.length
    expect(listed).toBeLessThan(200)
    expect(text).toContain(`…и ещё ${200 - listed} — все адреса на карте по ссылке.`)
  })
})
