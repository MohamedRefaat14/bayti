import type { Apartment, Column, RoomType, RoomView, Side } from './apartment'
import type { BudgetId } from './data/options'

export const WALL_T = 0.12 // سمك الحيطة (نفس القيمة في buildRoom)

export type FurnKind = string // رقم القطعة: أساسية (sofa...) أو مضافة من لوحة الإدارة (c...)
export type ColorRole = 'fabric' | 'wood' | 'none'

// w = العرض، d = العمق (الوش ناحية +z)، h = الارتفاع، top = أعلى نقطة (للتلفزيون والمرايا)
// wall = بيلتصق بالحيطة | rug = سجادة | acc = إكسسوار بيتحط على سطح | surf = [عرض، عمق، ارتفاع] السطح اللي بيتحط عليه
// role = القطعة الأساسية اللي القطعة دي بديلة ليها في الفرش التلقائي
export interface FurnDef {
  kind: FurnKind; name: string; w: number; d: number; h: number
  top?: number; wall?: boolean; rug?: boolean; acc?: boolean; surf?: [number, number, number]
  rooms: RoomType[]; price: [number, number, number]; glb: string
  role?: string; custom?: boolean; v?: number
  colorRole?: ColorRole; matMatch?: string; colors?: { name: string; hex: string }[]
  modelRot?: number; fit?: 'stretch' | 'contain'; mode?: 'model' | 'rug'
}
// x و z مكان القطعة بالمتر من منتصف الغرفة، y ارتفاع القاعدة، host = القطعة اللي الإكسسوار عليها، color = لون اختاره العميل
export interface FurnItem { id: number; kind: FurnKind; x: number; z: number; rot: number; y: number; host?: number; color?: string }

const f = (kind: string, name: string, w: number, d: number, h: number, rooms: RoomType[], price: [number, number, number], o: Partial<FurnDef> = {}): FurnDef =>
  ({ kind, name, w, d, h, rooms, price, glb: `models/furniture/${kind}.glb`, ...o })
const LIV: RoomType[] = ['living', 'other']

// القطع الأساسية (الأصل). FURN هو اللي بيتعدل بعد تطبيق التعديلات والقطع المضافة من لوحة الإدارة
export const BASE: Record<string, FurnDef> = {
  sofa: f('sofa', 'كنبة 3 مقاعد', 2.2, 0.9, 0.85, LIV, [9000, 18000, 40000], { wall: true, colorRole: 'fabric' }),
  armchair: f('armchair', 'فوتيه', 0.85, 0.85, 0.8, LIV, [3000, 6000, 14000], { colorRole: 'fabric' }),
  coffee: f('coffee', 'ترابيزة قهوة', 1.1, 0.6, 0.45, LIV, [1500, 3500, 9000], { surf: [1.1, 0.6, 0.45] }),
  tvunit: f('tvunit', 'وحدة تلفزيون', 1.8, 0.4, 0.5, LIV, [3000, 7000, 16000], { wall: true, top: 1.6, colorRole: 'wood' }),
  rug: f('rug', 'سجادة', 2.4, 1.7, 0.02, ['living', 'bed', 'other'], [1500, 4000, 12000], { rug: true }),
  dining: f('dining', 'سفرة بـ6 كراسي', 2.5, 1.8, 0.75, LIV, [8000, 18000, 45000], { surf: [1.6, 0.9, 0.75], colorRole: 'wood' }),
  console: f('console', 'كونسول', 1.2, 0.35, 0.78, ['living', 'hall', 'other'], [1800, 4000, 9000], { wall: true, surf: [1.2, 0.35, 0.78], colorRole: 'wood' }),
  bed: f('bed', 'سرير مزدوج', 1.6, 2.0, 0.6, ['bed'], [9000, 18000, 42000], { wall: true, top: 1.0, colorRole: 'fabric' }),
  bedS: f('bedS', 'سرير فردي', 1.2, 2.0, 0.6, ['bed'], [6000, 12000, 28000], { wall: true, top: 1.0, colorRole: 'fabric' }),
  night: f('night', 'كومدينو', 0.45, 0.4, 0.5, ['bed'], [1000, 2200, 5500], { wall: true, surf: [0.45, 0.4, 0.5], colorRole: 'wood' }),
  wardrobe: f('wardrobe', 'دولاب 1.8 م', 1.8, 0.6, 2.1, ['bed', 'other'], [9000, 18000, 40000], { wall: true, colorRole: 'wood' }),
  desk: f('desk', 'مكتب', 1.2, 0.6, 0.75, ['bed', 'other'], [2500, 5500, 13000], { wall: true, surf: [1.2, 0.6, 0.75], colorRole: 'wood' }),
  kitchenrun: f('kitchenrun', 'وحدات مطبخ 2.4 م', 2.4, 0.6, 0.9, ['kitchen'], [12000, 28000, 70000], { wall: true, surf: [2.4, 0.6, 0.9], colorRole: 'wood' }),
  fridge: f('fridge', 'ثلاجة', 0.7, 0.7, 1.8, ['kitchen'], [14000, 20000, 32000], { wall: true }),
  vanity: f('vanity', 'حوض بوحدة ومرآة', 0.6, 0.45, 0.85, ['bath'], [3500, 8000, 20000], { wall: true, top: 1.9, colorRole: 'wood' }),
  toilet: f('toilet', 'مرحاض', 0.4, 0.65, 0.8, ['bath'], [2500, 5000, 11000], { wall: true }),
  shower: f('shower', 'كابينة دش', 0.9, 0.9, 2.0, ['bath'], [3000, 7000, 16000], { wall: true }),
  vase: f('vase', 'فازة ورد', 0.15, 0.15, 0.3, ['living', 'bed', 'other', 'hall'], [200, 500, 1500], { acc: true }),
  lamp: f('lamp', 'أباجورة', 0.25, 0.25, 0.45, ['living', 'bed', 'other', 'hall'], [500, 1500, 4500], { acc: true }),
  plant: f('plant', 'نبات زينة', 0.45, 0.45, 1.3, ['living', 'hall', 'other', 'bed'], [500, 1500, 4000]),
  bookshelf: f('bookshelf', 'مكتبة', 0.9, 0.3, 1.9, ['living', 'other', 'bed'], [3500, 8000, 20000], { wall: true, colorRole: 'wood' }),
  sideboard: f('sideboard', 'بوفيه', 1.6, 0.45, 0.85, ['living'], [4500, 10000, 26000], { wall: true, surf: [1.6, 0.45, 0.85], colorRole: 'wood' }),
  dresser: f('dresser', 'تسريحة', 1.1, 0.45, 0.8, ['bed'], [3500, 8000, 20000], { wall: true, surf: [1.1, 0.45, 0.8], colorRole: 'wood' }),
  shoecab: f('shoecab', 'دولاب أحذية', 1.0, 0.35, 1.1, ['living', 'hall'], [2500, 5500, 12000], { wall: true, surf: [1.0, 0.35, 1.1], colorRole: 'wood' }),
  washer: f('washer', 'غسالة', 0.6, 0.6, 0.85, ['other', 'kitchen', 'bath'], [11000, 17000, 28000], { wall: true }),
}
export const FURN: Record<string, FurnDef> = { ...BASE }
export const HIDDEN = new Set<string>()          // القطع المخفية من قايمة العميل
export const PREF: Record<string, string> = {}   // القطعة المفضلة لكل دور في الفرش التلقائي

export const FABRIC_SW = [
  { name: 'كتان بيج', hex: '#CDBFA6' }, { name: 'رمادي', hex: '#8C9096' }, { name: 'كحلي', hex: '#3B4A6B' },
  { name: 'زيتي', hex: '#6B7A4F' }, { name: 'تراكوتا', hex: '#B9735A' }, { name: 'كريمي', hex: '#E4DDCF' },
]
export const WOOD_SW = [
  { name: 'زان', hex: '#C9A06B' }, { name: 'بلوط', hex: '#A9784F' }, { name: 'جوز', hex: '#6B4A33' },
  { name: 'ونجيه', hex: '#3E2C22' }, { name: 'رمادي', hex: '#8E8B87' }, { name: 'أبيض', hex: '#EDE9E2' },
]

export const ROT_OF: Record<Side, number> = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }
const sideOfRot = (rot: number): Side => {
  const k = ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4
  return (['N', 'W', 'S', 'E'] as Side[])[k]
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// القطعة المستخدمة فعلياً لدور معين في الفرش التلقائي (المفضلة، وإلا الأساسية، وإلا أي بديلة ظاهرة)
export const pick = (role: string): FurnKind => {
  const p = PREF[role]
  if (p && FURN[p] && !HIDDEN.has(p)) return p
  if (FURN[role] && !HIDDEN.has(role)) return role
  const alt = Object.values(FURN).find((x) => x.role === role && !HIDDEN.has(x.kind))
  return alt ? alt.kind : role
}
const D = (role: string) => FURN[pick(role)]

// ===== الهندسة =====
export interface Box { x0: number; x1: number; z0: number; z1: number }
export const inner = (R: { w: number; d: number }): Box => ({ x0: -R.w / 2 + WALL_T, x1: R.w / 2 - WALL_T, z0: -R.d / 2 + WALL_T, z1: R.d / 2 - WALL_T })

export function halfExt(d: { w: number; d: number }, rot: number): [number, number] {
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot))
  return [(c * d.w + s * d.d) / 2, (s * d.w + c * d.d) / 2]
}
export function boxOf(d: FurnDef, it: { x: number; z: number; rot: number }): Box {
  const [hx, hz] = halfExt(d, it.rot)
  return { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz }
}
const hit = (a: Box, b: Box) => a.x0 < b.x1 - 0.005 && a.x1 > b.x0 + 0.005 && a.z0 < b.z1 - 0.005 && a.z1 > b.z0 + 0.005

// منطقة جنب حيطة: c = المسافة على طول الحيطة من منتصفها، depth = العمق ناحية الغرفة
function zone(R: { w: number; d: number }, side: Side, c: number, width: number, depth: number): Box {
  const hw = width / 2 + 0.05, T = WALL_T
  if (side === 'N') return { x0: c - hw, x1: c + hw, z0: -R.d / 2 + T, z1: -R.d / 2 + T + depth }
  if (side === 'S') return { x0: c - hw, x1: c + hw, z0: R.d / 2 - T - depth, z1: R.d / 2 - T }
  if (side === 'W') return { x0: -R.w / 2 + T, x1: -R.w / 2 + T + depth, z0: c - hw, z1: c + hw }
  return { x0: R.w / 2 - T - depth, x1: R.w / 2 - T, z0: c - hw, z1: c + hw }
}

export function columnBox(R: { w: number; d: number }, c: Column): Box {
  const len = c.side === 'N' || c.side === 'S' ? R.w : R.d
  const cc = c.offset - len / 2, hw = c.w / 2, T = WALL_T
  if (c.side === 'N') return { x0: cc - hw, x1: cc + hw, z0: -R.d / 2 + T, z1: -R.d / 2 + T + c.d }
  if (c.side === 'S') return { x0: cc - hw, x1: cc + hw, z0: R.d / 2 - T - c.d, z1: R.d / 2 - T }
  if (c.side === 'W') return { x0: -R.w / 2 + T, x1: -R.w / 2 + T + c.d, z0: cc - hw, z1: cc + hw }
  return { x0: R.w / 2 - T - c.d, x1: R.w / 2 - T, z0: cc - hw, z1: cc + hw }
}

export interface Obstacle { kind: 'column' | 'door' | 'bar' | 'island' | 'window' | 'item'; box: Box; sill?: number }

// كل اللي ممكن القطعة تخبط فيه: الأعمدة، ومناطق الأبواب والشبابيك والبار، والفرش التاني
export function obstacles(R: RoomView, all: RoomView[], items: FurnItem[], ignore?: number): Obstacle[] {
  const out: Obstacle[] = []
  R.columns.forEach((c) => out.push({ kind: 'column', box: columnBox(R, c) }))
  for (const o of R.openings) {
    if (o.kind === 'window') out.push({ kind: 'window', box: zone(R, o.side, o.c, o.width, 0.45), sill: o.sill })
    else if (o.kind === 'door') out.push({ kind: 'door', box: zone(R, o.side, o.c, o.width + 0.1, 0.95) })
    else {
      const nb = all.find((r) => r.id === o.to)
      if (o.sill > 0.01) out.push({ kind: 'bar', box: zone(R, o.side, o.c, o.width, R.type === 'kitchen' ? 0.3 : 1.3) })
      else if (o.width >= 2.4 && R.type === 'kitchen') out.push({ kind: 'island', box: zone(R, o.side, o.c, Math.min(3.2, o.width - 0.5) + 0.2, 1.1) })
      else if (o.width >= 2.4 && nb && nb.type === 'kitchen') out.push({ kind: 'island', box: zone(R, o.side, o.c, Math.min(3.2, o.width - 0.5) + 0.2, 0.9) })
      else out.push({ kind: 'door', box: zone(R, o.side, o.c, o.width, 0.5) })
    }
  }
  for (const it of items) {
    if (it.id === ignore) continue
    const d = FURN[it.kind]
    if (!d || d.rug || d.acc) continue
    out.push({ kind: 'item', box: boxOf(d, it) })
  }
  return out
}

// بيرجّع سبب المنع (أو null لو المكان سليم)
export function blocked(R: { w: number; d: number }, d: FurnDef, it: FurnItem, obs: Obstacle[]): Obstacle | 'wall' | null {
  const b = boxOf(d, it), n = inner(R), e = 0.003
  if (b.x0 < n.x0 - e || b.x1 > n.x1 + e || b.z0 < n.z0 - e || b.z1 > n.z1 + e) return 'wall'
  if (d.rug || d.acc) return null
  const top = d.top ?? d.h
  for (const o of obs) {
    if (o.kind === 'window' && top <= (o.sill ?? 0.9) - 0.02) continue // القطعة الواطية متحجبش الشباك
    if (hit(b, o.box)) return o
  }
  return null
}

function clampIn(R: { w: number; d: number }, d: FurnDef, it: FurnItem): FurnItem {
  const n = inner(R), [hx, hz] = halfExt(d, it.rot)
  return {
    ...it,
    x: clamp(it.x, n.x0 + hx, Math.max(n.x0 + hx, n.x1 - hx)),
    z: clamp(it.z, n.z0 + hz, Math.max(n.z0 + hz, n.z1 - hz)),
  }
}

// الالتصاق بالحيطة: لو الحافة أقرب من 15 سم، القطعة بتلتصق وبتلف وضهرها على الحيطة ووشها للغرفة
export function snapToWall(R: { w: number; d: number }, d: FurnDef, it: FurnItem): FurnItem {
  const n = inner(R), [cx, cz] = halfExt(d, it.rot)
  const gaps: Record<Side, number> = { N: it.z - cz - n.z0, S: n.z1 - (it.z + cz), W: it.x - cx - n.x0, E: n.x1 - (it.x + cx) }
  let best: Side | null = null
  for (const s of ['N', 'S', 'W', 'E'] as Side[]) if (gaps[s] < 0.15 && (best === null || gaps[s] < gaps[best])) best = s
  if (best === null) return it
  const rot = ROT_OF[best], [hx, hz] = halfExt(d, rot)
  const x = best === 'W' ? n.x0 + hx : best === 'E' ? n.x1 - hx : clamp(it.x, n.x0 + hx, Math.max(n.x0 + hx, n.x1 - hx))
  const z = best === 'N' ? n.z0 + hz : best === 'S' ? n.z1 - hz : clamp(it.z, n.z0 + hz, Math.max(n.z0 + hz, n.z1 - hz))
  return { ...it, x, z, rot }
}

// ===== الأسطح اللي الإكسسوارات بتتحط عليها =====
interface Surf { box: Box; y: number; host?: number }
function surfaces(R: RoomView, items: FurnItem[]): Surf[] {
  const out: Surf[] = []
  for (const it of items) {
    const d = FURN[it.kind]
    if (!d || !d.surf || d.acc) continue
    const [hx, hz] = halfExt({ w: d.surf[0], d: d.surf[1] }, it.rot)
    out.push({ box: { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz }, y: it.y + d.surf[2], host: it.id })
  }
  for (const o of R.openings) if (o.kind === 'pass' && o.sill > 0.01 && R.type !== 'kitchen') out.push({ box: zone(R, o.side, o.c, o.width, 0.4), y: o.sill + 0.05 })
  return out
}
function surfaceAt(ss: Surf[], x: number, z: number): Surf | null {
  let best: Surf | null = null
  for (const s of ss) if (x >= s.box.x0 && x <= s.box.x1 && z >= s.box.z0 && z <= s.box.z1 && (best === null || s.y > best.y)) best = s
  return best
}

// ===== التحريك والتدوير والحذف (بتعدّل القطعة مباشرة) =====
export function moveItem(R: RoomView, all: RoomView[], items: FurnItem[], it: FurnItem, x: number, z: number): { ok: boolean } {
  const d = FURN[it.kind]
  if (d.acc) {
    const s = surfaceAt(surfaces(R, items.filter((i) => i.id !== it.id)), x, z)
    if (!s) return { ok: false }
    it.x = x; it.z = z; it.y = s.y; it.host = s.host
    return { ok: true }
  }
  const obs = obstacles(R, all, items, it.id)
  const tryAt = (nx: number, nz: number): FurnItem | null => {
    let c = clampIn(R, d, { ...it, x: nx, z: nz })
    if (d.wall) c = snapToWall(R, d, c)
    return blocked(R, d, c, obs) ? null : c
  }
  const c = tryAt(x, z) ?? tryAt(x, it.z) ?? tryAt(it.x, z) // لو متصادمة بتنزلق على محور واحد
  if (!c) return { ok: false }
  const dx = c.x - it.x, dz = c.z - it.z
  it.x = c.x; it.z = c.z; it.rot = c.rot
  for (const ch of items) if (ch.host === it.id) { ch.x += dx; ch.z += dz }
  return { ok: true }
}

export function rotateItem(R: RoomView, all: RoomView[], items: FurnItem[], it: FurnItem, delta = Math.PI / 2): string | null {
  const d = FURN[it.kind]
  const c = clampIn(R, d, { ...it, rot: it.rot + delta })
  if (blocked(R, d, c, obstacles(R, all, items, it.id))) return 'مينفعش تتلف هنا، هتخبط في حاجة'
  const px = it.x, pz = it.z
  it.x = c.x; it.z = c.z; it.rot = c.rot
  const cs = Math.cos(delta), sn = Math.sin(delta)
  for (const ch of items) {
    if (ch.host !== it.id) continue
    const dx = ch.x - px, dz = ch.z - pz
    ch.x = it.x + dx * cs + dz * sn; ch.z = it.z - dx * sn + dz * cs; ch.rot += delta
  }
  return null
}

export function removeItem(a: Apartment, roomId: number, id: number) {
  a.furniture[roomId] = (a.furniture[roomId] ?? []).filter((i) => i.id !== id && i.host !== id)
}

// بيشيل الفرش اللي بقى برّه الغرفة أو بيخبط في عمود بعد تغيير الأبعاد
export function fitFurniture(a: Apartment) {
  for (const k of Object.keys(a.furniture)) {
    const id = Number(k), r = a.rooms.find((x) => x.id === id)
    if (!r) { delete a.furniture[id]; continue }
    const cols = a.columns.filter((c) => c.roomId === id).map((c) => columnBox(r, c))
    const n = inner(r)
    let list = a.furniture[id].filter((it) => {
      const d = FURN[it.kind]
      if (!d) return false
      const b = boxOf(d, it)
      if (b.x0 < n.x0 - 0.02 || b.x1 > n.x1 + 0.02 || b.z0 < n.z0 - 0.02 || b.z1 > n.z1 + 0.02) return false
      return d.rug || d.acc || !cols.some((cb) => hit(b, cb))
    })
    const ids = new Set(list.map((i) => i.id))
    list = list.filter((i) => i.host === undefined || ids.has(i.host))
    a.furniture[id] = list
  }
}

// ===== الفرش التلقائي =====
interface Cand { x: number; z: number; rot: number }

// الحيطان مرتبة من الأطول مساحة فاضية (من غير أبواب وشبابيك وأعمدة)
function wallsByFree(R: RoomView): Side[] {
  const free = (s: Side) => {
    const len = s === 'N' || s === 'S' ? R.w : R.d
    const used = R.openings.filter((o) => o.side === s).reduce((t, o) => t + o.width + (o.kind === 'window' ? 0 : 0.9), 0) + R.columns.filter((c) => c.side === s).reduce((t, c) => t + c.w, 0)
    return len - used
  }
  return (['N', 'S', 'W', 'E'] as Side[]).sort((p, q) => free(q) - free(p))
}

function wallCands(R: { w: number; d: number }, d: FurnDef, sides: Side[], fr: number[]): Cand[] {
  const n = inner(R), out: Cand[] = []
  for (const s of sides) {
    const rot = ROT_OF[s], [hx, hz] = halfExt(d, rot)
    for (const fo of fr) {
      if (s === 'N' || s === 'S') out.push({ x: n.x0 + hx + fo * Math.max(0, n.x1 - n.x0 - 2 * hx), z: s === 'N' ? n.z0 + hz : n.z1 - hz, rot })
      else out.push({ x: s === 'W' ? n.x0 + hx : n.x1 - hx, z: n.z0 + hz + fo * Math.max(0, n.z1 - n.z0 - 2 * hz), rot })
    }
  }
  return out
}

function cornerCands(R: { w: number; d: number }, d: FurnDef): Cand[] {
  const n = inner(R), [hx, hz] = halfExt(d, 0)
  return [
    { x: n.x0 + hx, z: n.z0 + hz, rot: 0 }, { x: n.x1 - hx, z: n.z0 + hz, rot: 0 },
    { x: n.x0 + hx, z: n.z1 - hz, rot: 0 }, { x: n.x1 - hx, z: n.z1 - hz, rot: 0 },
  ]
}

function gridCands(R: { w: number; d: number }): Cand[] {
  const n = inner(R), out: Cand[] = []
  for (let x = n.x0; x <= n.x1; x += 0.3) for (let z = n.z0; z <= n.z1; z += 0.3) out.push({ x, z, rot: 0 }, { x, z, rot: Math.PI / 2 })
  return out.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))
}

function planRoom(a: Apartment, R: RoomView, all: RoomView[]): FurnItem[] {
  const items: FurnItem[] = []
  const walls = wallsByFree(R)
  const area = R.w * R.d
  // role = دور القطعة (بيتحوّل لأنسب قطعة فعلية: المفضلة أو البديلة)
  const add = (role: string, cands: Cand[], y = 0, host?: number): FurnItem | null => {
    const kind = pick(role), d = FURN[kind]
    for (const c of cands) {
      const it: FurnItem = { id: 0, kind, x: c.x, z: c.z, rot: c.rot, y, host }
      if (!blocked(R, d, it, obstacles(R, all, items))) { it.id = a.nextId++; items.push(it); return it }
    }
    return null
  }
  const onTop = (role: string, h: FurnItem | null) => {
    const s = h ? FURN[h.kind].surf : undefined
    if (h && s) add(role, [{ x: h.x, z: h.z, rot: 0 }], h.y + s[2], h.id)
  }
  const corner = (role: string) => add(role, cornerCands(R, D(role)))

  if (R.type === 'living') {
    const dining = /سفرة/.test(R.name), sitting = /ركن جلوس/.test(R.name)
    if (dining) {
      const horiz = R.w >= R.d
      add('dining', horiz ? [{ x: 0, z: 0, rot: 0 }, { x: 0, z: 0, rot: Math.PI / 2 }] : [{ x: 0, z: 0, rot: Math.PI / 2 }, { x: 0, z: 0, rot: 0 }])
      if (area >= 14) add('sideboard', wallCands(R, D('sideboard'), walls, [0.5, 0.25, 0.75]))
    } else {
      const tv = sitting ? null : add('tvunit', wallCands(R, D('tvunit'), walls, [0.5, 0.3, 0.7]))
      if (tv) {
        const td = FURN[tv.kind].d, sd = D('sofa').d
        const fw = [Math.sin(tv.rot), Math.cos(tv.rot)] // اتجاه وش التلفزيون ناحية الغرفة
        let gap = 0
        for (const g of [2.4, 2.0, 1.7, 1.4]) {
          const k = td / 2 + g + sd / 2
          if (add('sofa', [{ x: tv.x + fw[0] * k, z: tv.z + fw[1] * k, rot: tv.rot + Math.PI }])) { gap = g; break }
        }
        if (gap) {
          const cx = tv.x + fw[0] * (td / 2 + gap * 0.5), cz = tv.z + fw[1] * (td / 2 + gap * 0.5)
          add('rug', [{ x: cx, z: cz, rot: tv.rot }])
          onTop('vase', add('coffee', [{ x: cx, z: cz, rot: tv.rot }]))
          if (area >= 20) {
            const l = [Math.cos(tv.rot), -Math.sin(tv.rot)]
            for (const s of [-1, 1]) {
              const px = cx + l[0] * s * 1.45, pz = cz + l[1] * s * 1.45
              add('armchair', [{ x: px, z: pz, rot: Math.atan2(cx - px, cz - pz) }])
            }
          }
        }
      } else {
        const sofa = add('sofa', wallCands(R, D('sofa'), walls, [0.5, 0.3, 0.7]))
        if (sofa) {
          const k = FURN[sofa.kind].d / 2 + 0.5 + D('coffee').d / 2
          const cx = sofa.x + Math.sin(sofa.rot) * k, cz = sofa.z + Math.cos(sofa.rot) * k
          add('rug', [{ x: cx, z: cz, rot: sofa.rot }])
          onTop('vase', add('coffee', [{ x: cx, z: cz, rot: sofa.rot }]))
          if (area >= 14) {
            const l = [Math.cos(sofa.rot), -Math.sin(sofa.rot)]
            for (const s of [-1, 1]) {
              const px = cx + l[0] * s * 1.45 + Math.sin(sofa.rot) * 0.5, pz = cz + l[1] * s * 1.45 + Math.cos(sofa.rot) * 0.5
              add('armchair', [{ x: px, z: pz, rot: Math.atan2(cx - px, cz - pz) }])
            }
          }
        }
      }
      corner('plant')
      if (area >= 28 && !sitting) add('bookshelf', wallCands(R, D('bookshelf'), walls, [0.15, 0.85, 0.5]))
      if (R.entry) add('shoecab', wallCands(R, D('shoecab'), walls, [0.1, 0.9, 0.5]))
    }
  } else if (R.type === 'bed') {
    const bk = /رئيسية|ماستر/.test(R.name) || (area >= 13 && Math.min(R.w, R.d) >= 3) ? 'bed' : 'bedS'
    const bed = add(bk, wallCands(R, D(bk), walls, [0.5, 0.35, 0.65]))
    let bedSide: Side | null = null
    if (bed) {
      const bd = FURN[bed.kind], nd = D('night')
      bedSide = sideOfRot(bed.rot)
      const l = [Math.cos(bed.rot), -Math.sin(bed.rot)], fw = [Math.sin(bed.rot), Math.cos(bed.rot)]
      let first: FurnItem | null = null
      for (const s of [-1, 1]) {
        const o = bd.w / 2 + nd.w / 2 + 0.04, b = bd.d / 2 - nd.d / 2
        const n = add('night', [{ x: bed.x + l[0] * s * o - fw[0] * b, z: bed.z + l[1] * s * o - fw[1] * b, rot: bed.rot }])
        if (n && !first) first = n
      }
      onTop('lamp', first)
    }
    const others = walls.filter((s) => s !== bedSide)
    const order = bedSide ? [...others, bedSide] : walls
    add('wardrobe', wallCands(R, D('wardrobe'), order, [0.5, 0.25, 0.75, 0.1, 0.9]))
    if (area >= 15) add('desk', wallCands(R, D('desk'), order, [0.5, 0.2, 0.8]))
    if (area >= 18) add('dresser', wallCands(R, D('dresser'), order, [0.5, 0.2, 0.8]))
  } else if (R.type === 'kitchen') {
    add('kitchenrun', wallCands(R, D('kitchenrun'), walls, [0.5, 0.2, 0.8]))
    add('fridge', wallCands(R, D('fridge'), walls, [0, 1, 0.5, 0.3, 0.7]))
    if (area >= 9) add('washer', wallCands(R, D('washer'), walls, [0.9, 0.1, 0.5]))
  } else if (R.type === 'bath') {
    add('vanity', wallCands(R, D('vanity'), walls, [0.2, 0.5, 0.8, 0.1]))
    add('toilet', wallCands(R, D('toilet'), walls, [0.8, 0.2, 0.5, 0.1, 0.9]))
    add('shower', wallCands(R, D('shower'), walls, [0.1, 0.9, 0.5]))
  } else if (R.type === 'hall') {
    if (Math.min(R.w, R.d) >= 1.5 && area >= 6) {
      add('console', wallCands(R, D('console'), walls, [0.5, 0.25, 0.75]))
      corner('plant')
    }
  } else if (R.type === 'other') {
    if (/دريسنج/.test(R.name)) {
      for (let i = 0; i < 2; i++) add('wardrobe', wallCands(R, D('wardrobe'), walls, [0.5, 0.2, 0.8]))
    } else if (/مخزن|غسيل/.test(R.name)) {
      add('washer', wallCands(R, D('washer'), walls, [0.3, 0.7, 0.5]))
      add('bookshelf', wallCands(R, D('bookshelf'), walls, [0.5, 0.2, 0.8]))
    } else {
      add('desk', wallCands(R, D('desk'), walls, [0.5, 0.2, 0.8]))
      add('bookshelf', wallCands(R, D('bookshelf'), walls, [0.5, 0.2, 0.8]))
    }
  }
  return items
}

export function furnishRoom(a: Apartment, R: RoomView, all: RoomView[]) {
  a.furniture[R.id] = planRoom(a, R, all)
}
export function autoFurnishAll(a: Apartment, all: RoomView[]) {
  for (const r of all) furnishRoom(a, r, all)
}

// إضافة قطعة جديدة في أول مكان مناسب
export function placeNew(a: Apartment, R: RoomView, all: RoomView[], kind: FurnKind): string | null {
  const d = FURN[kind]
  if (!d) return 'القطعة دي مش موجودة'
  const items = a.furniture[R.id] ?? (a.furniture[R.id] = [])
  const mk = (x: number, z: number, rot: number, y = 0, host?: number): FurnItem => ({ id: a.nextId, kind, x, z, rot, y, host })
  if (d.acc) {
    const s = surfaces(R, items)[0]
    if (!s) return 'مفيش سطح (ترابيزة أو كوميدينو) تحط عليه القطعة دي'
    items.push(mk((s.box.x0 + s.box.x1) / 2, (s.box.z0 + s.box.z1) / 2, 0, s.y, s.host)); a.nextId++
    return null
  }
  const obs = obstacles(R, all, items)
  const cands = d.wall ? wallCands(R, d, wallsByFree(R), [0.5, 0.3, 0.7, 0.15, 0.85, 0.02, 0.98]) : gridCands(R)
  for (const c of cands) {
    const it = mk(c.x, c.z, c.rot)
    if (!blocked(R, d, it, obs)) { items.push(it); a.nextId++; return null }
  }
  return 'مفيش مكان فاضي مناسب للقطعة دي في الغرفة'
}

const BI: Record<BudgetId, number> = { economy: 0, mid: 1, luxury: 2 }
export const furnCost = (R: RoomView, b: BudgetId) => (R.fon ? R.furniture.reduce((s, it) => s + (FURN[it.kind]?.price[BI[b]] ?? 0), 0) : 0)