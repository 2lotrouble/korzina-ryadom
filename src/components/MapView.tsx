import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { CHAIN_NAME, type ChainCode, type LatLon, type Store } from '../lib/data'
import type { StatusKind } from '../lib/time'

export interface MapFocus {
  /** меняется — карта переезжает */
  key: string
  points: LatLon[]
  maxZoom?: number
  /** не отдалять сильнее: выбранный город должен показывать магазины, а не кружок с числом */
  minZoom?: number
}

export interface CityBubble extends LatLon {
  index: number
  name: string
  n: number
}

interface Props {
  stores: (Store & LatLon)[]
  /** города с числом магазинов: на мелком масштабе показываем их вместо отдельных точек */
  cities: CityBubble[]
  statusOf: (store: Store) => StatusKind
  selectedId: string | null
  onSelect: (id: string) => void
  onCity: (index: number) => void
  user: LatLon | null
  focus: MapFocus | null
}

export const CHAIN_COLOR: Record<ChainCode, string> = { p: '#e4572e', x: '#1f8a4c' }
/** с этого масштаба видны отдельные магазины */
export const STORE_ZOOM = 9
const RUSSIA: L.LatLngBoundsExpression = [
  [43, 28],
  [62, 105],
]

function markerStyle(store: Store, kind: StatusKind, selected: boolean): L.CircleMarkerOptions {
  const approximate = store.pr === 'c'
  return {
    radius: selected ? 11 : kind === 'now' ? 8 : 7,
    color: selected ? '#1f2a24' : '#ffffff',
    weight: selected ? 3 : 1.5,
    fillColor: CHAIN_COLOR[store.ch],
    fillOpacity: kind === 'done' ? 0.55 : approximate ? 0.45 : 0.95,
    dashArray: approximate && !selected ? '3 3' : undefined,
  }
}

function bubbleIcon(n: number): L.DivIcon {
  const size = Math.round(Math.min(58, 26 + Math.sqrt(n) * 5))
  return L.divIcon({ className: '', html: `<span class="bubble" style="--size:${size}px">${n}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

export function MapView({ stores, cities, statusOf, selectedId, onSelect, onCity, user, focus }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const userLayer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, { marker: L.CircleMarker; store: Store }>())
  const mode = useRef<'cities' | 'stores'>('cities')
  const latest = useRef({ stores, cities, statusOf, selectedId, onSelect, onCity })
  latest.current = { stores, cities, statusOf, selectedId, onSelect, onCity }

  function draw() {
    const group = layer.current
    if (!group) return
    const { stores, cities, statusOf, selectedId } = latest.current
    group.clearLayers()
    markers.current.clear()

    if (mode.current === 'cities') {
      for (const city of cities) {
        if (!city.n) continue
        L.marker([city.lat, city.lon], { icon: bubbleIcon(city.n), title: `${city.name}: ${city.n}`, keyboard: false })
          .on('click', () => latest.current.onCity(city.index))
          .addTo(group)
      }
      return
    }

    for (const store of stores) {
      const marker = L.circleMarker([store.lat, store.lon], markerStyle(store, statusOf(store), store.id === selectedId))
      marker.bindTooltip(`${CHAIN_NAME[store.ch]} · ${store.a}`, { direction: 'top', offset: [0, -6] })
      marker.on('click', () => latest.current.onSelect(store.id))
      marker.addTo(group)
      markers.current.set(store.id, { marker, store })
    }
    if (selectedId) markers.current.get(selectedId)?.marker.bringToFront()
  }

  useEffect(() => {
    if (!element.current || map.current) return
    // колесо мыши не трогает карту, пока по ней не кликнули: иначе страница «застревает» на карте при прокрутке
    const m = L.map(element.current, { preferCanvas: true, worldCopyJump: true, scrollWheelZoom: false })
    m.on('click', () => m.scrollWheelZoom.enable())
    m.on('mouseout', () => m.scrollWheelZoom.disable())
    m.fitBounds(RUSSIA)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">участники OpenStreetMap</a>',
    }).addTo(m)
    m.attributionControl.setPrefix(false)
    layer.current = L.layerGroup().addTo(m)
    userLayer.current = L.layerGroup().addTo(m)
    m.on('zoomend', () => {
      const next = m.getZoom() >= STORE_ZOOM ? 'stores' : 'cities'
      if (next !== mode.current) {
        mode.current = next
        draw()
      }
    })
    map.current = m
    draw()
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [stores, cities])

  const previous = useRef<string | null>(null)
  useEffect(() => {
    const restyle = (id: string | null, selected: boolean) => {
      const entry = id ? markers.current.get(id) : undefined
      if (!entry) return
      entry.marker.setStyle(markerStyle(entry.store, latest.current.statusOf(entry.store), selected))
      if (selected) entry.marker.bringToFront()
    }
    restyle(previous.current, false)
    previous.current = selectedId
    restyle(selectedId, true)
  }, [selectedId])

  useEffect(() => {
    const group = userLayer.current
    if (!group) return
    group.clearLayers()
    if (!user) return
    L.circleMarker([user.lat, user.lon], { radius: 14, color: '#2f6fed', weight: 0, fillColor: '#2f6fed', fillOpacity: 0.2, interactive: false }).addTo(group)
    L.circleMarker([user.lat, user.lon], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#2f6fed', fillOpacity: 1 })
      .bindTooltip('Вы здесь', { direction: 'top', offset: [0, -6] })
      .addTo(group)
  }, [user])

  useEffect(() => {
    const m = map.current
    if (!m || !focus || !focus.points.length) return
    m.invalidateSize()
    const bounds = L.latLngBounds(focus.points.map((p) => [p.lat, p.lon] as [number, number]))
    const fit = Math.min(m.getBoundsZoom(bounds, false, L.point(96, 96)), focus.maxZoom ?? 15)
    m.flyTo(bounds.getCenter(), Math.max(fit, focus.minZoom ?? 0), { duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key])

  return <div ref={element} className="map" role="application" aria-label="Карта магазинов акции" />
}
