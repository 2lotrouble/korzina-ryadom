import { CHAIN_NAME, plural, type Campaign, type City, type Store } from './data'
import { dayOfMonth, formatRange, formatSlotTime, monthName, weekdayShort } from './time'

/** Telegram не пропускает сообщения длиннее 4096 знаков — оставляем запас на подпись и ссылку */
const POST_LIMIT = 3600

const slotText = (store: Store) =>
  store.sl.map((slot) => `${weekdayShort(slot[0])} ${dayOfMonth(slot[0])} ${monthName(slot[0]).slice(0, 3)}, ${formatSlotTime(slot)}`).join('; ')

/**
 * Готовый текст объявления для городского паблика или чата НКО.
 * Магазины с одинаковым расписанием собраны вместе, чтобы пост не превращался в простыню.
 */
export function cityPost(city: City, stores: Store[], campaign: Campaign, url: string): string {
  const days = [...new Set(stores.flatMap((s) => s.sl.map((slot) => slot[0])))].sort()
  const head = [
    `«${campaign.title}» — ${city.name}, ${formatRange(days.length ? days : campaign.dates)}`,
    '',
    'Купите продукты с долгим сроком годности — крупы, макароны, консервы, детское питание — и отдайте волонтёрам у выхода из магазина. Их получат пожилые люди и семьи с детьми, которым сейчас непросто.',
    '',
    `Где и когда (${stores.length} ${plural(stores.length, ['магазин', 'магазина', 'магазинов'])}):`,
  ]
  const tail = ['', `Карта, время работы волонтёров и список, что купить: ${url}`]

  const groups = new Map<string, Store[]>()
  for (const store of stores) {
    const key = slotText(store)
    groups.set(key, [...(groups.get(key) ?? []), store])
  }

  const body: string[] = []
  let length = [...head, ...tail].join('\n').length
  let listed = 0
  outer: for (const [when, group] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const title = `\n${when}:`
    let titleAdded = false
    for (const store of group) {
      const line = `• ${CHAIN_NAME[store.ch]}, ${store.a}`
      const cost = line.length + 1 + (titleAdded ? 0 : title.length + 1)
      if (length + cost > POST_LIMIT) break outer
      if (!titleAdded) {
        body.push(title)
        titleAdded = true
      }
      body.push(line)
      length += cost
      listed++
    }
  }
  if (listed < stores.length) body.push(`\n…и ещё ${stores.length - listed} — все адреса на карте по ссылке.`)

  return [...head, ...body, ...tail].join('\n')
}
