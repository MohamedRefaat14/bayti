import type { RoomType, RoomView } from '../apartment'
import type { BudgetId, StyleId } from './options'
import type { Suit, Swatch } from './catalog'

export type CeilingType = 'flat' | 'cove' | 'stepped' | 'coffered' | 'floating' | 'slats'
export type CeilingMaterial = 'gypsum' | 'moisture' | 'pvc' | 'concrete' | 'wood'
export type LedTone = 'off' | 'warm' | 'neutral' | 'cool'
export type SpotMode = 'none' | 'grid' | 'perimeter'
export type Cornice = 'none' | 'simple' | 'classic'

export interface CeilingConfig {
  type: CeilingType
  material: CeilingMaterial
  color: string
  led: LedTone
  spots: SpotMode
  chandelier: boolean
  cornice: Cornice
}

export const CEILING_TYPES: { id: CeilingType; name: string; desc: string; price: [number, number, number] }[] = [
  { id: 'flat', name: 'مسطح', desc: 'سقف مستوي بسيط وعملي', price: [180, 260, 380] },
  { id: 'cove', name: 'بيت نور', desc: 'إطار منخفض وإضاءة مخفية', price: [320, 450, 650] },
  { id: 'stepped', name: 'متدرج', desc: 'درجتين حوالين المركز', price: [380, 520, 760] },
  { id: 'coffered', name: 'كوفرد', desc: 'مربعات غائرة بعوارض', price: [450, 650, 950] },
  { id: 'floating', name: 'عايم', desc: 'لوح معلق وإضاءة حواليه', price: [420, 600, 880] },
  { id: 'slats', name: 'شرائح خشب', desc: 'تكسية خشب مفتوحة', price: [600, 950, 1500] },
]

export const MATERIALS: Record<CeilingMaterial, { name: string; factor: number }> = {
  gypsum: { name: 'جبسوم عادي', factor: 1 },
  moisture: { name: 'جبسوم مقاوم للرطوبة', factor: 1.15 },
  pvc: { name: 'PVC', factor: 0.7 },
  concrete: { name: 'دهان على الخرسانة', factor: 0.35 },
  wood: { name: 'خشب', factor: 1 },
}

export const WOOD_SW: Swatch[] = [
  { name: 'زان', hex: '#D9B98A' }, { name: 'بلوط', hex: '#A9784F' }, { name: 'جوز', hex: '#6B4A33' },
  { name: 'ونجيه', hex: '#3E2C22' }, { name: 'رمادي', hex: '#8E8B87' }, { name: 'أبيض مبيّض', hex: '#E7E1D6' },
]

export const LED_COLORS: Record<LedTone, number> = { off: 0, warm: 0xffd9a0, neutral: 0xfff3e0, cool: 0xddebff }

export const allowedMaterials = (t: CeilingType): CeilingMaterial[] =>
  t === 'flat' ? ['gypsum', 'moisture', 'pvc', 'concrete'] : t === 'slats' ? ['wood'] : ['gypsum', 'moisture']
export const supportsLed = (t: CeilingType) => t === 'cove' || t === 'stepped' || t === 'floating'
export const supportsCornice = (t: CeilingType) => t === 'flat' || t === 'coffered'

const BIDX: Record<BudgetId, number> = { economy: 0, mid: 1, luxury: 2 }
export const typePrice = (t: CeilingType, b: BudgetId) => CEILING_TYPES.find((x) => x.id === t)!.price[BIDX[b]]

// تغيير نوع السقف مع الحفاظ على باقي الاختيارات المناسبة
export function withType(c: CeilingConfig, type: CeilingType): CeilingConfig {
  const allowed = allowedMaterials(type)
  const material = allowed.includes(c.material) ? c.material : allowed[0]
  const color = material === 'wood' ? (c.material === 'wood' ? c.color : '#A9784F') : c.material === 'wood' ? '#F6F4EF' : c.color
  return {
    ...c, type, material, color,
    led: supportsLed(type) && c.led === 'off' ? 'warm' : c.led,
    cornice: supportsCornice(type) ? c.cornice : 'none',
  }
}

// مواضع السبوت لايت بالنسبة لمركز الغرفة (W, L = الأبعاد الداخلية بالمتر)
export function spotPositions(W: number, L: number, mode: SpotMode, type: CeilingType): [number, number][] {
  if (mode === 'none') return []
  const out: [number, number][] = []
  if (mode === 'grid') {
    const step = type === 'coffered' ? 1.2 : 1.6
    const nx = Math.max(1, Math.round(W / step)), nz = Math.max(1, Math.round(L / step))
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (type === 'coffered' && (i + j) % 2) continue
        out.push([((i + 0.5) / nx - 0.5) * W, ((j + 0.5) / nz - 0.5) * L])
      }
    }
    return out
  }
  const m = type === 'cove' || type === 'stepped' ? 0.9 : type === 'floating' ? 0.6 : 0.5
  const w = Math.max(0.2, W - 2 * m), l = Math.max(0.2, L - 2 * m)
  const nx = Math.max(2, Math.round(w / 1.1)), nz = Math.max(1, Math.round(l / 1.1))
  for (let i = 0; i < nx; i++) { const x = ((i + 0.5) / nx - 0.5) * w; out.push([x, -l / 2], [x, l / 2]) }
  for (let j = 0; j < nz; j++) { const z = ((j + 0.5) / nz - 0.5) * l; out.push([-w / 2, z], [w / 2, z]) }
  return out
}

export const ledLength = (w: number, d: number, t: CeilingType) =>
  t === 'cove' || t === 'stepped' ? 2 * (w - 0.9 + d - 0.9) : t === 'floating' ? 2 * (w - 0.6 + d - 0.6) : 0

// ===== التكلفة (أسعار استرشادية) =====
export const SPOT = [150, 250, 450]
export const LED = [60, 100, 180]
export const CHAND = [1500, 4000, 9000]
export const CORN = { simple: [40, 70, 120], classic: [90, 160, 300] }

export function ceilingCost(R: RoomView, b: BudgetId) {
  const c = R.ceiling, i = BIDX[b]
  let t = R.w * R.d * typePrice(c.type, b) * MATERIALS[c.material].factor
  t += spotPositions(R.w - 0.24, R.d - 0.24, c.spots, c.type).length * SPOT[i]
  if (supportsLed(c.type) && c.led !== 'off') t += ledLength(R.w, R.d, c.type) * LED[i]
  if (c.chandelier) t += CHAND[i]
  if (supportsCornice(c.type) && c.cornice !== 'none') t += 2 * (R.w + R.d) * CORN[c.cornice][i]
  return t
}

// ===== قواعد مناسبة السقف للغرفة =====
const WET: RoomType[] = ['bath', 'kitchen']

export function suitCeiling(c: CeilingConfig, room: RoomType, area: number, h: number): Suit {
  const wet = WET.includes(room)
  const where = room === 'bath' ? 'الحمام' : 'المطبخ'
  if (wet && c.material === 'gypsum') {
    return room === 'bath'
      ? { level: 'bad', msg: 'الجبسوم العادي في الحمام بيتنفخ ويتشقق مع البخار. استخدم جبسوم مقاوم للرطوبة أو PVC.' }
      : { level: 'warn', msg: 'الجبسوم العادي في المطبخ بيتأثر بالبخار والدهون. الأفضل جبسوم مقاوم للرطوبة.' }
  }
  if (wet && c.material === 'wood') {
    return room === 'bath'
      ? { level: 'bad', msg: 'الخشب في الحمام بيتلف مع الرطوبة والبخار.' }
      : { level: 'warn', msg: 'الخشب في المطبخ بيتأثر بالبخار والدهون والتنظيف المتكرر.' }
  }
  if (wet && c.material === 'concrete') return { level: 'warn', msg: `الخرسانة المدهونة في ${where} محتاجة دهان مقاوم للرطوبة والعفن.` }
  if (wet && c.type === 'coffered') return { level: 'warn', msg: `الكوفرد بيجمّع الرطوبة والبخار في ${where}. الأفضل سقف مسطح.` }
  if (h < 2.7 && (c.type === 'stepped' || c.type === 'coffered' || c.type === 'floating' || c.type === 'cove')) {
    return { level: 'warn', msg: `ارتفاع السقف ${h.toFixed(2)} م، والتدرجات هتنزّله أكتر. الأفضل سقف مسطح.` }
  }
  if (area < 8 && c.type === 'coffered') return { level: 'warn', msg: 'الكوفرد بيصغّر الغرفة الصغيرة. جرّب بيت نور أو سقف مسطح.' }
  if (area < 6 && c.chandelier) return { level: 'warn', msg: 'النجفة كبيرة على الغرفة الصغيرة. الأفضل سبوت لايت.' }
  return { level: 'good', msg: wet ? 'مناسب للأماكن الرطبة.' : 'مناسب للغرفة دي.' }
}

// أقرب بديل مناسب: للغرف الرطبة جبسوم مقاوم للرطوبة، وللباقي سقف مسطح
export function safeFor(c: CeilingConfig, room: RoomType): CeilingConfig {
  if (WET.includes(room)) {
    const t: CeilingType = c.type === 'slats' || c.type === 'coffered' ? 'flat' : c.type
    return { ...withType(c, t), material: 'moisture' }
  }
  return withType(c, 'flat')
}

// ===== السقف المبدئي حسب الستايل ونوع الغرفة =====
export function defaultCeiling(style: StyleId, room: RoomType): CeilingConfig {
  const base: CeilingConfig = { type: 'flat', material: 'gypsum', color: '#F6F4EF', led: 'off', spots: 'grid', chandelier: false, cornice: 'none' }
  if (room === 'bath' || room === 'kitchen') return { ...base, material: 'moisture' }
  if (room === 'living') {
    if (style === 'modern') return { ...base, type: 'cove', led: 'warm', spots: 'perimeter' }
    if (style === 'warm') return { ...base, type: 'stepped', led: 'warm', spots: 'perimeter' }
    return { ...base, type: 'coffered', spots: 'none', chandelier: true, cornice: 'classic' }
  }
  if (room === 'bed') {
    if (style === 'modern') return { ...base, type: 'floating', led: 'warm', spots: 'none' }
    if (style === 'warm') return { ...base, type: 'cove', led: 'warm', spots: 'none' }
    return { ...base, spots: 'none', cornice: 'classic' }
  }
  return base
}