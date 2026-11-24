import { CHAIN_NAME, hasPoint, type Campaign, type City, type Store } from './data'

/** Маршрут в Яндекс Картах: до точки, если она точная, иначе поиск по адресу */
export function routeUrl(store: Store, city: City): string {
  if (hasPoint(store) && store.pr === 'h') return `https://yandex.ru/maps/?rtext=~${store.lat},${store.lon}&rtt=pd`
  const text = `${city.name}, ${store.a}, ${CHAIN_NAME[store.ch]}`
  return `https://yandex.ru/maps/?text=${encodeURIComponent(text)}`
}

export function storeUrl(store: Store): string {
  const url = new URL(location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('store', store.id)
  return url.toString()
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
const icsTime = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

/** Файл для календаря: по событию на каждый день, когда в магазине волонтёры */
export function buildIcs(store: Store, city: City, campaign: Campaign): string {
  const location = `${CHAIN_NAME[store.ch]}, ${city.name}, ${store.a}`
  const events = store.sl.map(([date, from, to], i) => {
    const lines = ['BEGIN:VEVENT', `UID:${campaign.id}-${store.id}-${i}@korzina-ryadom`, `DTSTAMP:${icsTime(campaign.generatedAt, '00:00')}`]
    if (from && to) {
      // время без часового пояса: календарь покажет его как местное
      lines.push(`DTSTART:${icsTime(date, from)}`, `DTEND:${icsTime(date, to)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`)
    }
    lines.push(
      `SUMMARY:${icsEscape(`«${campaign.title}»: купить и передать продукты`)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(`Купите продукты с долгим сроком годности и отдайте волонтёрам у выхода.\n${storeUrl(store)}`)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Через час волонтёры будут в магазине',
      'END:VALARM',
      'END:VEVENT',
    )
    return lines.join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//korzina-ryadom//RU', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n')
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Делится через системное меню, а если его нет — копирует в буфер. Возвращает, что получилось. */
export async function share(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch (err) {
    return (err as Error).name === 'AbortError' ? 'shared' : 'failed'
  }
}
