// Разбор адресов из таблицы фонда.
// Вход:  «655017, Хакасия респ., Абакан г., Ленина пр-кт, Дом 56, помещение 146Н»
// Выход: регион, населённый пункт, улица, дом и человеческая запись «пр-т Ленина, 56».

/** тип улицы в таблице → [короткая запись, полная запись] */
const STREET_TYPES = {
  'ул.': ['ул.', 'улица'],
  'ул': ['ул.', 'улица'],
  'улица': ['ул.', 'улица'],
  'пр-кт': ['пр-т', 'проспект'],
  'проспект': ['пр-т', 'проспект'],
  'пер.': ['пер.', 'переулок'],
  'пер': ['пер.', 'переулок'],
  'ш.': ['ш.', 'шоссе'],
  'б-р': ['б-р', 'бульвар'],
  'пл.': ['пл.', 'площадь'],
  'пл': ['пл.', 'площадь'],
  'пр-д': ['пр-д', 'проезд'],
  'наб.': ['наб.', 'набережная'],
  'мкр.': ['мкр.', 'микрорайон'],
  'кв-л': ['кв-л', 'квартал'],
  'ззд.': ['заезд', 'заезд'],
  'туп.': ['туп.', 'тупик'],
  'ал.': ['аллея', 'аллея'],
  'тер.': ['', ''],
}

/** тип населённого пункта → [префикс для показа, слово для геокодера] */
const SETTLEMENT_TYPES = {
  'г.': ['', ''],
  'г': ['', ''],
  'с.': ['с.', 'село'],
  'с': ['с.', 'село'],
  'пгт.': ['пгт', 'посёлок'],
  'пгт': ['пгт', 'посёлок'],
  'п.': ['пос.', 'посёлок'],
  'п': ['пос.', 'посёлок'],
  'рп.': ['рп', 'посёлок'],
  'рп': ['рп', 'посёлок'],
  'ст-ца': ['ст-ца', 'станица'],
  'д.': ['д.', 'деревня'],
  'сл.': ['сл.', 'слобода'],
  'х.': ['х.', 'хутор'],
  'нп.': ['', ''],
  'г-к': ['', ''],
}

const FEDERAL_CITIES = ['москва', 'санкт-петербург', 'севастополь']
const SMALL_WORDS = new Set(['на', 'по', 'де', 'лет', 'и', 'им.', 'имени'])
const HOUSE_RE = /^(дом|здание|строение|владение|домовладение|сооружение|д\.)\s*(\S.*)$/i
const BARE_HOUSE_RE = /^\d+\s*[а-яё]?(\s*[/-]\s*\d*\s*[а-яё]?)?$/i
const ADJECTIVE_RE = /(ая|яя|ий|ый|ой|ое|ее|ья|ье|ьи)$/i

const squash = (s) => s.replace(/\s+/g, ' ').trim()
const lower = (s) => s.toLowerCase().replace(/ё/g, 'е')

/** «анжеро-судженск» → «Анжеро-Судженск»; строки, где уже есть заглавные, не трогаем */
export function titleCase(s) {
  if (/[A-ZА-ЯЁ]/.test(s)) return s
  return s
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part, j) => (SMALL_WORDS.has(part) && (i > 0 || j > 0) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('-'),
    )
    .join(' ')
}

function splitSuffix(token) {
  const words = token.split(' ')
  if (words.length < 2) return null
  return { name: words.slice(0, -1).join(' '), type: lower(words[words.length - 1]) }
}

function prettyRegion(token) {
  let t = token.replace(/\s+-\s+.*$/, '') // «чувашская республика - чувашия» → «чувашская республика»
  t = titleCase(squash(t))
  let m
  if ((m = t.match(/^(.+?)\s+(обл\.?|область)$/i))) return `${m[1]} область`
  if ((m = t.match(/^(.+?)\s+(респ\.?|республика)$/i))) return ADJECTIVE_RE.test(m[1]) ? `${m[1]} Республика` : `Республика ${m[1]}`
  if ((m = t.match(/^(.+?)\s+а\.окр\.$/i))) return `${m[1]} АО`
  if ((m = t.match(/^(.+?)\s+а\.обл\.$/i))) return `${m[1]} автономная область`
  return t
}

const isRegion = (token) => /(^|\s)(обл\.?|область|край|респ\.?|республика|а\.окр\.|а\.обл\.)(\s|$)/i.test(token)

function cleanHouse(value) {
  return squash(value)
    .replace(/\s*([/-])\s*/g, '$1')
    .replace(/(\d)\s+([а-яё])$/i, '$1$2')
    .replace(/[а-яё]+$/i, (letters) => (letters.length === 1 ? letters.toUpperCase() : letters))
}

/**
 * @param {string} raw адрес из таблицы
 * @returns {{
 *   postcode: string|null, region: string|null, district: string|null,
 *   city: string|null, cityFull: string|null, locality: string|null,
 *   street: string|null, streetFull: string|null, house: string|null, houseBase: string|null,
 *   pretty: string, isFederalCity: boolean
 * }}
 */
export function parseAddress(raw) {
  const tokens = raw.split(',').map(squash).filter(Boolean)
  const out = {
    postcode: null,
    region: null,
    district: null,
    city: null,
    cityFull: null,
    locality: null,
    street: null,
    streetFull: null,
    house: null,
    houseBase: null,
    pretty: '',
    isFederalCity: false,
  }
  let area = null // микрорайон или территория, если после неё идёт настоящая улица
  let lastWasHouse = false

  for (const token of tokens) {
    if (/^\d{6}$/.test(token)) {
      out.postcode = token
      continue
    }

    if (out.house) {
      // после дома допускаем только корпус, строение и литеру, всё остальное — помещения и этажи
      const parts = [...token.matchAll(/(корпус|строение|литера?|лит\.?)\s*([\dа-яё]+)/gi)]
      if (parts.length) {
        for (const [, kind, value] of parts) {
          const k = lower(kind)
          out.house += k.startsWith('корп') ? ` к${value}` : k.startsWith('стр') ? ` с${value}` : value.toUpperCase()
        }
        lastWasHouse = false
        continue
      }
      if (lastWasHouse && /^[а-яё]$/i.test(token)) {
        out.house += token.toUpperCase()
        out.houseBase = out.house
        lastWasHouse = false
        continue
      }
      break
    }

    const house = token.match(HOUSE_RE)
    if (house && /\d/.test(house[2]) && (out.city || out.street)) {
      out.house = cleanHouse(house[2].replace(/\s+(корпус|строение|литер|пом|этаж).*$/i, ''))
      out.houseBase = out.house
      lastWasHouse = true
      const tail = [...house[2].matchAll(/(корпус|строение)\s*([\dа-яё]+)/gi)]
      for (const [, kind, value] of tail) out.house += lower(kind).startsWith('корп') ? ` к${value}` : ` с${value}`
      continue
    }

    const suffix = splitSuffix(token)

    if (!out.region && !out.city && suffix && suffix.type.replace('.', '') === 'г' && FEDERAL_CITIES.includes(lower(suffix.name))) {
      out.region = titleCase(lower(suffix.name))
      out.city = out.region
      out.cityFull = out.region
      out.isFederalCity = true
      continue
    }

    if (!out.city && !out.region && isRegion(token)) {
      out.region = prettyRegion(token)
      continue
    }

    if (suffix && suffix.type === 'р-н' && !out.street) {
      out.district = `${titleCase(suffix.name)} район`
      continue
    }

    if (suffix && SETTLEMENT_TYPES[suffix.type] && !out.street) {
      const [prefix, word] = SETTLEMENT_TYPES[suffix.type]
      const name = titleCase(suffix.name)
      const label = prefix ? `${prefix} ${name}` : name
      if (!out.city) {
        out.city = label
        out.cityFull = word ? `${word} ${name}` : name
      } else {
        out.locality = out.locality ? `${out.locality}, ${label}` : label
      }
      continue
    }

    let street = null
    if (suffix && STREET_TYPES[suffix.type]) {
      street = { name: titleCase(suffix.name), type: STREET_TYPES[suffix.type] }
    } else {
      const first = lower(token.split(' ')[0])
      if (STREET_TYPES[first] && token.includes(' ')) {
        street = { name: titleCase(token.split(' ').slice(1).join(' ')), type: STREET_TYPES[first] }
      }
    }

    if (street) {
      const [short, full] = street.type
      const nameFirst = ADJECTIVE_RE.test(street.name.split(' ').pop()) || /^\d+-/.test(street.name)
      const pretty = !short ? street.name : nameFirst ? `${street.name} ${short}` : `${short} ${street.name}`
      const prettyFull = !full ? street.name : nameFirst ? `${street.name} ${full}` : `${full} ${street.name}`
      if (out.street) {
        // «Железнодорожный мкр., Ленина ул.» — первое становится уточнением, второе улицей
        area = out.street
      }
      out.street = pretty
      out.streetFull = prettyFull
      continue
    }

    if (out.street && BARE_HOUSE_RE.test(token)) {
      out.house = cleanHouse(token)
      out.houseBase = out.house
      lastWasHouse = true
      continue
    }

    if (out.city && !out.street) {
      // непонятный кусок между городом и домом считаем названием улицы: «Сибирский тракт 1 км»
      out.street = titleCase(token)
      out.streetFull = out.street
      continue
    }
  }

  const line = [out.locality, area, out.street].filter(Boolean).join(', ')
  out.pretty = [line, out.house].filter(Boolean).join(', ') || squash(raw)
  return out
}

/** ключ для группировки магазинов по городу */
export const cityKey = (a) => lower(`${a.region ?? ''}|${a.city ?? ''}`)
