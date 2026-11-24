import { useMemo } from 'react'
import { plural, type Data } from '../lib/data'
import { dayOfMonth, formatDate, formatRange, monthName, weekday, weekdayShort } from '../lib/time'

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <i style={{ width: `${(row.value / max) * 100}%` }} />
          <b>{row.value}</b>
        </li>
      ))}
    </ul>
  )
}

/** Акция в цифрах: всё посчитано из той же таблицы фонда */
export function Stats({ data }: { data: Data }) {
  const { campaign, cities, stores } = data

  const { regions, byDay, chains } = useMemo(() => {
    const regionCount = new Map<string, number>()
    for (const city of cities) if (city.region) regionCount.set(city.region, (regionCount.get(city.region) ?? 0) + city.n)
    const dayCount = new Map<string, number>()
    const chainCount = { p: 0, x: 0 }
    for (const store of stores) {
      chainCount[store.ch]++
      for (const slot of store.sl) dayCount.set(slot[0], (dayCount.get(slot[0]) ?? 0) + 1)
    }
    return {
      regions: [...regionCount].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      byDay: campaign.dates.map((date) => ({ date, label: `${weekdayShort(date)}, ${dayOfMonth(date)} ${monthName(date)}`, value: dayCount.get(date) ?? 0 })),
      chains: chainCount,
    }
  }, [campaign, cities, stores])

  const small = cities.filter((c) => c.n <= 2).length
  const busiest = [...byDay].sort((a, b) => b.value - a.value)[0]

  return (
    <section className="section" id="numbers">
      <div className="section__head">
        <h2>Акция в цифрах</h2>
        <p>Всё посчитано из таблицы фонда для акции {formatRange(campaign.dates)}.</p>
      </div>

      <dl className="facts facts--cards">
        <div>
          <dt>{campaign.stats.total.toLocaleString('ru')}</dt>
          <dd>
            {plural(campaign.stats.total, ['магазин', 'магазина', 'магазинов'])}: {chains.p.toLocaleString('ru')} «Пятёрочек» и {chains.x} «Перекрёстков»
          </dd>
        </div>
        <div>
          <dt>{cities.length}</dt>
          <dd>городов и посёлков, из них в {small} — всего один-два магазина акции</dd>
        </div>
        <div>
          <dt>{regions.length}</dt>
          <dd>
            {plural(regions.length, ['регион', 'региона', 'регионов'])} России. Больше всего магазинов: {regions
              .slice(0, 3)
              .map((r) => r.label)
              .join(', ')}
          </dd>
        </div>
      </dl>

      <div className="stats">
        <div className="stats__block">
          <h3>Где больше всего магазинов</h3>
          <Bars rows={regions.slice(0, 10)} />
        </div>
        <div className="stats__block">
          <h3>Сколько магазинов собирают в каждый день</h3>
          <Bars rows={byDay} />
          {busiest && (
            <p className="hint">
              Больше всего точек работает {formatDate(busiest.date)} ({weekday(busiest.date)}): {busiest.value.toLocaleString('ru')} из {campaign.stats.total.toLocaleString('ru')}. В этот день проще всего
              найти магазин рядом.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
