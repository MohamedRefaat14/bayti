import type { RoomType, Side } from '../apartment'
import type { BudgetId, StyleId } from './options'
import type { Suit, Swatch } from './catalog'

export type Finish = 'matt' | 'satin' | 'gloss'
export const FINISHES: Record<Finish, { name: string; rough: number; factor: number; note: string }> = {
  matt: { name: 'مطفي', rough: 0.95, factor: 1, note: 'بيخبّي عيوب الحيطة، بس بيتوسخ أسرع.' },
  satin: { name: 'ساتان', rough: 0.55, factor: 1.08, note: 'قابل للغسيل ومناسب للمطبخ والحمام.' },
  gloss: { name: 'لامع', rough: 0.22, factor: 1.15, note: 'بيعكس الضوء وبيبيّن عيوب الحيطة.' },
}

export type WTint = 'free' | 'fixed' // free = أي لون | fixed = درجات طبيعية
export interface WallMaterial {
  id: string; name: string; group: string
  tint: WTint; base: string; swatches?: Swatch[]
  tile: number                      // مقاس وحدة النقش المتكررة بالمتر
  rough: number
  price: [number, number, number]   // جنيه للمتر المربع: اقتصادي، متوسط، فاخر
  wet: 'ok' | 'avoid' | 'no'
  bump: number
}

const WOODS: Swatch[] = [
  { name: 'زان', hex: '#D9B98A' }, { name: 'بلوط', hex: '#A9784F' }, { name: 'جوز', hex: '#6B4A33' },
  { name: 'ونجيه', hex: '#3E2C22' }, { name: 'رمادي', hex: '#8E8B87' }, { name: 'أبيض مبيّض', hex: '#E7E1D6' },
]

export const WALL_MATERIALS: WallMaterial[] = [
  { id: 'wp-stripe', name: 'ورق حائط مخطط', group: 'ورق حائط', tint: 'free', base: '#D9CDB8', tile: 0.53, rough: 0.9, price: [120, 220, 420], wet: 'no', bump: 0.3 },
  { id: 'wp-damask', name: 'ورق حائط كلاسيك', group: 'ورق حائط', tint: 'free', base: '#CFC3A8', tile: 0.64, rough: 0.85, price: [150, 280, 520], wet: 'no', bump: 0.4 },
  { id: 'wp-dots', name: 'ورق حائط منقط', group: 'ورق حائط', tint: 'free', base: '#DCE3E8', tile: 0.5, rough: 0.9, price: [120, 220, 400], wet: 'no', bump: 0.3 },
  { id: 'wood-slats', name: 'بديل خشب (شرائح)', group: 'خشب وألواح', tint: 'fixed', base: '#A9784F', swatches: WOODS, tile: 0.5, rough: 0.55, price: [450, 800, 1300], wet: 'no', bump: 1.2 },
  { id: 'panel-3d', name: 'ألواح 3D موجات', group: 'خشب وألواح', tint: 'free', base: '#E8E4DA', tile: 0.5, rough: 0.8, price: [350, 600, 950], wet: 'no', bump: 1.5 },
  {
    id: 'marble-look', name: 'بديل رخام (بورسلين)', group: 'حجر ورخام', tint: 'fixed', base: '#EDEDEE',
    swatches: [{ name: 'كرارا أبيض', hex: '#EDEDEE' }, { name: 'رمادي', hex: '#9A9DA3' }, { name: 'أسود ذهبي', hex: '#1E1E20' }, { name: 'بيج كريمي', hex: '#D9CBB0' }],
    tile: 1.2, rough: 0.2, price: [450, 800, 1400], wet: 'ok', bump: 0.1,
  },
  {
    id: 'stone-ledger', name: 'حجر ستون وول', group: 'حجر ورخام', tint: 'fixed', base: '#9A9488',
    swatches: [{ name: 'رمادي', hex: '#9A9488' }, { name: 'بيج', hex: '#BFAE92' }, { name: 'بني', hex: '#7A6450' }, { name: 'أسود', hex: '#3E3E40' }],
    tile: 0.6, rough: 0.9, price: [500, 900, 1500], wet: 'avoid', bump: 1.6,
  },
  {
    id: 'brick', name: 'طوب ديكور', group: 'حجر ورخام', tint: 'fixed', base: '#A5533F',
    swatches: [{ name: 'أحمر', hex: '#A5533F' }, { name: 'أبيض', hex: '#E4E0D6' }, { name: 'رمادي', hex: '#8A8B8E' }, { name: 'بني غامق', hex: '#5E3B2E' }],
    tile: 0.5, rough: 0.9, price: [350, 600, 950], wet: 'avoid', bump: 1.4,
  },
  { id: 'tile-subway', name: 'سيراميك مترو', group: 'سيراميك وبلاط', tint: 'free', base: '#F2F2F0', tile: 0.6, rough: 0.2, price: [250, 420, 700], wet: 'ok', bump: 0.6 },
  { id: 'tile-square', name: 'بلاط 30×60', group: 'سيراميك وبلاط', tint: 'free', base: '#DAD6CC', tile: 0.6, rough: 0.35, price: [280, 480, 800], wet: 'ok', bump: 0.5 },
  { id: 'concrete', name: 'خرسانة مصقولة', group: 'تشطيبات حديثة', tint: 'free', base: '#9C9C9A', tile: 1.2, rough: 0.7, price: [400, 700, 1100], wet: 'avoid', bump: 0.4 },
  { id: 'plaster', name: 'جبس استكو', group: 'تشطيبات حديثة', tint: 'free', base: '#D9D2C4', tile: 1.2, rough: 0.6, price: [300, 550, 900], wet: 'avoid', bump: 0.5 },
]

export const wmById = (id: string) => WALL_MATERIALS.find((m) => m.id === id) ?? WALL_MATERIALS[0]
export const WALL_GROUPS = Array.from(new Set(WALL_MATERIALS.map((m) => m.group)))
const BIDX: Record<BudgetId, number> = { economy: 0, mid: 1, luxury: 2 }
export const wmPrice = (m: WallMaterial, b: BudgetId) => m.price[BIDX[b]]

export const PAINT_GROUPS: { name: string; colors: string[] }[] = [
  { name: 'محايد', colors: ['#FFFFFF', '#F6F4EF', '#EDEAE2', '#E2DED3', '#D4CFC2', '#C6C0B2', '#B8B8B6', '#A5A7AA', '#8D9094', '#6F7378', '#4C4F54', '#2E3034'] },
  { name: 'دافئ', colors: ['#F4E3CF', '#EFD5B5', '#E6C29A', '#DBAA7B', '#CF9264', '#C47A52', '#D9B3A3', '#CC9988', '#B97B6E', '#A25F55', '#8A4A44', '#6E3B38'] },
  { name: 'أخضر', colors: ['#E5EBDD', '#D3DECA', '#BFCDB4', '#A9BCA0', '#92A887', '#7C9473', '#68805F', '#566C4F', '#E1EDE5', '#C4DACB', '#9FC2AB', '#7AA68C'] },
  { name: 'أزرق', colors: ['#E3EDF4', '#CFE0EC', '#B8D0E2', '#9FBFD6', '#86AECB', '#6F9BBB', '#5A86A6', '#476F8C', '#DDE3F0', '#C0CBE3', '#9FB0D3', '#7C8FBE'] },
  { name: 'جريء', colors: ['#F6D7D7', '#EDB1B1', '#E08585', '#CC5A5A', '#B03B3B', '#8E2A2A', '#F5E4A8', '#EBD06F', '#D9B23A', '#7C5E8C', '#5B3F6B', '#2F5D62'] },
]

// إعدادات الحيطان لغرفة
export interface WallConfig {
  color: string; finish: Finish
  accent: { side: Side | null; material: string; color: string } // حيطة ديكور
  dado: { on: boolean; height: number; material: string; color: string } // material '' = دهان
  skirt: { height: number; color: string }
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}
const wetRoom = (t: RoomType) => t === 'bath' || t === 'kitchen'

export function suitMaterial(m: WallMaterial, type: RoomType): Suit {
  const where = type === 'bath' ? 'الحمام' : 'المطبخ'
  if (wetRoom(type) && m.wet === 'no') return { level: 'bad', msg: `${m.name} مش مناسبة لـ${where}: بتتقشر وبتتلف مع البخار والرطوبة.` }
  if (wetRoom(type) && m.wet === 'avoid') return { level: 'warn', msg: `${m.name} بتتأثر بالبقع والرطوبة في ${where}. الأفضل سيراميك أو بورسلين.` }
  return { level: 'good', msg: wetRoom(type) ? 'مناسبة للأماكن الرطبة.' : 'مناسبة للغرفة دي.' }
}
export const suggestWall = (type: RoomType) => WALL_MATERIALS.filter((m) => suitMaterial(m, type).level === 'good')

export function suitPaint(color: string, finish: Finish, type: RoomType, area: number): Suit {
  if (wetRoom(type) && finish === 'matt') return { level: 'warn', msg: 'الدهان المطفي بيتأثر بالبخار والرش. الأفضل ساتان أو دهان مقاوم للرطوبة، وبلاط على الأجزاء المعرضة للمياه.' }
  if (lum(color) < 85 && area < 10) return { level: 'warn', msg: 'اللون الغامق بيصغّر المساحة الصغيرة. جرّب لون أفتح أو خليه في حيطة واحدة.' }
  if (finish === 'gloss' && !wetRoom(type)) return { level: 'warn', msg: 'اللامع بيبيّن عيوب الحيطة. لازم معجون وتسوية كويسة.' }
  return { level: 'good', msg: wetRoom(type) ? 'مناسب للأماكن الرطبة.' : 'مناسب للغرفة دي.' }
}

// ===== الحيطان المبدئية حسب الستايل ونوع الغرفة =====
const ORDER: RoomType[] = ['bed', 'living', 'kitchen', 'bath', 'hall', 'other']
const COLORS: Record<StyleId, string[]> = {
  modern: ['#B8BCC2', '#F3F3F0', '#F3F3F0', '#A9C4D6', '#F3F3F0', '#F3F3F0'],
  warm: ['#E3BFB6', '#D9C7A8', '#D9C7A8', '#F3F3F0', '#D9C7A8', '#D9C7A8'],
  classic: ['#AEBBA3', '#D9C7A8', '#F3F3F0', '#A9C4D6', '#D9C7A8', '#D9C7A8'],
}
export function defaultWall(style: StyleId, type: RoomType): WallConfig {
  const wet = wetRoom(type)
  return {
    color: COLORS[style][ORDER.indexOf(type)],
    finish: wet ? 'satin' : 'matt',
    accent: { side: null, material: 'wood-slats', color: '#A9784F' },
    dado: { on: wet, height: type === 'bath' ? 1.2 : 1.4, material: 'tile-subway', color: '#F2F2F0' },
    skirt: { height: 0.1, color: '#F4F4F2' },
  }
}