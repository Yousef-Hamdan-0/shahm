import type { Fils, OrderStatus, VehicleType } from './types'

// Arabic text with Latin digits keeps phone numbers, refs and amounts easy to scan.
const LOCALE = 'ar-JO-u-nu-latn'

export const jodToFils = (jod: number): Fils => Math.round(jod * 1000)

export const filsToJod = (fils: Fils): number => fils / 1000

export function money(fils: Fils): string {
  const jod = filsToJod(fils)
  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: jod % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 3,
  }).format(jod)
  return `${formatted} د.أ`
}

export function num(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n)
}

export function dateTime(ts: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function dateOnly(ts: number): string {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(ts)
}

export function timeOnly(ts: number): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(ts)
}

export function weekday(ts: number): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(ts)
}

export function relative(ts: number, now = Date.now()): string {
  const diff = Math.round((now - ts) / 1000)
  if (diff < 0) {
    const ahead = -diff
    if (ahead < 60) return `خلال ${ahead} ث`
    return `خلال ${Math.ceil(ahead / 60)} د`
  }
  if (diff < 45) return 'الآن'
  if (diff < 3600) return `منذ ${Math.round(diff / 60)} د`
  if (diff < 86400) return `منذ ${Math.round(diff / 3600)} س`
  return `منذ ${Math.round(diff / 86400)} يوم`
}

export const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString()

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_dispatch: 'بانتظار توجيه الإدارة',
  awaiting_captain: 'بانتظار كابتن',
  offered_privately: 'عرض خاص لكابتن',
  accepted: 'تم تعيين كابتن',
  heading_to_pickup: 'في الطريق للاستلام',
  picked_up: 'تم الاستلام',
  on_the_way: 'في الطريق للعميل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  dispatch_expired: 'انتهت مهلة العرض',
}

/** Simpler wording shown to merchants */
export const MERCHANT_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_dispatch: 'قيد المعالجة',
  awaiting_captain: 'بانتظار كابتن',
  offered_privately: 'قيد المعالجة',
  accepted: 'تم تعيين كابتن',
  heading_to_pickup: 'الكابتن في الطريق إليك',
  picked_up: 'تم الاستلام',
  on_the_way: 'في الطريق للعميل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  dispatch_expired: 'قيد المعالجة',
}

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  motorcycle: 'دراجة نارية',
  car: 'سيارة',
  bicycle: 'دراجة هوائية',
  van: 'فان',
}

export const CATEGORIES = ['مطعم', 'مقهى', 'متجر تجزئة', 'صيدلية', 'مخبز', 'حلويات', 'بقالة', 'أخرى']

export const AMMAN_AREAS = [
  'عبدون',
  'الصويفية',
  'جبل عمّان',
  'الشميساني',
  'خلدا',
  'دابوق',
  'تلاع العلي',
  'الجبيهة',
  'مرج الحمام',
  'الرابية',
  'أم أذينة',
  'اللويبدة',
  'وسط البلد',
  'طبربور',
]
