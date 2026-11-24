import type { LatLon } from './data'

/**
 * Ищет на карте любое место по названию: город, которого нет в акции, район или адрес.
 * Нужно, чтобы показать ближайшие магазины тем, у кого в городе акция не проходит.
 * Запрос уходит в открытый геокодер OpenStreetMap только по нажатию кнопки.
 */
export async function findPlace(query: string): Promise<(LatLon & { label: string }) | null> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'ru', 'accept-language': 'ru', q: query })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (!res.ok) throw new Error(`Геокодер ответил ${res.status}`)
  const [hit] = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[]
  if (!hit) return null
  return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.name || hit.display_name.split(',')[0] }
}
