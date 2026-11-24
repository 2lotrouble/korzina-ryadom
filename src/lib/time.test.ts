import { describe, expect, it } from 'vitest'
import type { Store } from './data'
import { campaignPhase, formatRange, storeStatus, type Now } from './time'

const store = (sl: Store['sl']): Store => ({ id: 't', ch: 'p', c: 0, a: 'ул. Мира, 1', pr: 'h', sl })
const at = (date: string, time: string): Now => ({ date, minutes: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), demo: true })
const twoDays = store([
  ['2026-11-20', '16:00', '20:00'],
  ['2026-11-21', '12:00', '18:00'],
])

describe('статус магазина', () => {
  it('до начала сбора в день акции', () => {
    expect(storeStatus(twoDays, at('2026-11-20', '09:00'))).toEqual({ kind: 'today', label: 'Сегодня с 16:00' })
  })
  it('во время сбора', () => {
    expect(storeStatus(twoDays, at('2026-11-20', '17:30'))).toEqual({ kind: 'now', label: 'Волонтёры здесь до 20:00' })
  })
  it('вечером показывает завтрашний день', () => {
    expect(storeStatus(twoDays, at('2026-11-20', '21:00'))).toEqual({ kind: 'later', label: 'Завтра с 12:00' })
  })
  it('за несколько дней называет день недели', () => {
    expect(storeStatus(twoDays, at('2026-11-17', '10:00')).label).toBe('В пятницу, 20 ноября с 16:00')
  })
  it('после акции', () => {
    expect(storeStatus(twoDays, at('2026-11-25', '10:00')).kind).toBe('done')
  })
  it('день без времени', () => {
    expect(storeStatus(store([['2026-11-21', null, null]]), at('2026-11-21', '10:00')).label).toBe('Сегодня, время уточняется')
  })
})

describe('акция в целом', () => {
  const dates = ['2026-11-19', '2026-11-20', '2026-11-21']
  it('фазы', () => {
    expect(campaignPhase(dates, at('2026-11-10', '10:00'))).toBe('before')
    expect(campaignPhase(dates, at('2026-11-20', '10:00'))).toBe('during')
    expect(campaignPhase(dates, at('2026-11-25', '10:00'))).toBe('after')
  })
  it('диапазон дат', () => {
    expect(formatRange(dates)).toBe('19–21 ноября')
    expect(formatRange(['2026-11-30', '2026-12-01'])).toBe('30 ноября – 1 декабря')
  })
})
