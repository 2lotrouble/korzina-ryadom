// Подключает таблицу новой акции: скачивает её и записывает в настройки.
// Запуск: node scripts/fetch-table.mjs --url <ссылка на Google-таблицу> --id 2026-12 [--news <ссылка на новость фонда>]
// После этого: npm run data (координаты и данные для сайта).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStoreRows } from './lib/csv.mjs'
import { parseSlots } from './lib/slots.mjs'
import { csvUrl, parseCampaignId } from './lib/sheet.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_FILE = path.join(ROOT, 'data/campaign.config.json')
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  const value = i > 0 ? process.argv[i + 1] : undefined
  return value && !value.startsWith('--') ? value.trim() : undefined
}
const fail = (message) => {
  console.error(`Ошибка: ${message}`)
  process.exit(1)
}

const link = arg('url') ?? config.sourceUrl
const url = csvUrl(link)
if (!url) fail(`не похоже на ссылку: «${link}». Нужна ссылка на Google-таблицу со списком магазинов.`)
const campaign = parseCampaignId(arg('id') ?? config.id)
if (!campaign) fail(`месяц акции нужен в виде ГГГГ-ММ, например 2026-12, а получено «${arg('id')}».`)

console.log(`Скачиваю таблицу: ${url}`)
const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) }).catch((err) => fail(`таблица не скачалась (${err.message}).`))
if (!res.ok) fail(`таблица не скачалась (ответ ${res.status}). Проверьте, что она открыта для всех, у кого есть ссылка.`)
const text = await res.text()
if (/^\s*<(!doctype|html)/i.test(text)) fail('вместо таблицы пришла веб-страница. Откройте доступ: Настройки доступа → «Все, у кого есть ссылка».')

let rows
try {
  rows = readStoreRows(text)
} catch (err) {
  fail(`${err.message} Нужны колонки «Город», «Адрес», «ТС», «Дата проведения».`)
}
if (rows.length < 5) fail(`в таблице всего ${rows.length} строк с магазинами — похоже, это не тот лист.`)
const withDates = rows.filter((r) => parseSlots(r.dates, campaign.year).length).length
if (withDates < rows.length / 2) fail(`дата понятна только в ${withDates} строках из ${rows.length}. Проверьте колонку «Дата проведения».`)

const csv = `data/raw/stores-${campaign.id}.csv`
fs.mkdirSync(path.join(ROOT, 'data/raw'), { recursive: true })
fs.writeFileSync(path.join(ROOT, csv), text)
const next = { ...config, id: campaign.id, year: campaign.year, csv, sourceUrl: link, newsUrl: arg('news') ?? (campaign.id === config.id ? config.newsUrl : 'https://выручаем.рф') }
fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n')

console.log(`Готово: ${rows.length} магазинов, дата понятна в ${withDates}. Файл: ${csv}`)
console.log('Дальше: npm run data — найдёт координаты новых адресов и соберёт данные для сайта.')
