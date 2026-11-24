// Ссылка на Google-таблицу → ссылка на её выгрузку в CSV.

/**
 * Понимает ссылки вида https://docs.google.com/spreadsheets/d/<id>/edit?gid=123#gid=123
 * и возвращает адрес выгрузки нужного листа. Обычную ссылку на .csv отдаёт как есть.
 * @returns {string | null}
 */
export function csvUrl(link) {
  const text = String(link ?? '').trim()
  if (!/^https?:\/\//.test(text)) return null
  const sheet = text.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (!sheet) return text
  const gid = text.match(/[#?&]gid=(\d+)/)
  return `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ''}`
}

/** «2026-12» → { id: '2026-12', year: 2026 }; всё остальное — null */
export function parseCampaignId(value) {
  const m = String(value ?? '').trim().match(/^(20\d{2})-(0[1-9]|1[0-2])$/)
  return m ? { id: m[0], year: Number(m[1]) } : null
}
