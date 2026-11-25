import type { RoomType } from '../apartment'
import type { BudgetId, StyleId } from './options'
import { RULES } from './rules'

export type Pattern = 'tile' | 'plank' | 'stone' | 'plain' | 'carpet'
export type Tint = 'free' | 'wood' | 'fixed' // free = أي لون | wood = درجات الخشب | fixed = أنواع طبيعية
export type Layout = 'straight' | 'brick' | 'diagonal' | 'herringbone'
export type Wet = 'ok' | 'avoid' | 'no' // مدى تحمل المياه

export interface Swatch { name: string; hex: string }
// خامة مضافة من لوحة الإدارة: صورة بلاطة واحدة (tile) أو صورة متصلة بتتكرر (seamless)
export interface PhotoSpec { id: string; mode: 'tile' | 'seamless'; rotate: boolean; colorable: boolean }
export interface FloorMaterial {
  id: string; name: string; group: string
  pattern: Pattern; look?: 'marble' | 'granite' | 'cement'
  tint: Tint
  base: string                     // اللون الافتراضي
  swatches?: Swatch[]              // درجات الخشب أو أنواع الحجر
  rough: number                    // 0 لامع جداً ... 1 مطفي
  size: [number, number]           // [العرض, الطول] بالمتر للبلاطة أو اللوح
  price: [number, number, number]  // جنيه للمتر: اقتصادي، متوسط، فاخر
  wet: Wet
  antiSlip?: boolean
  grout?: boolean                  // فيها فوغة
  groutMm?: number                 // سمك الفاصل المبدئي بالمم
  groutColor?: string              // لون الفاصل المبدئي
  photo?: PhotoSpec                // لو الخامة من صورة مرفوعة
  v?: number                       // رقم نسخة الخامة (بيزيد مع كل تعديل)
  custom?: boolean                 // مضافة من لوحة الإدارة
}

// اختيار المستخدم لأرضية غرفة
export interface FloorConfig { material: string; color: string; layout: Layout; groutColor: string; groutMm: number }

const WOODS: Swatch[] = [
  { name: 'زان', hex: '#D9B98A' }, { name: 'بلوط فاتح', hex: '#C69C6D' }, { name: 'بلوط', hex: '#A9784F' },
  { name: 'جوز', hex: '#6B4A33' }, { name: 'ونجيه', hex: '#3E2C22' }, { name: 'رمادي', hex: '#8E8B87' },
  { name: 'أسود', hex: '#2B2A2A' }, { name: 'أبيض مبيّض', hex: '#E7E1D6' },
]

export const BUILTIN_FLOORS: FloorMaterial[] = [
  { id: 'por-plain', name: 'بورسلين سادة 60×60', group: 'بورسلين', pattern: 'tile', tint: 'free', base: '#D8D3CA', rough: 0.55, size: [0.6, 0.6], price: [300, 520, 900], wet: 'ok', grout: true },
  { id: 'por-marble', name: 'بورسلين شكل رخام 60×120', group: 'بورسلين', pattern: 'stone', look: 'marble', tint: 'free', base: '#E6E7EA', rough: 0.15, size: [0.6, 1.2], price: [450, 800, 1400], wet: 'ok', grout: true },
  { id: 'por-wood', name: 'بورسلين شكل خشب 20×120', group: 'بورسلين', pattern: 'plank', tint: 'wood', base: '#C69C6D', swatches: WOODS, rough: 0.5, size: [0.2, 1.2], price: [400, 700, 1100], wet: 'ok' },
  { id: 'por-anti', name: 'بورسلين ضد الانزلاق 30×30', group: 'بورسلين', pattern: 'tile', tint: 'free', base: '#B9B4AA', rough: 0.85, size: [0.3, 0.3], price: [320, 560, 950], wet: 'ok', antiSlip: true, grout: true },
  { id: 'por-cement', name: 'بورسلين أسمنتي 60×60', group: 'بورسلين', pattern: 'stone', look: 'cement', tint: 'free', base: '#9A9A98', rough: 0.7, size: [0.6, 0.6], price: [380, 650, 1050], wet: 'ok', grout: true },
  { id: 'cer-plain', name: 'سيراميك 40×40', group: 'سيراميك', pattern: 'tile', tint: 'free', base: '#CFC9BE', rough: 0.6, size: [0.4, 0.4], price: [220, 380, 650], wet: 'ok', grout: true },
  {
    id: 'mar-natural', name: 'رخام طبيعي 60×60', group: 'رخام وجرانيت', pattern: 'stone', look: 'marble', tint: 'fixed', base: '#EDEDEE',
    swatches: [{ name: 'كرارا أبيض', hex: '#EDEDEE' }, { name: 'رمادي', hex: '#9A9DA3' }, { name: 'أسود ذهبي', hex: '#1E1E20' }, { name: 'بيج كريمي', hex: '#D9CBB0' }, { name: 'أخضر', hex: '#4E6B58' }],
    rough: 0.12, size: [0.6, 0.6], price: [700, 1200, 2200], wet: 'avoid', grout: true,
  },
  {
    id: 'gra-natural', name: 'جرانيت طبيعي 60×60', group: 'رخام وجرانيت', pattern: 'stone', look: 'granite', tint: 'fixed', base: '#7B7E83',
    swatches: [{ name: 'رمادي', hex: '#7B7E83' }, { name: 'أسود', hex: '#25262A' }, { name: 'أحمر', hex: '#8A4B44' }, { name: 'بيج', hex: '#B9A58A' }],
    rough: 0.2, size: [0.6, 0.6], price: [600, 1000, 1800], wet: 'ok', grout: true,
  },
  { id: 'hdf', name: 'باركيه HDF', group: 'باركيه وخشب', pattern: 'plank', tint: 'wood', base: '#A9784F', swatches: WOODS, rough: 0.55, size: [0.19, 1.2], price: [350, 600, 950], wet: 'no' },
  { id: 'lam', name: 'لامينيت', group: 'باركيه وخشب', pattern: 'plank', tint: 'wood', base: '#C69C6D', swatches: WOODS, rough: 0.5, size: [0.19, 1.2], price: [250, 400, 650], wet: 'no' },
  { id: 'wood', name: 'باركيه خشب طبيعي', group: 'باركيه وخشب', pattern: 'plank', tint: 'wood', base: '#A9784F', swatches: WOODS, rough: 0.45, size: [0.12, 0.9], price: [1100, 1700, 2800], wet: 'avoid' },
  { id: 'spc', name: 'أرضية SPC (ضد المياه)', group: 'باركيه وخشب', pattern: 'plank', tint: 'wood', base: '#C69C6D', swatches: WOODS, rough: 0.5, size: [0.18, 1.2], price: [450, 750, 1200], wet: 'ok' },
  { id: 'epoxy', name: 'إيبوكسي', group: 'أرضيات أخرى', pattern: 'plain', tint: 'free', base: '#C9CCD0', rough: 0.1, size: [2, 2], price: [500, 900, 1500], wet: 'ok' },
  { id: 'carpet', name: 'موكيت', group: 'أرضيات أخرى', pattern: 'carpet', tint: 'free', base: '#8A8F98', rough: 1, size: [2, 2], price: [150, 300, 600], wet: 'no' },
]

// ALL_FLOORS = كل الخامات (حتى المخفية) | FLOOR_MATERIALS = اللي بيشوفها العميل. الاتنين بيتحدثوا من matStore
export const ALL_FLOORS: FloorMaterial[] = [...BUILTIN_FLOORS]
export const FLOOR_MATERIALS: FloorMaterial[] = [...BUILTIN_FLOORS]
export const byId = (id: string) => ALL_FLOORS.find((m) => m.id === id) ?? FLOOR_MATERIALS[0] ?? BUILTIN_FLOORS[0]
export const floorGroups = () => Array.from(new Set(FLOOR_MATERIALS.map((m) => m.group)))

export const PALETTE = [
  '#F5F3EE', '#E8E4DA', '#D8D3CA', '#C9C2B5', '#B8B0A0', '#A39A8A', '#8E8B87', '#6F7378',
  '#4B4E54', '#2B2B2E', '#E9D9C0', '#D9BE96', '#C79A6A', '#A9784F', '#7A5A3E', '#4A3728',
  '#C9D3C3', '#9DB09B', '#6E8B74', '#A9C4D6', '#6F94B2', '#3F5F82', '#D9B3AC', '#B76E68',
]

export const LAYOUTS: Record<Layout, { name: string; waste: number }> = {
  straight: { name: 'صف عادي', waste: RULES.waste.straight },
  brick: { name: 'متداخل', waste: RULES.waste.brick },
  diagonal: { name: 'مائل 45°', waste: RULES.waste.diagonal },
  herringbone: { name: 'سمكة', waste: RULES.waste.herringbone },
}
export function allowedLayouts(m: FloorMaterial): Layout[] {
  if (m.pattern === 'plank') return ['straight', 'brick', 'herringbone', 'diagonal']
  if (m.pattern === 'tile' || m.pattern === 'stone') return ['straight', 'brick', 'diagonal']
  return ['straight']
}
export const defaultLayout = (m: FloorMaterial): Layout => (m.pattern === 'plank' ? 'brick' : 'straight')
export const wasteOf = (m: FloorMaterial, l: Layout) => (m.pattern === 'plain' || m.pattern === 'carpet' ? RULES.waste.seamless : LAYOUTS[l].waste)

const BIDX: Record<BudgetId, number> = { economy: 0, mid: 1, luxury: 2 }
export const priceOf = (m: FloorMaterial, b: BudgetId) => m.price[BIDX[b]]

// ===== قواعد مناسبة الخامة للغرفة =====
export interface Suit { level: 'good' | 'warn' | 'bad'; msg: string }
const WET_ROOMS: RoomType[] = ['bath', 'kitchen']

export function suit(m: FloorMaterial, type: RoomType): Suit {
  const wet = WET_ROOMS.includes(type)
  const where = type === 'bath' ? 'الحمام' : 'المطبخ'
  if (wet && m.wet === 'no') return { level: 'bad', msg: `${m.name} مش مناسبة لـ${where}: بتتلف وتنتفخ مع المياه والرطوبة.` }
  if (wet && m.wet === 'avoid') return { level: 'warn', msg: `${m.name} بتتأثر بالمياه والبقع في ${where}. الأفضل بدائل مقاومة للمياه.` }
  if (type === 'bath' && !m.antiSlip && (m.pattern === 'stone' || m.pattern === 'tile' || m.pattern === 'plain') && m.rough < 0.5) {
    return { level: 'warn', msg: 'الأرضية اللامعة بتزحلق لما تتبل. للحمام الأفضل بورسلين ضد الانزلاق.' }
  }
  return { level: 'good', msg: wet ? 'مناسبة للأماكن الرطبة.' : 'مناسبة للغرفة دي.' }
}
export const suggest = (type: RoomType) => FLOOR_MATERIALS.filter((m) => suit(m, type).level === 'good')

// ===== الأرضية المبدئية حسب الستايل ونوع الغرفة =====
export function defaultFloor(style: StyleId, type: RoomType): FloorConfig {
  const mk = (id: string, color?: string, layout?: Layout): FloorConfig => {
    const m = byId(id)
    return { material: id, color: color ?? m.base, layout: layout ?? defaultLayout(m), groutColor: '#C9C5BC', groutMm: 3 }
  }
  if (type === 'bath') return mk('por-anti', style === 'warm' ? '#C9BBA5' : style === 'classic' ? '#BFB8AC' : '#A9AEB3')
  if (type === 'kitchen') return mk('por-plain', style === 'warm' ? '#D9CDB8' : '#D8D3CA')
  if (style === 'modern') return type === 'bed' ? mk('lam', '#8E8B87') : mk('por-marble', '#E6E7EA')
  if (style === 'warm') return mk('hdf', '#C69C6D')
  if (type === 'living') return mk('wood', '#A9784F', 'herringbone')
  if (type === 'bed') return mk('hdf', '#A9784F')
  return mk('por-plain', '#D8D3CA')
}