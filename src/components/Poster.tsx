import qrcode from 'qrcode-generator'
import { useMemo } from 'react'
import { CHAIN_NAME, type Data, type Store } from '../lib/data'
import { formatDate, formatRange, formatSlotTime, weekday } from '../lib/time'

function siteUrl(store: Store | null): string {
  const url = new URL(location.href)
  url.hash = ''
  url.search = ''
  if (store) url.searchParams.set('store', store.id)
  return url.toString()
}

function qrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
}

const BUY = ['Крупы', 'Макароны', 'Консервы', 'Детское питание', 'Масло', 'Чай']

/** Листовка на дверь магазина: печатается на A4, QR-код ведёт на страницу этого магазина */
export function Poster({ data, store }: { data: Data; store: Store | null }) {
  const city = store ? data.cities[store.c] : null
  const url = siteUrl(store)
  const qr = useMemo(() => qrSvg(url), [url])

  return (
    <div className="poster-page">
      <div className="poster-tools">
        <a className="button button--small" href={url}>
          ← На сайт
        </a>
        <button type="button" className="button button--small button--primary" onClick={() => window.print()}>
          Напечатать
        </button>
        <span className="hint">Лист A4, книжная ориентация. Черновик листовки для волонтёров и магазина.</span>
      </div>

      <article className="poster">
        <p className="poster__eyebrow">Акция «{data.campaign.title}»</p>
        <h1>Здесь собирают продукты для тех, кому сейчас непросто</h1>

        {store && city ? (
          <div className="poster__where">
            <p>
              <b>{CHAIN_NAME[store.ch]}</b> · {city.name}, {store.a}
            </p>
            <ul>
              {store.sl.map((slot) => (
                <li key={slot[0]}>
                  <span>
                    {weekday(slot[0])}, {formatDate(slot[0])}
                  </span>
                  <b>{formatSlotTime(slot)}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="poster__where">
            <p>
              <b>{formatRange(data.campaign.dates)}</b> · в {data.campaign.stats.total.toLocaleString('ru')} магазинах «Пятёрочка» и «Перекрёсток»
            </p>
          </div>
        )}

        <ol className="poster__steps">
          <li>
            <b>1</b>
            <span>Купите продукты, которые долго хранятся</span>
          </li>
          <li>
            <b>2</b>
            <span>Отдайте их волонтёрам у выхода</span>
          </li>
          <li>
            <b>3</b>
            <span>Фонд передаст их пожилым людям и семьям с детьми</span>
          </li>
        </ol>

        <div className="poster__bottom">
          <div>
            <h2>Что купить</h2>
            <ul className="poster__buy">
              {BUY.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="poster__one">Достаточно одной пачки крупы.</p>
          </div>
          <div className="poster__qr">
            <div dangerouslySetInnerHTML={{ __html: qr }} />
            <p>Наведите камеру: другие магазины акции и готовый список покупок</p>
          </div>
        </div>

        <p className="poster__fine">Данные — из открытой таблицы фонда «Выручаем». Неофициальный материал проекта «Корзина рядом».</p>
      </article>
    </div>
  )
}
