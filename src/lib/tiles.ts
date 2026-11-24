import L from 'leaflet'

/** Подложка OpenStreetMap с подписью об авторах — одна на все карты сайта. */
export function addBaseLayer(map: L.Map): void {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">участники OpenStreetMap</a>',
  }).addTo(map)
  map.attributionControl.setPrefix(false)
}
