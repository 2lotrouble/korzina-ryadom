import { describe, expect, it } from 'vitest'
import { parseAddress, streetVariants } from './address.mjs'
import { parseSlots } from './slots.mjs'

describe('адреса из таблицы фонда', () => {
  it('убирает индекс и помещения, ставит тип улицы на место', () => {
    const a = parseAddress('655017, Хакасия респ., Абакан г., Ленина пр-кт, Дом 56, помещение 146Н')
    expect(a.region).toBe('Республика Хакасия')
    expect(a.city).toBe('Абакан')
    expect(a.pretty).toBe('пр-т Ленина, 56')
  })

  it('оставляет прилагательное перед типом улицы', () => {
    expect(parseAddress('Рязанская обл., Рязань г., Мервинская ул., Дом 2б').pretty).toBe('Мервинская ул., 2Б')
  })

  it('собирает корпус и строение', () => {
    expect(parseAddress('Новгородская обл., Великий Новгород г., Кочетова ул., Дом 6, Корпус 2 Строение 1').pretty).toBe('ул. Кочетова, 6 к2 с1')
  })

  it('исправляет строчные буквы', () => {
    const a = parseAddress('623050, свердловская обл, нижнесергинский р-н, бисерть пгт, красных борцов ул, дом 6')
    expect(a.region).toBe('Свердловская область')
    expect(a.city).toBe('пгт Бисерть')
    expect(a.pretty).toBe('ул. Красных Борцов, 6')
  })

  it('понимает Москву и населённый пункт внутри неё', () => {
    const a = parseAddress('124683, Москва г., Зеленоград г., 1508')
    expect(a.city).toBe('Москва')
    expect(a.isFederalCity).toBe(true)
    expect(a.pretty).toBe('Зеленоград, корп. 1508')
  })

  it('не путает «Домовладение» с «Дом»', () => {
    expect(parseAddress('Ставропольский край, Михайловск г., Пушкина ул., Домовладение 56').pretty).toBe('ул. Пушкина, 56')
  })

  it('сокращает длинные названия регионов', () => {
    expect(parseAddress('628400, Ханты-Мансийский Автономный округ - Югра АО, Сургут г., Ленина пр-кт, Дом 9а').region).toBe('Ханты-Мансийский АО')
    expect(parseAddress('Кемеровская область - Кузбасс обл, Кемерово г., Ленина пр-кт, Дом 1').region).toBe('Кемеровская область')
  })
})

describe('запасные названия улиц для геокодера', () => {
  const variants = (raw) => streetVariants(parseAddress(raw))

  it('убирает имя перед фамилией', () => {
    expect(variants('Новгородская обл., Боровичи г., Алексея Кузнецова ул., Дом 64')).toEqual(['улица Кузнецова'])
  })
  it('убирает инициалы', () => {
    expect(variants('Белгородская обл., Белгород г., Б.Хмельницкого пр-кт, Дом 80а')).toEqual(['проспект Хмельницкого'])
  })
  it('убирает «им»', () => {
    expect(variants('Волгоградская обл., Волжский г., им Ленина пр-кт, Дом 97')).toEqual(['проспект Ленина'])
  })
  it('не трогает обычные названия', () => {
    expect(variants('Рязанская обл., Рязань г., Мервинская ул., Дом 2б')).toEqual([])
  })
})

describe('время проведения', () => {
  const short = (text) => parseSlots(text, 2026).map((s) => `${s.date.slice(5)} ${s.from ?? '?'}-${s.to ?? '?'}`)

  it('«с … до …» по дням', () => {
    expect(short('20 ноября с 16.00 до 20.00;\n21 ноября с 12.00 до 18.00')).toEqual(['11-20 16:00-20:00', '11-21 12:00-18:00'])
  })

  it('несколько дней с одним временем', () => {
    expect(short('19, 20 ноября 15-19.00')).toEqual(['11-19 15:00-19:00', '11-20 15:00-19:00'])
  })

  it('диапазон дней', () => {
    expect(short('20-22 ноября, 12-20.00')).toEqual(['11-20 12:00-20:00', '11-21 12:00-20:00', '11-22 12:00-20:00'])
  })

  it('два периода подряд без разделителя', () => {
    expect(short('19, 20 ноября 15-19.00 21 ноября 12-16.00')).toEqual(['11-19 15:00-19:00', '11-20 15:00-19:00', '11-21 12:00-16:00'])
  })

  it('день без времени не теряется', () => {
    expect(short('19-20 ноября 15-19.00 21 ноября')).toEqual(['11-19 15:00-19:00', '11-20 15:00-19:00', '11-21 ?-?'])
    expect(short('20, 21 ноября')).toEqual(['11-20 ?-?', '11-21 ?-?'])
  })
})

describe('ручные правки точек', async () => {
  const { parseLatLon, parseOverrides } = await import('./overrides.mjs')

  it('понимает координаты, скопированные из карт', () => {
    expect(parseLatLon('55.751244, 37.618423')).toEqual([55.751244, 37.618423])
    expect(parseLatLon('55,7512 37,6184')).toEqual([55.7512, 37.6184]) // запятая вместо точки
    expect(parseLatLon('55.75')).toBeNull()
    expect(parseLatLon([54.6, 39.7])).toEqual([54.6, 39.7])
    expect(parseLatLon('54.6; 39.7')).toEqual([54.6, 39.7])
  })

  it('отбрасывает мусор и невозможные координаты', () => {
    expect(parseLatLon('')).toBeNull()
    expect(parseLatLon('где-то в центре')).toBeNull()
    expect(parseLatLon('155.7, 37.6')).toBeNull()
    expect(parseOverrides({ 'ул. Ленина, 1': '54.6, 39.7', 'ул. Мира, 2': 'нет' }).size).toBe(1)
  })
})

describe('ссылка на таблицу новой акции', async () => {
  const { csvUrl, parseCampaignId } = await import('./sheet.mjs')

  it('превращает ссылку на Google-таблицу в ссылку на выгрузку', () => {
    expect(csvUrl('https://docs.google.com/spreadsheets/d/1EN_UUkJ4GrCLz2ytDwN/edit?gid=0#gid=0')).toBe('https://docs.google.com/spreadsheets/d/1EN_UUkJ4GrCLz2ytDwN/export?format=csv&gid=0')
    expect(csvUrl('https://docs.google.com/spreadsheets/d/abc-DEF_123/')).toBe('https://docs.google.com/spreadsheets/d/abc-DEF_123/export?format=csv')
    expect(csvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=1730')).toContain('gid=1730')
  })

  it('обычную ссылку на файл не трогает, а не-ссылку отклоняет', () => {
    expect(csvUrl('https://example.org/stores.csv')).toBe('https://example.org/stores.csv')
    expect(csvUrl('таблица за декабрь')).toBeNull()
    expect(csvUrl('')).toBeNull()
  })

  it('проверяет месяц акции', () => {
    expect(parseCampaignId('2026-12')).toEqual({ id: '2026-12', year: 2026 })
    expect(parseCampaignId(' 2027-01 ')).toEqual({ id: '2027-01', year: 2027 })
    expect(parseCampaignId('декабрь')).toBeNull()
    expect(parseCampaignId('2026-13')).toBeNull()
  })
})

describe('улицы с типом в названии и сокращёнными именами', () => {
  it('не приписывает «улица» к шоссе и тракту', () => {
    const a = parseAddress('301841, Тульская обл., Ефремовский р-н, Ефремов г., Тульское шоссе ул., Дом 18, п.1-25')
    expect(a.pretty).toBe('Тульское шоссе, 18')
    expect(a.streetFull).toBe('Тульское шоссе')
    expect(streetVariants(a)).toEqual([])
  })

  it('убирает сокращённое имя и сложные инициалы', () => {
    expect(streetVariants(parseAddress('427433, Удмуртская респ., Воткинск г., Ст.Разина ул., Дом 9а'))).toEqual(['улица Разина'])
    expect(streetVariants(parseAddress('625022, Тюменская обл., Тюмень г., Ю.-Р.Г.Эрвье ул., Дом 22'))).toEqual(['улица Эрвье'])
  })
})
