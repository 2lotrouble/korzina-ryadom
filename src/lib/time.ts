import { useEffect, useState } from 'react'
import type { Slot, Store } from './data'

/**
 * «Сейчас» без часовых поясов: дата и минуты от полуночи по часам устройства.
 * Время в таблице фонда местное для каждого магазина, а покупатель ищет магазин рядом с собой,
 * поэтому сравниваем местное время с местным.
 */
export interface Now {
  date: string
  minutes: number
  /** время подставлено через ?demo=…, чтобы показать сайт в день акции */
  demo: boolean
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const WEEKDAYS_ON = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу']

const pad = (n: number) => String(n).padStart(2, '0')
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const parseDate = (date: string) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))

export function readDemo(): string | null {
  const value = new URLSearchParams(location.search).get('demo')
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value : null
}

function currentNow(): Now {
  const demo = readDemo()
  if (demo) return { date: demo.slice(0, 10), minutes: toMinutes(demo.slice(11)), demo: true }
  const d = new Date()
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes(), demo: false }
}

export function useNow(): Now {
  const [now, setNow] = useState(currentNow)
  useEffect(() => {
    const timer = setInterval(() => setNow(currentNow()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export const dayOfMonth = (date: string) => Number(date.slice(8, 10))
export const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]
export const weekdayShort = (date: string) => WEEKDAYS_SHORT[parseDate(date).getDay()]
export const weekday = (date: string) => WEEKDAYS[parseDate(date).getDay()]
export const formatDate = (date: string) => `${dayOfMonth(date)} ${monthName(date)}`

/** «19–22 ноября» или «30 ноября – 2 декабря» */
export function formatRange(dates: string[]): string {
  if (!dates.length) return ''
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (first === last) return formatDate(first)
  return monthName(first) === monthName(last) ? `${dayOfMonth(first)}–${dayOfMonth(last)} ${monthName(last)}` : `${formatDate(first)} – ${formatDate(last)}`
}

export const formatSlotTime = (slot: Slot) => (slot[1] && slot[2] ? `${slot[1]}–${slot[2]}` : 'время уточняется')

export type Phase = 'before' | 'during' | 'after'

export function campaignPhase(dates: string[], now: Now): Phase {
  if (!dates.length || now.date > dates[dates.length - 1]) return 'after'
  return now.date < dates[0] ? 'before' : 'during'
}

export function daysUntil(date: string, now: Now): number {
  return Math.round((parseDate(date).getTime() - parseDate(now.date).getTime()) / 86_400_000)
}

export type StatusKind = 'now' | 'today' | 'later' | 'done'
export interface StoreStatus {
  kind: StatusKind
  label: string
}

export function storeStatus(store: Store, now: Now): StoreStatus {
  for (const slot of store.sl) {
    const [date, from, to] = slot
    if (date < now.date) continue
    if (date === now.date) {
      if (!from || !to) return { kind: 'today', label: 'Сегодня, время уточняется' }
      if (now.minutes < toMinutes(from)) return { kind: 'today', label: `Сегодня с ${from}` }
      if (now.minutes < toMinutes(to)) return { kind: 'now', label: `Волонтёры здесь до ${to}` }
      continue
    }
    const days = daysUntil(date, now)
    const when = days === 1 ? 'Завтра' : `${WEEKDAYS_ON[parseDate(date).getDay()].replace(/^в/, 'В')}, ${formatDate(date)}`
    return { kind: 'later', label: from ? `${when} с ${from}` : when }
  }
  return { kind: 'done', label: 'Сбор здесь завершён' }
}
