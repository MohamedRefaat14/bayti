import type { RoomType } from './apartment'

export type DoorRole = 'entrance' | 'interior' | 'bath'
export type Metal = 'chrome' | 'gold' | 'black'
export const DOOR_DESIGNS: Record<string, string> = { flat: 'سادة', panel: 'بحشوات', glass: 'بزجاج', double: 'ضلفتين', armored: 'مصفح (باب شقة)' }
export const WIN_DESIGNS: Record<string, string> = { sliding: 'سحاب', casement: 'مفصلي (ضلفتين)', fixed: 'ثابت' }
export const ROLE_NAMES: Record<string, string> = { entrance: 'باب الشقة', interior: 'باب غرفة', bath: 'باب حمام', window: 'شباك' }
export const METAL_NAMES: Record<Metal, string> = { chrome: 'كروم', gold: 'دهبي', black: 'أسود' }

// باب: السعر للقطعة | شباك: السعر للمتر المربع
export interface FrameDef {
  id: string; kind: 'door' | 'window'; name: string; design: string
  roles?: DoorRole[]
  price: [number, number, number]
  color: string; colors: { name: string; hex: string }[]
  metal: Metal
  custom?: boolean; v?: number
  glb?: boolean; modelRot?: number; matMatch?: string; fit?: 'stretch' | 'contain'
}

export const DOOR_COLORS = [
  { name: 'زان', hex: '#C9A06B' }, { name: 'بلوط', hex: '#A9784F' }, { name: 'جوز', hex: '#6B4A33' },
  { name: 'ونجيه', hex: '#3E2C22' }, { name: 'أبيض', hex: '#EDE9E2' }, { name: 'رمادي', hex: '#8E8B87' },
]
export const WIN_COLORS = [
  { name: 'أبيض', hex: '#F2F2F0' }, { name: 'فحمي', hex: '#3A3D42' }, { name: 'بني', hex: '#5A4332' },
  { name: 'فضي', hex: '#B9BDC2' }, { name: 'خشبي', hex: '#A9784F' },
]

const mk = (id: string, kind: 'door' | 'window', name: string, design: string, price: [number, number, number], color: string, o: Partial<FrameDef> = {}): FrameDef =>
  ({ id, kind, name, design, price, color, colors: kind === 'door' ? DOOR_COLORS : WIN_COLORS, metal: 'chrome', ...o })

export const BASE: Record<string, FrameDef> = {
  'd-flat': mk('d-flat', 'door', 'باب سادة (خشب)', 'flat', [2500, 5000, 10000], '#C9A06B', { roles: ['interior', 'bath'] }),
  'd-panel': mk('d-panel', 'door', 'باب بحشوات', 'panel', [3500, 7000, 15000], '#A9784F', { roles: ['interior', 'entrance'] }),
  'd-glass': mk('d-glass', 'door', 'باب بزجاج', 'glass', [4500, 9000, 18000], '#EDE9E2', { roles: ['interior'] }),
  'd-double': mk('d-double', 'door', 'باب ضلفتين', 'double', [7000, 14000, 28000], '#A9784F', { roles: ['interior'] }),
  'd-armored': mk('d-armored', 'door', 'باب شقة مصفح', 'armored', [8000, 15000, 30000], '#6B4A33', { roles: ['entrance'], metal: 'black' }),
  'd-bath': mk('d-bath', 'door', 'باب حمام PVC', 'flat', [1500, 2800, 6000], '#EDE9E2', { roles: ['bath'] }),
  'w-slide': mk('w-slide', 'window', 'شباك سحاب ألوميتال', 'sliding', [1800, 2800, 4500], '#F2F2F0'),
  'w-case': mk('w-case', 'window', 'شباك مفصلي (ضلفتين)', 'casement', [2200, 3400, 5500], '#F2F2F0'),
  'w-fixed': mk('w-fixed', 'window', 'شباك ثابت', 'fixed', [1400, 2200, 3800], '#F2F2F0'),
  'w-pvc': mk('w-pvc', 'window', 'شباك PVC سحاب', 'sliding', [2400, 3800, 6200], '#F2F2F0', { metal: 'chrome' }),
}
// OPEN هو اللي بيتعدل بعد تطبيق التعديلات والأنواع المضافة من لوحة الإدارة
export const OPEN: Record<string, FrameDef> = { ...BASE }
export const HIDDEN = new Set<string>()
export const BASE_DEFAULTS: Record<string, string> = { entrance: 'd-armored', interior: 'd-panel', bath: 'd-bath', window: 'w-slide' }
export const DEFAULTS: Record<string, string> = { ...BASE_DEFAULTS }

export const doorRole = (roomType: RoomType, to: number | null, tt?: RoomType): DoorRole =>
  to == null ? 'entrance' : roomType === 'bath' || tt === 'bath' ? 'bath' : 'interior'
export const openRole = (roomType: RoomType, o: { kind: string; to: number | null; tt?: RoomType }): string =>
  o.kind === 'window' ? 'window' : doorRole(roomType, o.to, o.tt)

type Fin = Record<number, { style?: string; color?: string }>

// بيرجّع النوع واللون المستخدمين فعلاً لفتحة معينة
export function pickStyle(kind: 'door' | 'window', role: string, ofin: Fin, odef: Record<string, string>, id: number): { def: FrameDef; color: string } {
  const key = kind === 'window' ? 'window' : role
  const sel = ofin[id]?.style
  let def: FrameDef | undefined = sel ? OPEN[sel] : undefined
  if (!def || def.kind !== kind) def = OPEN[odef[key] ?? DEFAULTS[key]]
  if (!def || def.kind !== kind) def = OPEN[DEFAULTS[key]]
  if (!def || def.kind !== kind) def = BASE[BASE_DEFAULTS[key]]
  return { def, color: ofin[id]?.color ?? def.color }
}

// الأنواع اللي العميل يقدر يختار منها (الظاهرة بس، ومناسبة لنوع الباب)
export const styleList = (kind: 'door' | 'window', role?: string): FrameDef[] =>
  Object.values(OPEN).filter((d) => d.kind === kind && !HIDDEN.has(d.id) && (kind === 'window' || !d.roles || !role || d.roles.includes(role as DoorRole)))