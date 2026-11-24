/**
 * Короткий устойчивый номер магазина: не меняется, пока не меняется адрес в таблице.
 * По нему же сайт понимает, какие адреса новой таблицы уже есть на карте.
 * @param {string} text адрес из таблицы
 * @returns {string}
 */
export function hashId(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
