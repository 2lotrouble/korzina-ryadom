import { useEffect, useState } from 'react'
import { Basket } from './components/Basket'
import { Check } from './components/Check'
import { Finder } from './components/Finder'
import { ForFund } from './components/ForFund'
import { Poster } from './components/Poster'
import { Stats } from './components/Stats'
import { Why } from './components/Why'
import { loadData, plural, type Data } from './lib/data'
import { campaignPhase, daysUntil, formatDate, formatRange, useNow, type Now, type Phase } from './lib/time'

export function App() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const now = useNow()

  useEffect(() => {
    loadData().then(setData, (err: Error) => setError(err.message))
  }, [])

  const phase = data ? campaignPhase(data.campaign.dates, now) : 'after'
  const params = new URLSearchParams(location.search)
  const view = params.get('view')

  if (view === 'poster' || view === 'check' || view === 'embed') {
    if (error) return <p className="hint hint--warn hint--center">{error}</p>
    if (!data) return <p className="hint hint--center">Загружаю список магазинов…</p>
    if (view === 'poster') return <Poster data={data} store={data.stores.find((s) => s.id === params.get('store')) ?? null} />
    if (view === 'check') return <Check data={data} />
    return (
      <div className="embed">
        <Finder data={data} now={now} phase={phase} />
        <p className="embed__foot">
          «{data.campaign.title}», {formatRange(data.campaign.dates)} ·{' '}
          <a href={location.pathname} target="_blank" rel="noreferrer">
            Что купить и как помочь — на сайте «Корзина рядом»
          </a>
        </p>
      </div>
    )
  }

  return (
    <>
      <header className="top">
        <a className="logo" href="#find">
          <span aria-hidden>🧺</span> Корзина рядом
        </a>
        <nav>
          <a href="#find">Найти магазин</a>
          <a href="#buy">Что купить</a>
          <a href="#numbers">Цифры</a>
          <a href="#fund">Для фонда</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <p className="hero__eyebrow">Акция «Корзина доброты» в «Пятёрочке» и «Перекрёстке»</p>
          <h1>Купите на одну пачку больше — и отдайте волонтёрам</h1>
          <p className="hero__lead">
            В дни акции волонтёры собирают в магазинах продукты для пожилых людей и семей с детьми, которым сейчас непросто. Найдите магазин рядом, узнайте, когда там
            волонтёры и что лучше купить.
          </p>
          <ol className="hero__steps">
            <li>
              <b>1</b> Найдите магазин
            </li>
            <li>
              <b>2</b> Купите продукты
            </li>
            <li>
              <b>3</b> Отдайте волонтёрам у выхода
            </li>
          </ol>
          {data && (
            <dl className="hero__numbers">
              <div>
                <dt>{data.campaign.stats.total.toLocaleString('ru')}</dt>
                <dd>{plural(data.campaign.stats.total, ['магазин', 'магазина', 'магазинов'])} акции</dd>
              </div>
              <div>
                <dt>{data.cities.length}</dt>
                <dd>{plural(data.cities.length, ['город', 'города', 'городов и посёлков'])}</dd>
              </div>
              <div>
                <dt>{formatRange(data.campaign.dates)}</dt>
                <dd>{data.campaign.year} года</dd>
              </div>
            </dl>
          )}
          {data && <PhaseBanner data={data} now={now} phase={phase} />}
        </section>

        {error && <p className="hint hint--warn hint--center">{error}</p>}
        {!data && !error && <p className="hint hint--center">Загружаю список магазинов…</p>}
        {data && <Finder data={data} now={now} phase={phase} />}

        <Basket campaignTitle={data?.campaign.title ?? 'Корзина доброты'} />
        <Why />
        {data && <Stats data={data} />}
        {data && <ForFund campaign={data.campaign} />}
      </main>

      <footer className="footer">
        <p>
          Неофициальный проект, сделан для конкурса «Вайбкодинг добрых дел». Не связан с X5 Group и фондом «Выручаем». Список магазинов и время — из открытой таблицы фонда
          {data && <>, обновлено {formatDate(data.campaign.generatedAt)}</>}. Перед поездкой сверяйтесь с{' '}
          <a href={data?.campaign.newsUrl ?? 'https://выручаем.рф'} target="_blank" rel="noreferrer">
            новостью фонда
          </a>
          .
        </p>
        <p>Карта: © участники OpenStreetMap.</p>
      </footer>
    </>
  )
}

function PhaseBanner({ data, now, phase }: { data: Data; now: Now; phase: Phase }) {
  const { campaign } = data
  const range = formatRange(campaign.dates)
  const stores = `${campaign.stats.total.toLocaleString('ru')} ${plural(campaign.stats.total, ['магазине', 'магазинах', 'магазинах'])}`
  const cities = `${data.cities.length} ${plural(data.cities.length, ['городе', 'городах и посёлках', 'городах и посёлках'])}`

  if (now.demo) {
    return (
      <div className="banner banner--demo">
        <p>
          <b>Демонстрация.</b> Сайт показан так, как он выглядит в день акции: {formatDate(now.date)}, {String(Math.floor(now.minutes / 60)).padStart(2, '0')}:
          {String(now.minutes % 60).padStart(2, '0')}.
        </p>
        <a className="button button--small" href={location.pathname}>
          Вернуться к сегодняшнему дню
        </a>
      </div>
    )
  }

  if (phase === 'during') {
    return (
      <div className="banner banner--live">
        <p>
          <b>Акция идёт: {range}.</b> Продукты собирают в {stores}, в {cities}.
        </p>
      </div>
    )
  }

  if (phase === 'before') {
    const days = daysUntil(campaign.dates[0], now)
    return (
      <div className="banner">
        <p>
          <b>
            Акция пройдёт {range} — через {days} {plural(days, ['день', 'дня', 'дней'])}.
          </b>{' '}
          Выберите магазин и добавьте напоминание в календарь.
        </p>
      </div>
    )
  }

  const demoDate = campaign.dates[Math.min(1, campaign.dates.length - 1)]
  return (
    <div className="banner">
      <p>
        <b>Акция прошла {range}</b> в {stores}. Следующую фонд обычно проводит через месяц. Ниже — где она проходила.
      </p>
      {demoDate && (
        <a className="button button--small" href={`?demo=${demoDate}T17:30`}>
          Показать, как сайт выглядит в день акции
        </a>
      )}
    </div>
  )
}
