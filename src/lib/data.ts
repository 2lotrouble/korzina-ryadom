export type Precision = 'h' | 's' | 'c' | 'n'
export type ChainCode = 'p' | 'x'
/** дата, начало и конец; времени может не быть, если фонд его не указал */
export type Slot = [date: string, from: string | null, to: string | null]

export interface Store {
  id: string
  ch: ChainCode
  /** номер города в списке cities */
  c: number
  /** адрес в человеческом виде */
  a: string
  lat?: number
  lon?: number
  /** точность точки на карте: дом, улица, город, не найдено */
  pr: Precision
  sl: Slot[]
  /** адрес как в таблице фонда — показываем, когда точка примерная */
  raw?: string
  /** точку поставил человек (data/overrides.json) */
  m?: 1
}

export interface City {
  name: string
  region: string | null
  lat: number | null
  lon: number | null
  n: number
}

export interface Campaign {
  id: string
  title: string
  year: number
  sourceUrl: string
  newsUrl: string
  dates: string[]
  generatedAt: string
  stats: { total: number; house: number; street: number; city: number; none: number; noTime: number; noSlots: number; moved?: number; manual?: number }
}

export interface Data {
  campaign: Campaign
  cities: City[]
  stores: Store[]
}

export interface LatLon {
  lat: number
  lon: number
}

export const CHAIN_NAME: Record<ChainCode, string> = { p: 'Пятёрочка', x: 'Перекрёсток' }

export async function loadData(): Promise<Data> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/campaign.json`)
  if (!res.ok) throw new Error(`Не удалось загрузить список магазинов (${res.status})`)
  return res.json()
}

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim()

export function distanceKm(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 20) * 50)} м`
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} км`
  return `${Math.round(km)} км`
}

export const hasPoint = (s: Store): s is Store & LatLon => s.lat !== undefined && s.lon !== undefined

/** «1 магазин», «2 магазина», «5 магазинов» */
export function plural(n: number, forms: [string, string, string]): string {
  const d = n % 10
  const dd = n % 100
  return d === 1 && dd !== 11 ? forms[0] : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? forms[1] : forms[2]
}
