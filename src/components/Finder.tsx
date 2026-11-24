import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAIN_NAME, distanceKm, formatDistance, hasPoint, norm, plural, type ChainCode, type Data, type LatLon, type Store } from '../lib/data'
import { buildIcs, downloadFile, routeUrl, share, storeUrl } from '../lib/links'
import { findPlace } from '../lib/place'
import { dayOfMonth, formatDate, formatSlotTime, monthName, storeStatus, weekdayShort, type Now, type Phase } from '../lib/time'
import { CHAIN_COLOR, MapView, type CityBubble, type MapFocus } from './MapView'

type GeoState = 'idle' | 'loading' | 'denied' | 'failed' | 'searching' | 'nothing'
const PAGE = 12
const STATUS_ORDER = { now: 0, today: 1, later: 2, done: 3 }

interface Props {
  data: Data
  now: Now
  phase: Phase
}

export function Finder({ data, now, phase }: Props) {
  const { campaign, cities, stores } = data
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cityIndex, setCityIndex] = useState<number | null>(null)
  const [user, setUser] = useState<LatLon | null>(null)
  const [geo, setGeo] = useState<GeoState>('idle')
  const [chain, setChain] = useState<ChainCode | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [onlyNow, setOnlyNow] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [street, setStreet] = useState('')
  /** название места, если человек искал не себя, а город, которого нет в акции */
  const [place, setPlace] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const statusOf = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof storeStatus>>()
    return (store: Store) => {
      let status = cache.get(store.id)
      if (!status) cache.set(store.id, (status = storeStatus(store, now)))
      return status
    }
  }, [now])

  const filtered = useMemo(
    () =>
      stores.filter(
        (s) => (!chain || s.ch === chain) && (!day || s.sl.some((slot) => slot[0] === day)) && (!onlyNow || statusOf(s).kind === 'now'),
      ),
    [stores, chain, day, onlyNow, statusOf],
  )
  const mapStores = useMemo(() => filtered.filter(hasPoint), [filtered])

  /** города для мелкого масштаба карты: сколько магазинов осталось после фильтров */
  const bubbles = useMemo(() => {
    const counts = new Map<number, number>()
    for (const s of filtered) counts.set(s.c, (counts.get(s.c) ?? 0) + 1)
    const result: CityBubble[] = []
    cities.forEach((city, index) => {
      if (city.lat !== null && city.lon !== null && counts.get(index)) result.push({ index, name: city.name, lat: city.lat, lon: city.lon, n: counts.get(index)! })
    })
    return result
  }, [filtered, cities])

  const list = useMemo(() => {
    if (user) {
      return mapStores
        .map((store) => ({ store: store as Store, km: distanceKm(user, store) as number | null }))
        .sort((a, b) => a.km! - b.km!)
    }
    if (cityIndex !== null) {
      const q = norm(street)
      return filtered
        .filter((s) => s.c === cityIndex && (!q || norm(s.a).includes(q)))
        .map((store) => ({ store, km: null as number | null }))
        .sort((a, b) => STATUS_ORDER[statusOf(a.store).kind] - STATUS_ORDER[statusOf(b.store).kind] || a.store.a.localeCompare(b.store.a, 'ru'))
    }
    return []
  }, [user, cityIndex, filtered, mapStores, statusOf, street])

  const suggestions = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const starts: number[] = []
    const contains: number[] = []
    cities.forEach((city, i) => {
      const name = norm(city.name)
      if (name.startsWith(q) || name.split(/[\s.-]+/).some((w) => w.startsWith(q))) starts.push(i)
      else if (name.includes(q) || norm(city.region ?? '').includes(q)) contains.push(i)
    })
    return [...starts, ...contains].slice(0, 8)
  }, [query, cities])

  const popular = useMemo(
    () =>
      cities
        .map((city, i) => ({ city, i }))
        .sort((a, b) => b.city.n - a.city.n)
        .slice(0, 8),
    [cities],
  )

  const focusOn = (key: string, points: LatLon[], maxZoom?: number) => points.length && setFocus({ key, points, maxZoom })

  function chooseCity(index: number) {
    const city = cities[index]
    setCityIndex(index)
    setUser(null)
    setQuery(city.name)
    setOpen(false)
    setSelectedId(null)
    setShown(PAGE)
    setStreet('')
    const points = stores.filter((s) => s.c === index && hasPoint(s)) as (Store & LatLon)[]
    focusOn(`city-${index}`, points.length ? points : city.lat && city.lon ? [{ lat: city.lat, lon: city.lon }] : [], 14)
  }

  /** показать ближайшие магазины к точке: к человеку или к найденному месту */
  function showNear(me: LatLon, label: string) {
    setGeo('idle')
    setUser(me)
    setPlace(label)
    setCityIndex(null)
    setQuery(label)
    setOpen(false)
    setSelectedId(null)
    setShown(PAGE)
    const nearest = (stores.filter(hasPoint) as (Store & LatLon)[])
      .map((s) => ({ s, km: distanceKm(me, s) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6)
      .map((x) => x.s)
    focusOn(`near-${me.lat.toFixed(3)}-${me.lon.toFixed(3)}`, [me, ...nearest], 15)
  }

  function locate() {
    if (!navigator.geolocation) return setGeo('failed')
    setGeo('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => showNear({ lat: pos.coords.latitude, lon: pos.coords.longitude }, ''),
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  async function searchPlace() {
    const text = query.trim()
    if (!text) return
    setGeo('searching')
    setOpen(false)
    try {
      const hit = await findPlace(text)
      if (hit) showNear(hit, hit.label)
      else setGeo('nothing')
    } catch {
      setGeo('failed')
    }
  }

  function downloadCity() {
    if (cityIndex === null) return
    const city = cities[cityIndex]
    const rows = list.map(({ store }) => [CHAIN_NAME[store.ch], store.a, store.sl.map((slot) => `${formatDate(slot[0])} ${formatSlotTime(slot)}`).join('; ')])
    const csv = [['Сеть', 'Адрес', 'Когда волонтёры'], ...rows].map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    downloadFile(`korzina-dobroty-${city.name}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  function select(id: string, from: 'map' | 'list') {
    setSelectedId(id)
    const store = stores.find((s) => s.id === id)
    if (!store) return
    if (from === 'list' && hasPoint(store)) focusOn(`store-${id}`, [store], 16)
    if (from === 'map') {
      if (!user && cityIndex !== store.c) {
        setCityIndex(store.c)
        setQuery(cities[store.c].name)
      }
      const position = list.findIndex((x) => x.store.id === id)
      if (position >= shown) setShown(position + 1)
      requestAnimationFrame(() => listRef.current?.querySelector(`[data-store="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    }
  }

  // ссылка на конкретный магазин: ?store=…
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const id = params.get('store')
    const store = id && stores.find((s) => s.id === id)
    const cityName = params.get('city')
    if (!store && cityName) {
      // ссылка на город: ?city=Рязань — удобно для постов региональных НКО
      const matches = cities.map((city, i) => ({ city, i })).filter((x) => norm(x.city.name) === norm(cityName))
      if (matches.length) chooseCity(matches.sort((a, b) => b.city.n - a.city.n)[0].i)
    }
    if (!store) return
    setCityIndex(store.c)
    setQuery(cities[store.c].name)
    setSelectedId(store.id)
    if (hasPoint(store)) setFocus({ key: `store-${store.id}`, points: [store], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyCityLink() {
    if (cityIndex === null) return
    const url = new URL(location.href)
    url.hash = ''
    url.search = ''
    url.searchParams.set('city', cities[cityIndex].name)
    try {
      await navigator.clipboard.writeText(url.toString())
      setLinkNote('Ссылка скопирована')
    } catch {
      setLinkNote(url.toString())
    }
    setTimeout(() => setLinkNote(''), 3000)
  }

  const selected = selectedId ? stores.find((s) => s.id === selectedId) : undefined
  const cityTotal = cityIndex !== null ? filtered.filter((s) => s.c === cityIndex).length : 0
  const selectedInList = selected && list.slice(0, shown).some((x) => x.store.id === selected.id)
  const hasScope = user !== null || cityIndex !== null
  const visible = list.slice(0, shown)

  return (
    <section className="finder" id="find">
      <div className="finder__controls">
        <div className="search">
          <div className="search__field">
            <input
              type="search"
              value={query}
              placeholder="Город или посёлок"
              aria-label="Город или посёлок"
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') suggestions.length ? chooseCity(suggestions[0]) : searchPlace()
                if (e.key === 'Escape') setOpen(false)
              }}
            />
            {open && query.trim() !== '' && (
              <ul className="search__list" role="listbox">
                {suggestions.map((i) => (
                  <li key={i}>
                    <button type="button" role="option" aria-selected={i === cityIndex} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseCity(i)}>
                      <span>
                        <b>{cities[i].name}</b>
                        {cities[i].region && cities[i].region !== cities[i].name && <small>{cities[i].region}</small>}
                      </span>
                      <em>
                        {cities[i].n} {plural(cities[i].n, ['магазин', 'магазина', 'магазинов'])}
                      </em>
                    </button>
                  </li>
                ))}
                {!suggestions.length && (
                  <li className="search__empty">
                    В этой акции такого города нет.
                    <button type="button" className="button button--small" onMouseDown={(e) => e.preventDefault()} onClick={searchPlace}>
                      Показать ближайшие магазины к «{query.trim()}»
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
          <button type="button" className="button button--primary" onClick={locate} disabled={geo === 'loading'}>
            <span aria-hidden>◎</span> {geo === 'loading' ? 'Ищу вас…' : 'Рядом со мной'}
          </button>
        </div>

        {geo === 'denied' && <p className="hint hint--warn">Браузер не дал доступ к местоположению. Введите город вручную — это работает так же.</p>}
        {geo === 'failed' && <p className="hint hint--warn">Не получилось определить место. Введите город вручную.</p>}
        {geo === 'searching' && <p className="hint">Ищу это место на карте…</p>}
        {geo === 'nothing' && <p className="hint hint--warn">Не нашёл такое место. Проверьте название или нажмите «Рядом со мной».</p>}

        <div className="chips" role="group" aria-label="Фильтры">
          {(['p', 'x'] as ChainCode[]).map((code) => (
            <button key={code} type="button" className={`chip ${chain === code ? 'chip--on' : ''}`} aria-pressed={chain === code} onClick={() => setChain(chain === code ? null : code)}>
              <i style={{ background: CHAIN_COLOR[code] }} /> {CHAIN_NAME[code]}
            </button>
          ))}
          <span className="chips__gap" />
          {campaign.dates.map((date) => (
            <button key={date} type="button" className={`chip ${day === date ? 'chip--on' : ''}`} aria-pressed={day === date} onClick={() => setDay(day === date ? null : date)}>
              {weekdayShort(date)}, {dayOfMonth(date)} {monthName(date).slice(0, 3)}
            </button>
          ))}
          {phase === 'during' && (
            <button type="button" className={`chip chip--live ${onlyNow ? 'chip--on' : ''}`} aria-pressed={onlyNow} onClick={() => setOnlyNow(!onlyNow)}>
              <i /> Сбор идёт сейчас
            </button>
          )}
        </div>
      </div>

      <div className="finder__body">
        <div className="finder__map">
          <MapView
            stores={mapStores}
            cities={bubbles}
            statusOf={(s) => statusOf(s).kind}
            selectedId={selectedId}
            onSelect={(id) => select(id, 'map')}
            onCity={chooseCity}
            user={user}
            focus={focus}
          />
          <p className="map__legend">
            <span>
              <i style={{ background: CHAIN_COLOR.p }} /> Пятёрочка
            </span>
            <span>
              <i style={{ background: CHAIN_COLOR.x }} /> Перекрёсток
            </span>
            <span>
              <i className="dashed" /> место примерное
            </span>
            <span>
              <i className="bubble-mini">5</i> магазинов в городе
            </span>
          </p>
        </div>

        <div className="finder__list" ref={listRef}>
          {!hasScope && (
            <div className="empty">
              <h3>С чего начать</h3>
              <p>Нажмите «Рядом со мной» или выберите город. На карте — все {campaign.stats.total.toLocaleString('ru')} магазинов акции.</p>
              <div className="chips">
                {popular.map(({ city, i }) => (
                  <button key={i} type="button" className="chip" onClick={() => chooseCity(i)}>
                    {city.name} <em>{city.n}</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected && !selectedInList && (
            <StoreCard key={selected.id} store={selected} km={user && hasPoint(selected) ? distanceKm(user, selected) : null} data={data} now={now} selected showCity onSelect={() => select(selected.id, 'list')} />
          )}

          {hasScope && (
            <p className="list__title">
              {user ? (place ? `Ближайшие к «${place}»` : 'Ближайшие к вам') : cities[cityIndex!].name}
              <span>
                {' '}
                · {list.length} {plural(list.length, ['магазин', 'магазина', 'магазинов'])}
              </span>
            </p>
          )}

          {cityIndex !== null && !user && (
            <div className="list__tools">
              {cityTotal > 6 && (
                <input type="search" value={street} placeholder="Улица" aria-label="Фильтр по улице" onChange={(e) => { setStreet(e.target.value); setShown(PAGE) }} />
              )}
              <button type="button" className="button button--small" onClick={copyCityLink}>
                Ссылка на город
              </button>
              <button type="button" className="button button--small" onClick={downloadCity} title="Список магазинов города с понятными адресами">
                Скачать список
              </button>
              {linkNote && <span className="card__note">{linkNote}</span>}
            </div>
          )}

          {user && list.length > 0 && list[0].km! > 50 && (
            <p className="hint hint--warn">
              Ближайший магазин акции — в {formatDistance(list[0].km!)}. Похоже, рядом с этим местом акция в этот раз не проходит.
            </p>
          )}

          {hasScope && !list.length && <p className="hint">Таких магазинов нет. Проверьте фильтры по дню, сети и улице.</p>}

          {visible.map(({ store, km }) => (
            <StoreCard key={store.id} store={store} km={km} data={data} now={now} selected={store.id === selectedId} showCity={user !== null} onSelect={() => select(store.id, 'list')} />
          ))}

          {list.length > shown && (
            <button type="button" className="button button--ghost button--wide" onClick={() => setShown(shown + PAGE)}>
              Показать ещё {Math.min(PAGE, list.length - shown)}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

interface CardProps {
  store: Store
  km: number | null
  data: Data
  now: Now
  selected: boolean
  showCity: boolean
  onSelect: () => void
}

function StoreCard({ store, km, data, now, selected, showCity, onSelect }: CardProps) {
  const [note, setNote] = useState('')
  const city = data.cities[store.c]
  const status = storeStatus(store, now)

  async function onShare() {
    const result = await share(`«${data.campaign.title}» рядом`, `Здесь можно передать продукты тем, кому сейчас непросто: ${CHAIN_NAME[store.ch]}, ${city.name}, ${store.a}.`, storeUrl(store))
    setNote(result === 'copied' ? 'Ссылка скопирована' : result === 'failed' ? 'Не получилось поделиться' : '')
    setTimeout(() => setNote(''), 2500)
  }

  return (
    <article className={`card ${selected ? 'card--selected' : ''} ${status.kind === 'done' ? 'card--done' : ''}`} data-store={store.id}>
      <button type="button" className="card__main" onClick={onSelect} aria-pressed={selected}>
        <span className="card__top">
          <span className="chain" style={{ color: CHAIN_COLOR[store.ch] }}>
            <i style={{ background: CHAIN_COLOR[store.ch] }} />
            {CHAIN_NAME[store.ch]}
          </span>
          {km !== null && <span className="card__km">{formatDistance(km)}</span>}
        </span>
        <span className="card__address">{store.a}</span>
        {showCity && <span className="card__city">{city.name}</span>}
        <span className={`status status--${status.kind}`}>{status.label}</span>
      </button>

      <ul className="slots">
        {store.sl.map((slot) => (
          <li key={slot[0]} className={slot[0] === now.date ? 'slots__today' : slot[0] < now.date ? 'slots__past' : ''}>
            <span>
              {weekdayShort(slot[0])}, {formatDate(slot[0])}
            </span>
            <b>{formatSlotTime(slot)}</b>
          </li>
        ))}
      </ul>

      {(store.pr === 'c' || store.pr === 'n') && (
        <p className="card__approx">
          {store.pr === 'c' ? 'Точка на карте примерная.' : 'Этого адреса нет на карте.'} Адрес по таблице фонда: {store.raw}
        </p>
      )}

      <div className="card__actions">
        <a className="button button--small" href={routeUrl(store, city)} target="_blank" rel="noreferrer">
          Маршрут
        </a>
        {status.kind !== 'done' && (
          <button type="button" className="button button--small" onClick={() => downloadFile(`korzina-dobroty-${store.id}.ics`, buildIcs(store, city, data.campaign), 'text/calendar;charset=utf-8')}>
            В календарь
          </button>
        )}
        <button type="button" className="button button--small" onClick={onShare}>
          Поделиться
        </button>
        <a className="button button--small" href={`?view=poster&store=${store.id}`} title="Листовка на дверь магазина с QR-кодом">
          Плакат
        </a>
        {note && <span className="card__note">{note}</span>}
      </div>
    </article>
  )
}
