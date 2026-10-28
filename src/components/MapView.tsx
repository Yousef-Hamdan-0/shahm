import { useEffect, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { AMMAN_CENTER } from '../lib/rules'
import { cn } from '../lib/cn'

export type MarkerKind = 'available' | 'busy' | 'offline' | 'stale' | 'merchant' | 'pickup' | 'dropoff' | 'me'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  kind: MarkerKind
  label?: string
  popup?: ReactNode
}

const COLORS: Record<MarkerKind, string> = {
  available: '#10B981',
  busy: '#F59E0B',
  offline: '#94A3B8',
  stale: '#E11D48',
  merchant: '#101F35',
  pickup: '#2563EB',
  dropoff: '#E11D48',
  me: '#10B981',
}

function iconFor(kind: MarkerKind, label?: string) {
  const c = COLORS[kind]
  let html: string
  if (kind === 'merchant') {
    html = `<div style="width:26px;height:26px;border-radius:8px;background:${c};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/></svg></div>`
  } else if (kind === 'pickup' || kind === 'dropoff') {
    html = `<div style="position:relative;width:28px;height:36px"><svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" fill="${c}"/><circle cx="14" cy="13.5" r="5.5" fill="#fff"/></svg><span style="position:absolute;top:6px;left:0;right:0;text-align:center;font:700 9px sans-serif;color:${c}">${kind === 'pickup' ? 'A' : 'B'}</span></div>`
  } else {
    const ring = kind === 'me' ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${c};opacity:.25"></span>` : ''
    const dashed = kind === 'stale' || kind === 'offline' ? 'border-style:dashed;' : ''
    html = `<div style="position:relative;width:30px;height:30px">${ring}<div style="position:relative;width:30px;height:30px;border-radius:9999px;background:${c};border:3px solid #fff;${dashed}box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px sans-serif">${label ?? ''}</div></div>`
  }
  const size: [number, number] = kind === 'pickup' || kind === 'dropoff' ? [28, 36] : kind === 'merchant' ? [26, 26] : [30, 30]
  const anchor: [number, number] = kind === 'pickup' || kind === 'dropoff' ? [14, 36] : [size[0] / 2, size[1] / 2]
  return L.divIcon({ html, className: 'shahm-marker', iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]] })
}

const iconCache = new Map<string, L.DivIcon>()
function getIcon(m: MapMarker) {
  const k = `${m.kind}:${m.label ?? ''}`
  if (!iconCache.has(k)) iconCache.set(k, iconFor(m.kind, m.label))
  return iconCache.get(k)!
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.8 })
  }, [target, map])
  return null
}

/** Fits once per distinct set of marker ids, so live movement does not keep re-zooming. */
function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
    else if (points.length === 1) map.setView(points[0], 14)
  }, [fitKey, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export function MapView({
  markers,
  routes = [],
  className,
  zoom = 12,
  center = AMMAN_CENTER,
  focus = null,
  fit,
  onPick,
}: {
  markers: MapMarker[]
  routes?: { points: [number, number][]; color?: string; dashed?: boolean }[]
  className?: string
  zoom?: number
  center?: [number, number]
  focus?: [number, number] | null
  fit?: boolean
  onPick?: (lat: number, lng: number) => void
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200', className)}>
      <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routes.map((r, i) => (
          <Polyline key={i} positions={r.points} pathOptions={{ color: r.color ?? '#101F35', weight: 4, opacity: 0.7, dashArray: r.dashed ? '6 8' : undefined }} />
        ))}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={getIcon(m)}>
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
        <FlyTo target={focus} />
        {fit && <FitBounds points={markers.map((m) => [m.lat, m.lng])} fitKey={markers.map((m) => m.id).join('|')} />}
        {onPick && <ClickPicker onPick={onPick} />}
      </MapContainer>
    </div>
  )
}

export function MapLegend({ items }: { items: { kind: MarkerKind; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.kind} className="flex items-center gap-1.5">
          <span
            className={cn('inline-block size-3', i.kind === 'merchant' ? 'rounded' : 'rounded-full', (i.kind === 'offline' || i.kind === 'stale') && 'border border-dashed border-white ring-1 ring-slate-300')}
            style={{ background: COLORS[i.kind] }}
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
