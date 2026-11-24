import { useMemo, useState } from 'react'
import { parseAddress } from '../../scripts/lib/address.mjs'
import { readStoreRows } from '../../scripts/lib/csv.mjs'
import { hashId } from '../../scripts/lib/id.mjs'
import { parseSlots } from '../../scripts/lib/slots.mjs'
import { plural, type Data } from '../lib/data'
import { formatDate, formatSlotTime, weekdayShort } from '../lib/time'

interface Row {
  line: number
  raw: string
  chain: string
  dates: string
  city: string | null
  pretty: string
  slots: { date: string; from: string | null; to: string | null }[]
  known: boolean
  issues: string[]
}

function analyse(text: string, year: number, knownIds: Set<string>): Row[] {
  const seen = new Set<string>()
  return readStoreRows(text).map((r, i) => {
    const address = parseAddress(r.address)
    const slots = parseSlots(r.dates, year)
    const issues: string[] = []
    if (!r.address) issues.push('Пустой адрес')
    else {
      if (!address.city) issues.push('Не понял город')
      if (!address.street) issues.push('Не понял улицу')
      if (!address.house) issues.push('Нет номера дома')
    }
    if (!slots.length) issues.push('Не понял дату')
    else if (slots.some((s) => !s.from)) issues.push('Не указано время')
    if (seen.has(r.address)) issues.push('Адрес повторяется')
    seen.add(r.address)
    return { line: i + 2, raw: r.address, chain: r.chain, dates: r.dates.replace(/\s+/g, ' '), city: address.city, pretty: address.pretty, slots, known: knownIds.has(hashId(r.address)), issues }
  })
}

/** Проверка новой таблицы прямо в браузере: файл никуда не отправляется */
export function Check({ data }: { data: Data }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [text, setText] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const knownIds = useMemo(() => new Set(data.stores.map((s) => s.id)), [data])

  function run(source: string, label: string, forYear = year) {
    try {
      setRows(analyse(source, forYear, knownIds))
      setText(source)
      setName(label)
      setError('')
    } catch (err) {
      setRows(null)
      setError((err as Error).message)
    }
  }

  async function onFile(file: File | undefined) {
    if (file) run(await file.text(), file.name)
  }

  async function loadCurrent() {
    const res = await fetch(`${import.meta.env.BASE_URL}data/table.csv`)
    setYear(data.campaign.year)
    run(await res.text(), 'таблица текущей акции', data.campaign.year)
  }

  const summary = useMemo(() => {
    if (!rows) return null
    const count = (issue: string) => rows.filter((r) => r.issues.includes(issue)).length
    const days = [...new Set(rows.flatMap((r) => r.slots.map((s) => s.date)))].sort()
    return {
      total: rows.length,
      cities: new Set(rows.map((r) => r.city)).size,
      days,
      ok: rows.filter((r) => !r.issues.length).length,
      fresh: rows.filter((r) => !r.known).length,
      problems: [
        ['Не понял дату', count('Не понял дату'), 'Сайт не покажет расписание — исправьте ячейку.'],
        ['Не указано время', count('Не указано время'), 'На сайте будет «время уточняется».'],
        ['Не понял город', count('Не понял город'), 'Магазин не попадёт в поиск по городу.'],
        ['Не понял улицу', count('Не понял улицу'), 'Точка на карте будет примерной.'],
        ['Нет номера дома', count('Нет номера дома'), 'Точка на карте будет примерной.'],
        ['Адрес повторяется', count('Адрес повторяется'), 'Одна из строк лишняя.'],
      ] as [string, number, string][],
    }
  }, [rows])

  const shown = rows ? (onlyIssues ? rows.filter((r) => r.issues.length) : rows).slice(0, 200) : []

  return (
    <div className="check-page">
      <a className="button button--small" href={location.pathname}>
        ← На сайт
      </a>
      <div className="section__head">
        <h1>Проверка таблицы перед акцией</h1>
        <p>
          Загрузите таблицу следующей акции в формате CSV — сайт сразу покажет, как покупатели увидят каждый магазин и какие строки стоит поправить. Файл обрабатывается в
          браузере и никуда не отправляется.
        </p>
      </div>

      <div className="check__input">
        <label className="button button--primary">
          Выбрать CSV-файл
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="button" onClick={loadCurrent}>
          Проверить таблицу текущей акции
        </button>
        <label className="check__year">
          Год акции
          <input
            type="number"
            value={year}
            min={2024}
            max={2100}
            onChange={(e) => {
              const next = Number(e.target.value)
              setYear(next)
              if (text) run(text, name, next)
            }}
          />
        </label>
      </div>
      <p className="hint">В Google Таблицах: Файл → Скачать → Формат CSV. Нужны колонки «Город», «Адрес», «ТС», «Дата проведения».</p>
      {error && <p className="hint hint--warn">{error}</p>}

      {summary && rows && (
        <>
          <dl className="facts facts--cards">
            <div>
              <dt>{summary.total.toLocaleString('ru')}</dt>
              <dd>
                {plural(summary.total, ['строка', 'строки', 'строк'])} в файле «{name}», {summary.cities} {plural(summary.cities, ['город', 'города', 'городов'])}
              </dd>
            </div>
            <div>
              <dt>{Math.round((summary.ok / summary.total) * 100)}%</dt>
              <dd>строк разобрано без замечаний</dd>
            </div>
            <div>
              <dt>{summary.fresh.toLocaleString('ru')}</dt>
              <dd>новых адресов, которых ещё нет на карте: координаты для них найдутся при сборке сайта</dd>
            </div>
          </dl>

          <p className="check__days">
            Дни акции в таблице: <b>{summary.days.length ? summary.days.map((d) => `${weekdayShort(d)}, ${formatDate(d)}`).join(' · ') : 'не найдены'}</b>
          </p>

          <ul className="check__problems">
            {summary.problems.map(([title, n, note]) => (
              <li key={title} className={n ? 'bad' : 'good'}>
                <b>{n}</b>
                <span>
                  {title}
                  <small>{n ? note : 'Таких строк нет.'}</small>
                </span>
              </li>
            ))}
          </ul>

          <label className="check__toggle">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Только строки с замечаниями
          </label>

          <div className="check__table">
            <table>
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>В таблице</th>
                  <th>На сайте</th>
                  <th>Расписание</th>
                  <th>Замечания</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.line} className={r.issues.length ? 'bad' : ''}>
                    <td>{r.line}</td>
                    <td className="raw">{r.raw}</td>
                    <td>
                      <b>{r.pretty}</b>
                      <small>
                        {r.city ?? '—'} · {r.chain}
                      </small>
                    </td>
                    <td>{r.slots.length ? r.slots.map((s) => <div key={s.date}>{`${formatDate(s.date)}: ${formatSlotTime([s.date, s.from, s.to])}`}</div>) : <i>{r.dates || '—'}</i>}</td>
                    <td>{r.issues.join(', ') || (r.known ? '' : 'Новый адрес')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length && !onlyIssues && <p className="hint">Показаны первые 200 строк. Включите «Только строки с замечаниями», чтобы увидеть все проблемные.</p>}
        </>
      )}
    </div>
  )
}
