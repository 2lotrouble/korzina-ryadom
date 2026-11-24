import { useState } from 'react'
import type { Campaign } from '../lib/data'

const REPO = 'https://github.com/2lotrouble/korzina-ryadom'

function embedCode(): string {
  const url = new URL(location.href)
  url.hash = ''
  url.search = '?view=embed'
  return `<iframe src="${url}" width="100%" height="760" style="border:0;border-radius:18px" loading="lazy" title="Магазины акции «Корзина доброты»"></iframe>`
}

export function ForFund({ campaign }: { campaign: Campaign }) {
  const { stats } = campaign
  const exact = Math.round(((stats.house + stats.street) / stats.total) * 100)
  const [copied, setCopied] = useState(false)
  const code = embedCode()

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // код виден на странице — его можно выделить вручную
    }
  }

  return (
    <section className="section section--fund" id="fund">
      <div className="section__head">
        <h2>Для фонда: как обновить сайт к следующей акции</h2>
        <p>
          Сайт собран из той же таблицы, которую фонд публикует перед акцией. Сервера и базы данных нет: это набор файлов, который можно выложить на любой хостинг или встроить
          в сайт акции.
        </p>
      </div>

      <ol className="steps">
        <li>
          <b>Проверить таблицу</b>
          <span>
            На <a href="?view=check">странице проверки</a> видно, как покупатели увидят каждую строку и что стоит поправить. Формат адресов и времени менять не нужно.
          </span>
        </li>
        <li>
          <b>Запустить одну команду</b>
          <span>
            <code>npm run data</code> разберёт адреса и время и найдёт координаты. Уже найденные адреса берутся из кэша, новые ищутся в открытых данных OpenStreetMap.
          </span>
        </li>
        <li>
          <b>Выложить</b>
          <span>
            <code>npm run build</code> собирает готовую папку с файлами. Её можно положить на любой хостинг.
          </span>
        </li>
      </ol>

      <dl className="facts">
        <div>
          <dt>{stats.total.toLocaleString('ru')}</dt>
          <dd>строк таблицы разобрано автоматически, вручную не правилась ни одна</dd>
        </div>
        <div>
          <dt>{exact}%</dt>
          <dd>адресов найдено на карте с точностью до дома или улицы</dd>
        </div>
        <div>
          <dt>{(stats.total - stats.noSlots).toLocaleString('ru')}</dt>
          <dd>строк с понятным расписанием, хотя время записано десятком разных способов</dd>
        </div>
      </dl>

      <div className="tools">
        <div className="tool">
          <h3>Встроить карту в новость об акции</h3>
          <p>Вместо ссылки на таблицу — живой поиск магазина прямо на странице фонда или партнёрской НКО.</p>
          <pre>
            <code>{code}</code>
          </pre>
          <div className="tool__actions">
            <button type="button" className="button button--small" onClick={copy}>
              {copied ? 'Скопировано' : 'Скопировать код'}
            </button>
            <a className="button button--small" href="?view=embed" target="_blank" rel="noreferrer">
              Посмотреть
            </a>
          </div>
        </div>
        <div className="tool">
          <h3>Плакат с QR-кодом</h3>
          <p>Листовка на A4 для входа в магазин. У каждого магазина своя: с адресом, часами работы волонтёров и QR-кодом. Кнопка «Плакат» есть в карточке магазина.</p>
          <div className="tool__actions">
            <a className="button button--small" href="?view=poster">
              Общий плакат акции
            </a>
          </div>
        </div>
        <div className="tool">
          <h3>Ссылка на город</h3>
          <p>Региональные партнёры могут дать ссылку сразу на свои магазины: кнопка «Ссылка на город» над списком.</p>
          <div className="tool__actions">
            <a className="button button--small" href="?city=Рязань">
              Пример: Рязань
            </a>
          </div>
        </div>
      </div>

      <p className="section__links">
        <a href={REPO} target="_blank" rel="noreferrer">
          Исходный код на GitHub
        </a>
        <a href={campaign.sourceUrl} target="_blank" rel="noreferrer">
          Таблица фонда, из которой взяты данные
        </a>
        <a href={`${import.meta.env.BASE_URL}data/campaign.json`} target="_blank" rel="noreferrer">
          Готовые данные с координатами (JSON)
        </a>
      </p>
    </section>
  )
}
