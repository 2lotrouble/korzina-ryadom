// Что можно купить для акции. Фонд просит продукты с длительным сроком годности:
// крупы, консервы, детское питание. Цены примерные — их легко поправить здесь.

export interface Product {
  id: string
  name: string
  pack: string
  /** примерная цена, ₽ */
  price: number
  /** вес упаковки, кг */
  kg: number
  /** сколько порций получается из упаковки; 0 — это основа для готовки, а не блюдо */
  portions: number
  group: 'Крупы и макароны' | 'Консервы' | 'Для готовки' | 'Детям' | 'К чаю'
}

export const PRODUCTS: Product[] = [
  { id: 'grechka', name: 'Гречка', pack: '800 г', price: 85, kg: 0.8, portions: 10, group: 'Крупы и макароны' },
  { id: 'ris', name: 'Рис', pack: '800 г', price: 95, kg: 0.8, portions: 10, group: 'Крупы и макароны' },
  { id: 'makarony', name: 'Макароны', pack: '450 г', price: 55, kg: 0.45, portions: 5, group: 'Крупы и макароны' },
  { id: 'ovsyanka', name: 'Овсяные хлопья', pack: '400 г', price: 50, kg: 0.4, portions: 8, group: 'Крупы и макароны' },
  { id: 'ryba', name: 'Рыбные консервы', pack: '240 г', price: 110, kg: 0.24, portions: 2, group: 'Консервы' },
  { id: 'tushenka', name: 'Тушёнка', pack: '325 г', price: 190, kg: 0.325, portions: 3, group: 'Консервы' },
  { id: 'goroshek', name: 'Горошек или фасоль', pack: '400 г', price: 90, kg: 0.4, portions: 4, group: 'Консервы' },
  { id: 'maslo', name: 'Подсолнечное масло', pack: '0,9 л', price: 130, kg: 0.83, portions: 0, group: 'Для готовки' },
  { id: 'muka', name: 'Мука', pack: '1 кг', price: 60, kg: 1, portions: 0, group: 'Для готовки' },
  { id: 'sahar', name: 'Сахар', pack: '1 кг', price: 75, kg: 1, portions: 0, group: 'Для готовки' },
  { id: 'kasha', name: 'Детская каша', pack: '200 г', price: 120, kg: 0.2, portions: 8, group: 'Детям' },
  { id: 'pure', name: 'Детское пюре', pack: '90 г', price: 45, kg: 0.09, portions: 1, group: 'Детям' },
  { id: 'chai', name: 'Чай', pack: '100 пакетиков', price: 150, kg: 0.2, portions: 0, group: 'К чаю' },
  { id: 'pechenie', name: 'Печенье', pack: '300 г', price: 70, kg: 0.3, portions: 0, group: 'К чаю' },
]

export interface Preset {
  id: string
  title: string
  note: string
  items: Record<string, number>
}

export const PRESETS: Preset[] = [
  { id: 'one', title: 'Одна пачка', note: 'Самый простой способ помочь', items: { grechka: 1 } },
  { id: 'base', title: 'На 150 ₽', note: 'Крупа и макароны', items: { grechka: 1, makarony: 1 } },
  { id: 'dinner', title: 'На 300 ₽', note: 'Несколько полноценных ужинов', items: { grechka: 1, makarony: 1, ovsyanka: 1, ryba: 1 } },
  { id: 'week', title: 'На 500 ₽', note: 'Запас на неделю для одного человека', items: { grechka: 1, ris: 1, makarony: 1, maslo: 1, ryba: 1 } },
  { id: 'baby', title: 'Семье с малышом', note: 'Детское питание', items: { kasha: 1, pure: 2, pechenie: 1 } },
]

export interface Totals {
  price: number
  kg: number
  portions: number
  count: number
}

export function totals(items: Record<string, number>): Totals {
  const sum = { price: 0, kg: 0, portions: 0, count: 0 }
  for (const product of PRODUCTS) {
    const n = items[product.id] ?? 0
    sum.price += n * product.price
    sum.kg += n * product.kg
    sum.portions += n * product.portions
    sum.count += n
  }
  return sum
}

export function listText(items: Record<string, number>): string {
  const lines = PRODUCTS.filter((p) => items[p.id]).map((p) => `— ${p.name}, ${p.pack}${items[p.id] > 1 ? ` × ${items[p.id]}` : ''}`)
  return ['Купить для «Корзины доброты»:', ...lines, 'Отдать волонтёрам у выхода из магазина.'].join('\n')
}

/** В октябре 2026 года акция собрала почти 120 тонн в 1 723 магазинах — около 70 кг на магазин (отчёт фонда за октябрь). */
export const AVERAGE_KG_PER_STORE = 70
