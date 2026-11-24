// Минимальный разбор CSV: кавычки, запятые и переводы строк внутри ячеек.

/** @returns {string[][]} */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Читает таблицу фонда: первая строка — заголовки «Город, Адрес, ТС, Дата проведения». */
export function readStoreRows(text) {
  const [header, ...rows] = parseCsv(text)
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase().startsWith(name))
  const iCity = col('город')
  const iAddress = col('адрес')
  const iChain = col('тс')
  const iDates = col('дата')
  if (iAddress < 0 || iDates < 0) throw new Error('В таблице нет колонок «Адрес» и «Дата проведения»')
  return rows.map((r) => ({
    cityColumn: (r[iCity] ?? '').trim(),
    address: (r[iAddress] ?? '').trim(),
    chain: (r[iChain] ?? '').trim(),
    dates: (r[iDates] ?? '').trim(),
  }))
}
