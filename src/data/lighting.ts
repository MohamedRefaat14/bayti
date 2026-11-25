export type LampTone = 'warm' | 'white' | 'off'
export type TimeOfDay = 'day' | 'sunset' | 'night'

export interface Lighting { lamps: LampTone; level: number; window: 'open' | 'closed'; time: TimeOfDay }
export const DEFAULT_LIGHTING: Lighting = { lamps: 'warm', level: 1, window: 'open', time: 'day' }

export const LAMP_HEX: Record<LampTone, number> = { warm: 0xffd9a0, white: 0xf2f7ff, off: 0 }

// إضاءة اللمبات كما بتوصل للرسم: شغالة؟ ولونها وشدتها
export interface Lit { on: boolean; hex: number; level: number }

// إعدادات كل وقت: لون الشمس وشدتها وارتفاع نقطة دخولها من الشباك، وخلفية السما وإضاءة البيئة
export const SUN: Record<TimeOfDay, { color: number; intensity: number; hit: number; bg: number; outdoor: number; hemi: number; env: number }> = {
  day: { color: 0xfff2dc, intensity: 1.1, hit: 1.5, bg: 0xbfd8ee, outdoor: 0xffffff, hemi: 0.34, env: 1 },
  sunset: { color: 0xff9a52, intensity: 0.85, hit: 1.15, bg: 0xf2b98f, outdoor: 0xffc9a0, hemi: 0.22, env: 0.55 },
  night: { color: 0x7f94d6, intensity: 0.22, hit: 1.7, bg: 0x0a0f1c, outdoor: 0x2b3550, hemi: 0.08, env: 0.15 },
}
// الشباك مقفول: مفيش ضوء من برّه، بس ظلام خفيف عشان الغرفة تفضل مرئية
export const CLOSED = { hemi: 0.1, env: 0.12, bg: 0x0b0d12 }