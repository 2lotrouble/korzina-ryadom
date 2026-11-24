import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseLatLon } from '../../scripts/lib/overrides.mjs'
import { CHAIN_NAME, hasPoint, plural, type Data, type Store } from '../lib/data'
import { downloadFile } from '../lib/links'
import { addBaseLayer } from '../lib/tiles'
import { CHAIN_COLOR } from './MapView'

type Point = [lat: number, lon: number]
type Points = Record<string, Point>

const REASON = { c: 'место примерное', n: 'нет на карте', h: 'поставлена вручную', s: 'поставлена вручную' } as const

function readDraft(key: string): Points {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Ручная правка точек: для магазинов, которые геокодер нашёл только до города.
 * Человек кликает по карте, страница собирает файл data/overrides.json. Ничего никуда не отправляется.
 */
export function Points({ data }: { data: Data }) {
  const draftKey = `korzina-points-${data.campaign.id}`
  const todo = useMemo(
    () =>
      data.stores
        .filter((s): s is Store & { raw: string } => Boolean(s.raw) && (s.pr === 'c' || s.pr === 'n' || s.m === 1))
        .sort((a, b) => data.cities[a.c].name.localeCompare(data.cities[b.c].name, 'ru') || a.a.localeCompare(b.a, 'ru')),
    [data],
  )
  const [points, setPoints] = useState<Points>(() => {
    // уже сохранённые в репозитории правки + черновик из этого браузера
    const saved: Points = {}
    for (const s of todo) if (s.m === 1 && hasPoint(s)) saved[s.raw] = [s.lat, s.lon]
    return { ...saved, ...readDraft(draftKey) }
  })
  const [currentId, setCurrentId] = useState<string | null>(todo.find((s) => !points[s.raw])?.id ?? todo[0]?.id ?? null)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const current = todo.find((s) => s.id === currentId) ?? null

  const element = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const currentRaw = useRef<string | null>(null)
  currentRaw.current = current?.raw ?? null

  function setPoint(raw: string, point: Point | null) {
    setPoints((old) => {
      const next = { ...old }
      if (point) next[raw] = point
      else delete next[raw]
      try {
        localStorage.setItem(draftKey, JSON.stringify(next))
      } catch {
        // черновик не сохранится между визитами — файл всё равно можно скачать
      }
      return next
    })
  }

  useEffect(() => {
    if (!element.current || map.current) return
    const m = L.map(element.current, { preferCanvas: true })
    addBaseLayer(m)
    m.setView([55.75, 37.62], 5)
    m.on('click', (e) => {
      if (currentRaw.current) setPoint(currentRaw.current, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))])
    })
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // выбрали магазин — показываем его город
  useEffect(() => {
    const m = map.current
    if (!m || !current) return
    setTyped('')
    const done = points[current.raw]
    const city = data.cities[current.c]
    if (done) m.setView(done, 17)
    else if (city.lat !== null && city.lon !== null) m.setView([city.lat, city.lon], 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // метка выбранного магазина
  useEffect(() => {
    const m = map.current
    if (!m) return
    marker.current?.remove()
    marker.current = null
    const point = current && points[current.raw]
    if (!point || !current) return
    marker.current = L.circleMarker(point, { radius: 11, color: '#1f2a24', weight: 3, fillColor: CHAIN_COLOR[current.ch], fillOpacity: 0.95, interactive: false }).addTo(m)
  }, [current, points])

  function applyTyped() {
    if (!current) return
    const point = parseLatLon(typed) as Point | null
    if (!point) return setNote('Не понял координаты. Нужны два числа: широта и долгота, например 54.6292, 39.7364')
    setNote('')
    setPoint(current.raw, point)
    map.current?.setView(point, 17)
  }

  const ready = Object.keys(points).length
  const json = JSON.stringify(points, null, 1)

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setNote('Скопировано')
    } catch {
      setNote('Не получилось скопировать — скачайте файл')
    }
  }

  const left = todo.filter((s) => !points[s.raw]).length

  return (
    <div className="check-page points">
      <a className="button button--small" href={location.pathname}>
        ← На сайт
      </a>
      <div className="section__head">
        <h1>Точки на карте: поправить вручную</h1>
        <p>
          Почти все адреса сайт находит сам. Здесь — магазины, которые удалось найти только до города. Выберите магазин и кликните по карте там, где он стоит. Страница
          соберёт файл с правками; ничего никуда не отправляется.
        </p>
      </div>

      {!todo.length && <p className="hint">Все магазины этой акции найдены точно — править нечего.</p>}

      {todo.length > 0 && (
        <div className="points__body">
          <ul className="points__list">
            {todo.map((s) => (
              <li key={s.id}>
                <button type="button" className={`points__item ${s.id === currentId ? 'points__item--on' : ''}`} aria-pressed={s.id === currentId} onClick={() => setCurrentId(s.id)}>
                  <span className="points__mark" data-done={Boolean(points[s.raw])} aria-hidden>
                    {points[s.raw] ? '✓' : ''}
                  </span>
                  <span>
                    <b>
                      {data.cities[s.c].name}, {s.a}
                    </b>
                    <small>
                      {CHAIN_NAME[s.ch]} · {points[s.raw] ? 'точка поставлена' : REASON[s.pr]}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="points__work">
            {current && (
              <div className="points__current">
                <p>
                  <b>
                    {CHAIN_NAME[current.ch]} · {data.cities[current.c].name}, {current.a}
                  </b>
                </p>
                <p className="points__raw">Адрес в таблице: {current.raw}</p>
                <div className="points__tools">
                  <a
                    className="button button--small"
                    href={`https://yandex.ru/maps/?text=${encodeURIComponent(`${CHAIN_NAME[current.ch]}, ${data.cities[current.c].name}, ${current.a}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Найти в Яндекс Картах
                  </a>
                  <input
                    type="text"
                    value={typed}
                    placeholder="или вставьте координаты: 54.6292, 39.7364"
                    aria-label="Координаты магазина"
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyTyped()}
                  />
                  <button type="button" className="button button--small" onClick={applyTyped} disabled={!typed.trim()}>
                    Поставить
                  </button>
                  {points[current.raw] && (
                    <button type="button" className="button button--small button--ghost" onClick={() => setPoint(current.raw, null)}>
                      Убрать точку
                    </button>
                  )}
                </div>
              </div>
            )}
            <div ref={element} className="points__map" role="application" aria-label="Карта: кликните, чтобы поставить точку магазина" />
            <p className="hint">Кликните по карте, чтобы поставить или передвинуть точку выбранного магазина.</p>
          </div>
        </div>
      )}

      {todo.length > 0 && (
        <div className="points__result">
          <h2>
            Готово {ready} из {todo.length}
            {left > 0 && (
              <small>
                {' '}
                · {plural(left, ['остался', 'осталось', 'осталось'])} {left}
              </small>
            )}
          </h2>
          <ol>
            <li>
              Скачайте файл <code>overrides.json</code>.
            </li>
            <li>
              Положите его в папку <code>data</code> репозитория (на GitHub: Add file → Upload files).
            </li>
            <li>Сайт пересоберётся сам за пару минут, и точки встанут на место. Правки сохранятся и для следующих акций: адрес магазина тот же — точка та же.</li>
          </ol>
          <div className="points__tools">
            <button type="button" className="button button--primary" disabled={!ready} onClick={() => downloadFile('overrides.json', json, 'application/json')}>
              Скачать overrides.json
            </button>
            <button type="button" className="button" disabled={!ready} onClick={copy}>
              Скопировать
            </button>
            {note && (
              <span className="card__note" role="status">
                {note}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
