// Собирает из таблицы фонда и найденных координат файл, с которым работает сайт.
// Запуск: npm run data:build  →  public/data/campaign.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStoreRows } from './lib/csv.mjs'
import { parseAddress, cityKey } from './lib/address.mjs'
import { parseSlots } from './lib/slots.mjs'
import { hashId } from './lib/id.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/campaign.config.json'), 'utf8'))
const geocodedFile = path.join(ROOT, 'data/geocoded.json')
const geocoded = fs.existsSync(geocodedFile) ? JSON.parse(fs.readFileSync(geocodedFile, 'utf8')) : {}

const norm = (s) => (s ?? '').toLowerCase().replace(/ё/g, 'е').trim()

const chainCode = (name) => (norm(name).startsWith('перекр') ? 'x' : 'p')

const rows = readStoreRows(fs.readFileSync(path.join(ROOT, config.csv), 'utf8'))
const parsed = rows.map((row) => ({ row, address: parseAddress(row.address) }))

const regionByCity = new Map()
for (const { address } of parsed) if (address.region && address.city) regionByCity.set(norm(address.city), address.region)

const cities = new Map()
const stores = []
const problems = []
const stats = { total: rows.length, house: 0, street: 0, city: 0, none: 0, noTime: 0, noSlots: 0 }
const usedIds = new Set()

for (const { row, address } of parsed) {
  if (!address.region && address.city) address.region = regionByCity.get(norm(address.city)) ?? null
  const cityName = address.city ?? address.district ?? row.cityColumn.replace(/\s+(г\.?|с\.?|пгт\.?|рп\.?)$/i, '')
  const key = address.city ? cityKey(address) : norm(`${address.region ?? ''}|${cityName}`)
  if (!cities.has(key)) cities.set(key, { name: cityName, region: address.region, points: [], n: 0 })
  const city = cities.get(key)
  city.n++

  const slots = parseSlots(row.dates, config.year)
  if (!slots.length) {
    stats.noSlots++
    problems.push(`Не понял дату «${row.dates}» — ${row.address}`)
  } else if (slots.some((s) => !s.from)) {
    stats.noTime++
  }

  const geo = geocoded[row.address] ? { ...geocoded[row.address] } : undefined
  city.federal = address.isFederalCity
  if (geo && geo.precision !== 'city') city.points.push(geo)
  if (geo?.precision === 'city') city.center = { lat: geo.lat, lon: geo.lon }

  let id = hashId(row.address)
  while (usedIds.has(id)) id += 'x'
  usedIds.add(id)

  stores.push({
    id,
    ch: chainCode(row.chain),
    ck: key,
    a: address.pretty,
    geo,
    sl: slots.map((s) => [s.date, s.from, s.to]),
    raw: row.address,
  })
}

// Проверка геокодера: магазин не может стоять в десятках километров от остальных магазинов своего города.
// Такое бывает, когда улица с тем же названием нашлась в соседнем посёлке. Сомнительные точки переносим в центр города
// и помечаем как примерные — лучше честно показать «место примерное», чем отправить человека не туда.
function distanceKm(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
const median = (values) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)]
stats.moved = 0
for (const city of cities.values()) {
  if (city.points.length < 3) continue
  const middle = { lat: median(city.points.map((p) => p.lat)), lon: median(city.points.map((p) => p.lon)) }
  const limit = city.federal ? 70 : 35
  for (const point of city.points) {
    if (distanceKm(middle, point) <= limit) continue
    point.lat = middle.lat
    point.lon = middle.lon
    point.precision = 'city'
    stats.moved++
  }
  city.points = city.points.filter((p) => p.precision !== 'city')
  city.center ??= middle
}
for (const s of stores) stats[s.geo?.precision ?? 'none']++

// центр города: среднее по точно найденным магазинам, иначе то, что вернул геокодер
const cityList = [...cities.entries()]
  .map(([key, c]) => {
    const center = c.points.length
      ? { lat: c.points.reduce((s, p) => s + p.lat, 0) / c.points.length, lon: c.points.reduce((s, p) => s + p.lon, 0) / c.points.length }
      : (c.center ?? null)
    return { key, name: c.name, region: c.region, lat: center && Number(center.lat.toFixed(5)), lon: center && Number(center.lon.toFixed(5)), n: c.n }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
const cityIndex = new Map(cityList.map((c, i) => [c.key, i]))

// магазины, найденные только до города, раскладываем вокруг центра, чтобы точки не слиплись
const approxCount = new Map()
const outStores = stores.map((s) => {
  const out = { id: s.id, ch: s.ch, c: cityIndex.get(s.ck), a: s.a, sl: s.sl }
  if (!s.geo) {
    out.pr = 'n'
    out.raw = s.raw
    return out
  }
  if (s.geo.precision === 'city') {
    const i = approxCount.get(s.ck) ?? 0
    approxCount.set(s.ck, i + 1)
    const r = 0.004 * Math.sqrt(i + 1)
    out.lat = Number((s.geo.lat + r * Math.sin(i * 2.4)).toFixed(6))
    out.lon = Number((s.geo.lon + r * 1.6 * Math.cos(i * 2.4)).toFixed(6))
    out.pr = 'c'
    out.raw = s.raw
  } else {
    out.lat = s.geo.lat
    out.lon = s.geo.lon
    out.pr = s.geo.precision === 'house' ? 'h' : 's'
  }
  return out
})

const dates = [...new Set(stores.flatMap((s) => s.sl.map((x) => x[0])))].sort()
const result = {
  campaign: {
    id: config.id,
    title: config.title,
    year: config.year,
    sourceUrl: config.sourceUrl,
    newsUrl: config.newsUrl,
    dates,
    generatedAt: new Date().toISOString().slice(0, 10),
    stats,
  },
  cities: cityList.map(({ key, ...c }) => c),
  stores: outStores,
}

const outFile = path.join(ROOT, 'public/data/campaign.json')
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(result))
// исходная таблица лежит рядом: её можно скачать с сайта и проверить на странице «Проверка таблицы»
fs.copyFileSync(path.join(ROOT, config.csv), path.join(ROOT, 'public/data/table.csv'))

console.log(`Магазинов: ${stats.total}, городов: ${cityList.length}, дни акции: ${dates.join(', ')}`)
console.log(`Координаты: до дома ${stats.house}, до улицы ${stats.street}, до города ${stats.city}, не найдено ${stats.none}`)
console.log(`Без времени: ${stats.noTime}, с непонятной датой: ${stats.noSlots}, перенесено в центр города как сомнительные: ${stats.moved}`)
for (const p of problems) console.log('  ! ' + p)
console.log(`Записано: ${path.relative(ROOT, outFile)} (${Math.round(fs.statSync(outFile).size / 1024)} КБ)`)
