// Ручные правки точек: адрес из таблицы → координаты.
// Значение можно записать как [55.75, 37.61] или строкой «55.75, 37.61» — так координаты копируются из Яндекс Карт.

/** Разбирает «55.751244, 37.618423» или [55.75, 37.61]. Возвращает [широта, долгота] или null. */
export function parseLatLon(value) {
  const parts = Array.isArray(value) ? value : String(value ?? '').match(/-?\d+(?:[.,]\d+)?/g)
  if (!parts || parts.length !== 2) return null
  const [lat, lon] = parts.map((x) => Number(String(x).replace(',', '.')))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return [Number(lat.toFixed(6)), Number(lon.toFixed(6))]
}

/** Содержимое overrides.json → Map «адрес → [широта, долгота]»; строки с ошибками пропускает. */
export function parseOverrides(json) {
  const result = new Map()
  for (const [raw, value] of Object.entries(json ?? {})) {
    const point = parseLatLon(value)
    if (point) result.set(raw, point)
  }
  return result
}
