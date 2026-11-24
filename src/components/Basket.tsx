import { useMemo, useState } from 'react'
import { AVERAGE_KG_PER_STORE, PRESETS, PRODUCTS, listText, totals } from '../lib/basket'
import { plural } from '../lib/data'
import { share } from '../lib/links'
import { makeShareImage } from '../lib/shareImage'

const GROUPS = [...new Set(PRODUCTS.map((p) => p.group))]
const kgText = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} г` : `${kg.toFixed(1).replace('.', ',')} кг`)

export function Basket({ campaignTitle }: { campaignTitle: string }) {
  const [items, setItems] = useState<Record<string, number>>(PRESETS[2].items)
  const [note, setNote] = useState('')
  const [image, setImage] = useState<{ url: string; file: File } | null>(null)
  const sum = useMemo(() => totals(items), [items])
  const presetId = PRESETS.find((p) => JSON.stringify(Object.entries(p.items).sort()) === JSON.stringify(Object.entries(items).filter(([, n]) => n > 0).sort()))?.id

  const change = (id: string, delta: number) =>
    setItems((prev) => {
      const next = { ...prev, [id]: Math.max(0, Math.min(9, (prev[id] ?? 0) + delta)) }
      if (!next[id]) delete next[id]
      return next
    })

  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(''), 2500)
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(listText(items))
      flash('Список скопирован — вставьте его в заметки')
    } catch {
      flash('Не получилось скопировать')
    }
  }

  async function shareBasket() {
    const text = sum.portions
      ? `Собираю набор для «Корзины доброты»: около ${sum.portions} ${plural(sum.portions, ['порции', 'порций', 'порций'])} еды для тех, кому сейчас непросто. Присоединяйтесь — найдите магазин рядом:`
      : 'Участвую в «Корзине доброты». Присоединяйтесь — найдите магазин рядом:'
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    const result = await share('Корзина рядом', text, url.toString())
    if (result === 'copied') flash('Текст и ссылка скопированы')
    if (result === 'failed') flash('Не получилось поделиться')
  }

  async function drawImage() {
    try {
      const blob = await makeShareImage({
        portions: sum.portions,
        portionsWord: plural(sum.portions, ['порция', 'порции', 'порций']),
        campaign: campaignTitle,
        site: location.host + location.pathname.replace(/\/$/, ''),
      })
      if (image) URL.revokeObjectURL(image.url)
      setImage({ url: URL.createObjectURL(blob), file: new File([blob], 'korzina-dobroty.png', { type: 'image/png' }) })
    } catch {
      flash('Не получилось нарисовать картинку')
    }
  }

  async function sendImage() {
    if (!image) return
    try {
      if (navigator.canShare?.({ files: [image.file] })) await navigator.share({ files: [image.file], title: 'Корзина рядом' })
    } catch {
      // человек закрыл меню — ничего страшного
    }
  }

  return (
    <section className="section" id="buy">
      <div className="section__head">
        <h2>Что купить</h2>
        <p>Подойдёт всё, что долго хранится: крупы, макароны, консервы, детское питание. Выберите готовый набор или соберите свой.</p>
      </div>

      <div className="presets">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" className={`preset ${presetId === preset.id ? 'preset--on' : ''}`} aria-pressed={presetId === preset.id} onClick={() => setItems(preset.items)}>
            <b>{preset.title}</b>
            <span>{preset.note}</span>
          </button>
        ))}
      </div>

      <div className="basket">
        <div className="basket__catalog">
          {GROUPS.map((group) => (
            <div key={group} className="basket__group">
              <h3>{group}</h3>
              <ul>
                {PRODUCTS.filter((p) => p.group === group).map((product) => {
                  const n = items[product.id] ?? 0
                  return (
                    <li key={product.id} className={n ? 'product product--on' : 'product'}>
                      <span className="product__name">
                        {product.name} <small>{product.pack}</small>
                      </span>
                      <span className="product__price">≈ {product.price} ₽</span>
                      <span className="stepper">
                        <button type="button" onClick={() => change(product.id, -1)} disabled={!n} aria-label={`Убрать: ${product.name}`}>
                          −
                        </button>
                        <b aria-live="polite">{n}</b>
                        <button type="button" onClick={() => change(product.id, 1)} aria-label={`Добавить: ${product.name}`}>
                          +
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <aside className="basket__summary">
          <h3>Ваш набор</h3>
          {sum.count === 0 ? (
            <p className="hint">Пока пусто. Добавьте хотя бы одну пачку — этого уже достаточно.</p>
          ) : (
            <>
              <dl className="summary">
                <div>
                  <dt>Примерно</dt>
                  <dd>{sum.price} ₽</dd>
                </div>
                <div>
                  <dt>Вес</dt>
                  <dd>{kgText(sum.kg)}</dd>
                </div>
                {sum.portions > 0 && (
                  <div className="summary__accent">
                    <dt>Это около</dt>
                    <dd>
                      {sum.portions} {plural(sum.portions, ['порции', 'порций', 'порций'])} еды
                    </dd>
                  </div>
                )}
              </dl>
              <p className="summary__context">
                В октябре один магазин за три дня акции собирал в среднем около {AVERAGE_KG_PER_STORE} кг. Ваш набор — {Math.max(1, Math.round((sum.kg / AVERAGE_KG_PER_STORE) * 100))}% такого сбора: каждая пачка заметна.
              </p>
              <div className="basket__actions">
                <button type="button" className="button button--primary" onClick={copyList}>
                  Скопировать список
                </button>
                <button type="button" className="button" onClick={shareBasket}>
                  Позвать друзей
                </button>
                <button type="button" className="button" onClick={drawImage}>
                  Картинка для соцсетей
                </button>
              </div>
              <p className="share-links">
                Рассказать:
                <a href={`https://t.me/share/url?url=${encodeURIComponent(location.origin + location.pathname)}&text=${encodeURIComponent('Найдите магазин «Корзины доброты» рядом и купите на одну пачку больше')}`} target="_blank" rel="noreferrer">
                  Telegram
                </a>
                <a href={`https://vk.com/share.php?url=${encodeURIComponent(location.origin + location.pathname)}`} target="_blank" rel="noreferrer">
                  ВКонтакте
                </a>
              </p>
              {image && (
                <figure className="share-image">
                  <img src={image.url} alt="Картинка «Я покупаю на одну пачку больше»" />
                  <figcaption>
                    <a className="button button--small" href={image.url} download="korzina-dobroty.png">
                      Скачать
                    </a>
                    {typeof navigator.canShare === 'function' && navigator.canShare({ files: [image.file] }) && (
                      <button type="button" className="button button--small" onClick={sendImage}>
                        Отправить
                      </button>
                    )}
                  </figcaption>
                </figure>
              )}
              {note && <p className="card__note">{note}</p>}
            </>
          )}
          <p className="basket__fine">Цены примерные и зависят от магазина. Скоропортящиеся продукты и товары с истекающим сроком лучше не брать.</p>
        </aside>
      </div>
    </section>
  )
}
