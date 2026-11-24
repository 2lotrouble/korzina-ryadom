// Получает координаты магазинов из таблицы фонда.
// Запуск: npm run data:geocode                      (все адреса; повторный запуск берёт готовое из кэша)
//         node scripts/geocode.mjs --limit 30        (проба на первых 30 адресах)
//         node scripts/geocode.mjs --provider photon (выбрать геокодер вручную: photon или nominatim)
//         node scripts/geocode.mjs --new-only        (искать только адреса, которых ещё нет в data/geocoded.json:
//                                                     так работает обновление на GitHub — быстро и без лишних запросов)
//         node scripts/geocode.mjs --refine          (поискать заново и то, что найдено только до улицы;
//                                                     результат заменяется, только если стал точнее)
//
// Оба геокодера открытые, работают на данных OpenStreetMap и не требуют ключа:
//   Photon (photon.komoot.io) — быстрый; Nominatim (nominatim.openstreetmap.org) — запасной, не больше запроса в секунду.
// По умолчанию скрипт проверяет, отвечает ли Photon, и если нет — переходит на Nominatim.
// Каждый результат проверяется: регион должен совпасть, а номер дома — с тем, что в таблице.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStoreRows } from './lib/csv.mjs'
import { parseAddress, cityKey, streetVariants } from './lib/address.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/campaign.config.json'), 'utf8'))
const CACHE_FILE = path.join(ROOT, 'data/geocache.json')
const OUT_FILE = path.join(ROOT, 'data/geocoded.json')
const USER_AGENT = 'korzina-ryadom/0.1 (open-source store finder for a food drive)'
const TIMEOUT_MS = 20_000

const PROVIDERS = {
  photon: { url: 'https://photon.komoot.io/api/', pauseMs: 350, workers: 2 },
  nominatim: { url: 'https://nominatim.openstreetmap.org/search', pauseMs: 1100, workers: 1 },
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const REFINE = process.argv.includes('--refine')
const NEW_ONLY = process.argv.includes('--new-only')
/** после стольких сбоев подряд считаем, что геокодер недоступен, и больше его не ждём */
const MAX_FAILURES_IN_A_ROW = 6
const RANK = { house: 3, street: 2, city: 1 }

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {}
let requests = 0
let failures = 0
let failuresInRow = 0
let down = false
let dirty = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => (s ?? '').toLowerCase().replace(/ё/g, 'е').trim()
const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))

/**
 * Очередь запросов: Nominatim просит не больше одного запроса в секунду, сколько бы потоков ни работало.
 * У Photon такого правила нет — там каждый поток просто делает паузу.
 */
let nominatimTurn = Promise.resolve()
function turn(providerName) {
  const pause = PROVIDERS[providerName].pauseMs
  if (providerName !== 'nominatim') return sleep(pause)
  const mine = nominatimTurn.then(() => sleep(pause))
  nominatimTurn = mine
  return mine
}

/** Запрос к геокодеру с кэшем, паузой и повторами. Возвращает массив или null, если сервер недоступен. */
async function request(providerName, params, normalize) {
  const provider = PROVIDERS[providerName]
  const query = new URLSearchParams(params).toString()
  const key = providerName === 'photon' ? query : `${providerName}:${query}`
  if (cache[key]) return cache[key]
  if (down) return null

  for (let attempt = 1; ; attempt++) {
    try {
      await turn(providerName)
      const res = await fetch(`${provider.url}?${query}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const items = normalize(await res.json())
      cache[key] = items
      requests++
      failuresInRow = 0
      if (++dirty >= 25) {
        saveCache()
        dirty = 0
      }
      return items
    } catch (err) {
      if (attempt >= 3 || down) {
        failures++
        if (++failuresInRow >= MAX_FAILURES_IN_A_ROW && !down) {
          down = true
          console.warn(
            providerName === 'photon' && !arg('provider')
              ? '  ! Photon не отвечает.'
              : '  ! Геокодер не отвечает. Оставшиеся адреса пока останутся без точных координат — запустите поиск ещё раз позже.',
          )
        }
        if (failures <= 20) console.warn(`  ! нет ответа (${err.message}): ${query.slice(0, 80)}`)
        return null
      }
      await sleep(5000 * attempt)
    }
  }
}

/** Общий вид результата у обоих геокодеров: координаты, номер дома, это улица или нет, и текст для сверки региона. */
const fromPhoton = (json) =>
  (json.features ?? [])
    .filter((f) => f.properties.countrycode === 'RU')
    .map((f) => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      hn: f.properties.housenumber ?? null,
      street: f.properties.street ?? (f.properties.type === 'street' ? f.properties.name : null) ?? null,
      isStreet: f.properties.type === 'street' || Boolean(f.properties.street),
      isPlace: f.properties.type !== 'house' && f.properties.type !== 'street',
      name: f.properties.name ?? '',
      where: `${f.properties.state ?? ''} ${f.properties.county ?? ''} ${f.properties.city ?? ''} ${f.properties.name ?? ''}`,
    }))

const fromNominatim = (json) =>
  (Array.isArray(json) ? json : []).map((r) => {
    const a = r.address ?? {}
    return {
      lat: Number(r.lat),
      lon: Number(r.lon),
      hn: a.house_number ?? null,
      street: a.road ?? null,
      // площадь, микрорайон, квартал: в таблице они часто стоят на месте улицы
      area: `${r.name ?? ''} ${a.neighbourhood ?? ''} ${a.suburb ?? ''} ${a.quarter ?? ''} ${a.city_block ?? ''}`,
      isStreet: r.category === 'highway' || Boolean(a.road),
      isPlace: r.category === 'place' || r.category === 'boundary',
      name: r.name ?? '',
      where: `${a.state ?? ''} ${a.region ?? ''} ${a.county ?? ''} ${a.city ?? ''} ${a.town ?? ''} ${a.village ?? ''} ${r.name ?? ''}`,
    }
  })

function distanceKm(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** выполняет задачи по очереди в несколько потоков */
async function pool(items, workers, worker) {
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const i = next++
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: workers }, run))
}

/** «Удмуртская Республика» и «Удмуртия» должны совпасть: сравниваем по началу главного слова */
function regionStem(region) {
  const words = norm(region)
    .split(/[\s-]+/)
    .filter((w) => !['область', 'республика', 'край', 'ао', 'автономная', 'автономный', 'округ'].includes(w))
  const main = words.sort((a, b) => b.length - a.length)[0] ?? ''
  return main.slice(0, 5)
}
const sameRegion = (item, region) => !region || norm(item.where).includes(regionStem(region))

const bareName = (label) => (label ?? '').replace(/^(с\.|пгт|пос\.|рп|ст-ца|д\.|сл\.|х\.)\s+/, '')
const normHouse = (h) =>
  norm(h)
    .replace(/корпус|корп\.?|к\./g, 'к')
    .replace(/строение|стр\.?/g, 'с')
    .replace(/[\s.]/g, '')
const houseDigits = (h) => (norm(h).match(/\d+/) ?? [''])[0]

/** Населённый пункт для запроса: у Москвы и Петербурга внутренний посёлок точнее, чем сам город */
const placeName = (address) => bareName(address.isFederalCity && address.locality ? address.locality.split(',')[0] : address.city)

/** Дом с нужным номером мог найтись на другой улице: сверяем главное слово названия. */
const streetStem = (name) =>
  norm(name)
    .split(/[\s.,-]+/)
    .filter((w) => w.length > 3)
    .sort((a, b) => b.length - a.length)[0]
    ?.slice(0, 5) ?? ''
const sameStreet = (item, address) => {
  const stem = streetStem(address.streetName)
  return !item.street || !stem || norm(item.street).includes(stem)
}

function pickHouse(items, address, check) {
  const wantFull = normHouse(address.house)
  const wantBase = normHouse(address.houseBase)
  const ranked = items
    .filter((item) => item.hn && check(item) && sameStreet(item, address))
    .map((item) => {
      const got = normHouse(item.hn)
      return { item, rank: got === wantFull ? 3 : got === wantBase ? 2 : houseDigits(item.hn) === houseDigits(address.houseBase) ? 1 : 0 }
    })
    .filter((x) => x.rank > 0)
    .sort((a, b) => b.rank - a.rank)
  return ranked[0]?.item ?? null
}

// ——— Photon: сначала центр города, потом дом рядом с ним ———

const photonCenters = new Map()

async function photonCity(address) {
  const key = cityKey(address)
  if (photonCenters.has(key)) return photonCenters.get(key)
  const name = bareName(address.city)
  let center = null
  for (const parts of [[address.cityFull, address.district, address.region], [name, address.region]]) {
    const items = await request('photon', { q: parts.filter(Boolean).join(', '), limit: '6', lang: 'default' }, fromPhoton)
    const hit = items?.find((x) => x.isPlace && (norm(x.name).includes(norm(name)) || norm(name).includes(norm(x.name))) && sameRegion(x, address.region))
    if (hit) {
      center = { lat: hit.lat, lon: hit.lon }
      break
    }
  }
  photonCenters.set(key, center)
  return center
}

async function photonStore(address) {
  const center = address.city ? await photonCity(address) : null
  const radius = address.isFederalCity ? 60 : 30
  const place = [bareName(address.locality?.split(',')[0]), bareName(address.city)].filter(Boolean).join(', ')
  const near = (item) => (center ? distanceKm(center, item) <= radius : sameRegion(item, address.region))
  const bias = center ? { lat: center.lat.toFixed(4), lon: center.lon.toFixed(4), zoom: '11' } : {}

  if (address.houseBase) {
    const q = [`${address.streetFull ?? ''} ${address.houseBase}`.trim(), place, address.region].filter(Boolean).join(', ')
    const items = await request('photon', { q, limit: '6', lang: 'default', ...bias }, fromPhoton)
    const hit = items && pickHouse(items, address, near)
    if (hit) return { lat: hit.lat, lon: hit.lon, precision: 'house' }
  }
  if (address.streetFull) {
    const q = [address.streetFull, place, address.region].filter(Boolean).join(', ')
    const items = await request('photon', { q, limit: '6', lang: 'default', ...bias }, fromPhoton)
    const hit = items?.find((x) => x.isStreet && near(x) && sameStreet(x, address))
    if (hit) return { lat: hit.lat, lon: hit.lon, precision: 'street' }
  }
  return center ? { ...center, precision: 'city' } : null
}

// ——— Nominatim: запрос по полям «улица, город, регион» ———

const NOMINATIM_BASE = { format: 'jsonv2', addressdetails: '1', limit: '4', countrycodes: 'ru', 'accept-language': 'ru' }
const nominatimCenters = new Map()

function nominatimPlace(address) {
  const fields = { city: placeName(address) }
  // на карте округа названы полностью: «Ханты-Мансийский автономный округ», а не «АО»
  const state = address.region?.replace(/ АО$/, ' автономный округ')
  if (state && (!address.isFederalCity || address.locality)) fields.state = state
  return fields
}

async function nominatimCity(address) {
  const key = cityKey(address)
  if (nominatimCenters.has(key)) return nominatimCenters.get(key)
  const items = await request('nominatim', { ...NOMINATIM_BASE, ...nominatimPlace(address) }, fromNominatim)
  const hit = items?.find((x) => sameRegion(x, address.region)) ?? null
  const center = hit ? { lat: hit.lat, lon: hit.lon } : null
  nominatimCenters.set(key, center)
  return center
}

async function nominatimStore(address) {
  // улица с тем же названием и домом бывает в соседнем городе того же региона — сверяем ещё и расстояние до центра города
  const center = address.city ? await nominatimCity(address) : null
  const radius = address.isFederalCity ? 70 : 35
  const inRegion = (item) => sameRegion(item, address.region) && (!center || distanceKm(center, item) <= radius)

  if (address.streetFull) {
    // Nominatim ждёт «номер дома, затем улица»; если дома нет в OpenStreetMap, он сам вернёт улицу
    const street = [address.houseBase, address.streetFull].filter(Boolean).join(' ')
    const items = await request('nominatim', { ...NOMINATIM_BASE, street, ...nominatimPlace(address) }, fromNominatim)
    if (items) {
      const house = address.houseBase ? pickHouse(items, address, inRegion) : null
      if (house) return { lat: house.lat, lon: house.lon, precision: 'house' }
      const road = items.find((x) => x.isStreet && inRegion(x))
      if (road) return { lat: road.lat, lon: road.lon, precision: 'street' }
    }
    // улицу не нашли под названием из таблицы — пробуем короче: без «им.», инициалов и имени
    let fallback = null
    for (const variant of streetVariants(address)) {
      const street = [address.houseBase, variant].filter(Boolean).join(' ')
      const found = await request('nominatim', { ...NOMINATIM_BASE, street, ...nominatimPlace(address) }, fromNominatim)
      if (!found) continue
      const house = address.houseBase ? pickHouse(found, address, inRegion) : null
      if (house) return { lat: house.lat, lon: house.lon, precision: 'house' }
      const road = found.find((x) => x.isStreet && inRegion(x))
      if (road && !fallback) fallback = { lat: road.lat, lon: road.lon, precision: 'street' }
    }
    if (fallback) return fallback
  }
  if (address.houseBase) {
    // последняя попытка — запрос одной строкой: так находятся дома без улицы («пос. Развилка, 33», «Зеленоград, к1508»)
    const where = address.streetFull ?? bareName(address.locality?.split(',')[0])
    const house = (address.house ?? address.houseBase).replace(/корп\.\s*/, 'к')
    const q = [[where, house].filter(Boolean).join(' '), bareName(address.city), address.region].filter(Boolean).join(', ')
    const items = await request('nominatim', { ...NOMINATIM_BASE, q }, fromNominatim)
    const hit = items && pickHouse(items, address, inRegion)
    if (hit) return { lat: hit.lat, lon: hit.lon, precision: 'house' }
  }

  if (center) {
    const loose = await nominatimLoose(address, center)
    if (loose) return loose
  }
  return center ? { ...center, precision: 'city' } : null
}

/**
 * Последняя попытка перед «только город»: строка «город, улица, дом» без региона.
 * Выручает, когда регион на карте записан иначе, чем в таблице (Саров стоит в Нижегородской области,
 * а на карте относится к Мордовии), когда вместо улицы — площадь или микрорайон, и когда магазин стоит
 * в деревне, приписанной к городу. Регион не сверяем, зато требуем, чтобы точка была рядом с центром города,
 * а название улицы или места совпало.
 */
async function nominatimLoose(address, center) {
  const stem = streetStem(address.streetName ?? address.streetFull)
  const nearCity = (item) => distanceKm(center, item) <= (address.isFederalCity ? 60 : 30)
  const named = (item) => Boolean(stem) && norm(`${item.street ?? ''} ${item.area ?? ''}`).includes(stem)
  const house = address.house ? address.house.replace(/корп\.\s*/, 'к').replace(/\s+/g, '') : null

  if (address.streetFull) {
    for (const street of new Set([address.streetFull, ...streetVariants(address)])) {
      const q = [bareName(address.city), street, house].filter(Boolean).join(', ')
      const items = await request('nominatim', { ...NOMINATIM_BASE, q }, fromNominatim)
      if (!items) continue
      const exact = address.houseBase ? pickHouse(items, address, (item) => nearCity(item) && named(item)) : null
      if (exact) return { lat: exact.lat, lon: exact.lon, precision: 'house' }
      const place = items.find((item) => nearCity(item) && named(item))
      if (place) return { lat: place.lat, lon: place.lon, precision: 'street' }
    }
    return null
  }

  // улицы нет, есть только деревня или посёлок при городе: «Сергиев Посад г., Березняки д., Дом 110а»
  const village = bareName(address.locality?.split(',')[0])
  if (!village) return null
  const villageStem = streetStem(village)
  const q = [village, bareName(address.city), address.region].filter(Boolean).join(', ')
  const items = await request('nominatim', { ...NOMINATIM_BASE, q }, fromNominatim)
  const hit = items?.find((item) => item.isPlace && nearCity(item) && Boolean(villageStem) && norm(item.name).includes(villageStem))
  return hit ? { lat: hit.lat, lon: hit.lon, precision: 'street' } : null
}

// ——— запуск ———

async function chooseProvider() {
  const wanted = arg('provider')
  if (wanted && PROVIDERS[wanted]) return wanted
  try {
    const res = await fetch(`${PROVIDERS.photon.url}?q=${encodeURIComponent('Тула')}&limit=1`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
    if (res.ok) return 'photon'
  } catch {
    // не отвечает — берём запасной
  }
  return 'nominatim'
}

const rows = readStoreRows(fs.readFileSync(path.join(ROOT, config.csv), 'utf8')).slice(0, LIMIT)
const parsed = rows.map((r) => ({ raw: r.address, address: parseAddress(r.address) }))

// регион есть не в каждой строке: берём его у соседей из того же города
const regionByCity = new Map()
for (const { address } of parsed) if (address.region && address.city) regionByCity.set(norm(address.city), address.region)
for (const { address } of parsed) if (!address.region && address.city) address.region = regionByCity.get(norm(address.city)) ?? null

let providerName = await chooseProvider()
let findStore = providerName === 'photon' ? photonStore : nominatimStore
console.log(`Адресов: ${parsed.length}. Геокодер: ${providerName}.`)

// уже найденное с точностью до дома или улицы не ищем заново — так можно докручивать результат несколькими запусками
const out = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : {}
const todo = parsed.filter(({ raw }) => !out[raw] || (!NEW_ONLY && (out[raw].precision === 'city' || (REFINE && out[raw].precision === 'street'))))
const stat = { house: 0, street: 0, city: 0, none: 0 }
const write = () => fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1))
console.log(`Уже найдено точно: ${parsed.length - todo.length}, осталось: ${todo.length}.`)

let done = 0
await pool(todo, PROVIDERS[providerName].workers, async ({ raw, address }) => {
  const startedWith = findStore
  let hit = await startedWith(address)
  if (down && providerName === 'photon' && !arg('provider')) {
    // Photon прошёл проверку связи, но перестал отвечать: продолжаем на запасном геокодере
    console.warn('  Перехожу на запасной геокодер Nominatim.')
    providerName = 'nominatim'
    findStore = nominatimStore
    down = false
    failuresInRow = 0
  }
  // этот адрес начинали искать на отвалившемся геокодере — ищем заново на запасном
  if (startedWith !== findStore) hit = await findStore(address)
  // геокодер отвалился посреди поиска: неточный ответ не сохраняем, чтобы адрес нашёлся при следующем запуске
  if (down && hit?.precision !== 'house') hit = null
  // дом, найденный в стороне от уже известной улицы, — скорее всего тёзка из соседнего посёлка
  const farFromStreet = hit && out[raw]?.precision === 'street' && distanceKm(hit, out[raw]) > 8
  if (hit && !farFromStreet && (!out[raw] || RANK[hit.precision] > RANK[out[raw].precision])) {
    out[raw] = { lat: Number(hit.lat.toFixed(6)), lon: Number(hit.lon.toFixed(6)), precision: hit.precision }
    stat[hit.precision]++
  } else if (!out[raw]) {
    stat.none++
  }
  if (++done % 50 === 0) {
    write()
    console.log(`  ${done}/${todo.length}: дом ${stat.house}, улица ${stat.street}, город ${stat.city}, не найдено ${stat.none} (запросов ${requests}, сбоев ${failures})`)
  }
})

write()
saveCache()
console.log(`Готово. Стало точнее — до дома: ${stat.house}, до улицы: ${stat.street}, до города: ${stat.city}; не найдено: ${stat.none}. Сбоев сети: ${failures}.`)
