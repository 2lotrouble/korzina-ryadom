// Разбор колонки «Дата проведения».
// В таблице фонда встречается больше десятка способов записать одно и то же:
// «20 ноября с 16.00 до 20.00; 21 ноября с 12.00 до 18.00», «19, 20 ноября 15-19.00», «20-22 ноября, 12-20.00»…

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
const MONTH_RE = '(январ[яь]|феврал[яь]|марта?|апрел[яь]|ма[яй]|июн[яь]|июл[яь]|августа?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь])'
const DAYS_RE = '(\\d{1,2}(?:\\s*[,–-]\\s*\\d{1,2})*)'
const TIME_RE = '(?:[\\s,;]*(?:с\\s*)?(\\d{1,2})(?:[.:](\\d{2}))?\\s*(?:до|–|-)\\s*(\\d{1,2})(?:[.:](\\d{2}))?(?!\\s*' + MONTH_RE + '))?'
const SEGMENT_RE = new RegExp(`${DAYS_RE}\\s+${MONTH_RE}${TIME_RE}`, 'gi')

const pad = (n) => String(n).padStart(2, '0')

function expandDays(text) {
  const days = []
  for (const part of text.split(',')) {
    const range = part.split(/[–-]/).map((x) => Number(x.trim()))
    if (range.length === 2 && range[1] >= range[0]) {
      for (let d = range[0]; d <= range[1]; d++) days.push(d)
    } else {
      days.push(...range)
    }
  }
  return days
}

/**
 * @param {string} text значение ячейки
 * @param {number} year год акции
 * @returns {{ date: string, from: string|null, to: string|null }[]} по одной записи на день; время null, если в таблице его нет
 */
export function parseSlots(text, year) {
  const slots = []
  const source = text.replace(/\s+/g, ' ').trim()
  for (const m of source.matchAll(SEGMENT_RE)) {
    const [, daysText, monthText, fromH, fromM, toH, toM] = m
    const month = MONTHS.findIndex((stem) => monthText.toLowerCase().startsWith(stem) && (stem !== 'ма' || /^ма[яй]$/i.test(monthText)))
    if (month < 0) continue
    const hasTime = fromH !== undefined && toH !== undefined && Number(fromH) < 24 && Number(toH) <= 24
    for (const day of expandDays(daysText)) {
      if (day < 1 || day > 31) continue
      slots.push({
        date: `${year}-${pad(month + 1)}-${pad(day)}`,
        from: hasTime ? `${pad(fromH)}:${fromM ?? '00'}` : null,
        to: hasTime ? `${pad(toH)}:${toM ?? '00'}` : null,
      })
    }
  }
  slots.sort((a, b) => a.date.localeCompare(b.date))
  return slots
}
