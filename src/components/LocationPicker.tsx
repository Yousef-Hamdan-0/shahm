import { MousePointerClick } from 'lucide-react'
import { MapView, type MarkerKind } from './MapView'

export function LocationPicker({ lat, lng, onChange, kind = 'dropoff', className = 'h-56' }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void; kind?: MarkerKind; className?: string }) {
  return (
    <div className="space-y-1.5">
      <MapView className={className} zoom={14} center={[lat, lng]} focus={[lat, lng]} markers={[{ id: 'pick', lat, lng, kind }]} onPick={(a, b) => onChange(+a.toFixed(5), +b.toFixed(5))} />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MousePointerClick className="size-3.5" /> انقر على الخريطة لتحديد الموقع بدقة
        </span>
        <span dir="ltr" className="font-mono">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      </div>
    </div>
  )
}
