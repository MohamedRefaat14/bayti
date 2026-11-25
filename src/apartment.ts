import type { StyleId } from './data/options'
import type { FloorConfig } from './data/catalog'
import type { WallConfig } from './data/wallCatalog'
import type { CeilingConfig } from './data/ceilingCatalog'
import { presetFor } from './data/materials'
import { dimsFor, layoutTemplate, suggest, tplById } from './templates'
import type { KitchenMode } from './templates'
import { fitFurniture } from './furniture'
import type { FurnItem } from './furniture'
import { RULES } from './data/rules'

export type RoomType = 'bed' | 'bath' | 'living' | 'kitchen' | 'hall' | 'other'
export type Side = 'N' | 'E' | 'S' | 'W' // N = الحيطة اللي في أعلى المخطط
export type ShapeId = 'rect' | 'square' | 'L' | 'U'
export type Mode = 'template' | 'custom'

export const TYPE_NAMES: Record<RoomType, string> = {
  bed: 'غرفة نوم', bath: 'حمام', living: 'ريسبشن', kitchen: 'مطبخ', hall: 'ممر', other: 'غرفة أخرى',
}
export const SIDE_NAMES: Record<Side, string> = { N: 'فوق', S: 'تحت', W: 'يسار', E: 'يمين' }
export const SHAPE_NAMES: Record<ShapeId, string> = { rect: 'مستطيل', square: 'مربع', L: 'حرف L', U: 'حرف U' }

const SIDES: Side[] = ['N', 'E', 'S', 'W']
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const EPS = 0.06
const HALL_T = 1.3 // عرض الممر في التوزيع المخصص
const MIN_W: Record<RoomType, number> = { bed: 2.6, bath: 1.6, living: 3, kitchen: 2, hall: 1, other: 2 }
const DEFAULT_SIZE: Record<RoomType, [number, number]> = {
  bed: [3.5, 3.5], bath: [2, 2.5], living: [5.5, 4.5], kitchen: [3.5, 3], hall: [1.5, 4], other: [3, 3],
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r2 = (v: number) => Math.round(v * 100) / 100
const sn = (v: number) => Math.round(v * 20) / 20 // تقريب لأقرب 5 سم
const isPub = (t: RoomType) => t === 'living' || t === 'kitchen'

// ===== الأنواع =====
export interface Wish { id: number; type: RoomType; name: string; w: number; d: number }
// entry = غرفة باب الشقة | ens = غرفة ملحقة بغرفة نوم (حمام الماستر والدريسنج)
export interface Room { id: number; type: RoomType; name: string; x: number; y: number; w: number; d: number; entry?: boolean; ens?: boolean }
// pass = فتحة مفتوحة بين غرفتين (sill = 0 فتحة من الأرض، وأكبر من 0 بار)
export interface Opening { id: number; kind: 'door' | 'window' | 'pass'; roomId: number; side: Side; offset: number; width: number; sill: number }
export interface Resolved { id: number; kind: 'door' | 'window' | 'pass'; side: Side; c: number; width: number; sill: number; to: number | null; own: boolean; tt?: RoomType }

// عمود إنشائي ملتصق بحيطة: offset = بُعد مركزه عن بداية الحيطة (زي الفتحات)، w = العرض على الحيطة، d = البروز جوه الغرفة
export interface Column { id: number; roomId: number; side: Side; offset: number; w: number; d: number }

export interface Apartment {
  mode: Mode
  area: number          // النماذج الجاهزة: المساحة الكلية
  ratio: number         // نسبة عرض الواجهة للعمق
  tpl: string           // النموذج المختار
  kitchen: KitchenMode
  blind: boolean        // الجانبين من غير شبابيك
  shape: ShapeId        // التوزيع المخصص
  width: number
  length: number
  notchW: number
  notchD: number
  mirror: boolean
  front: Side           // الشارع في أنهي ناحية
  height: number        // ارتفاع السقف
  wishes: Wish[]
  rooms: Room[]
  openings: Opening[]
  finish: Record<number, { wall: WallConfig; floor: FloorConfig; ceiling: CeilingConfig }>
  columns: Column[]
  furniture: Record<number, FurnItem[]> // الفرش لكل غرفة (مكانه بالمتر من منتصف الغرفة)
  furnOn: boolean
  fabric: string        // لون القماش
  wood: string          // لون الخشب
  openFin: Record<number, { style?: string; color?: string }> // نوع ولون كل باب وشباك اختاره العميل (المفتاح = رقم الفتحة)
  odef: Record<string, string>
  wallExt: number       // سمك الحيطة الخارجية بالمتر
  wallInt: number       // سمك الحيطة الداخلية بالمتر                                // النوع الافتراضي لكل (باب شقة / غرفة / حمام / شباك)
  nextId: number
}

export interface RoomView extends Room {
  h: number; wall: WallConfig; floor: FloorConfig; ceiling: CeilingConfig; openings: Resolved[]
  columns: Column[]; furniture: FurnItem[]; fon: boolean; fabric: string; wood: string
  ofin: Apartment['openFin']; odef: Apartment['odef']
  cw: number; cd: number // الأبعاد الصافية بين وش الحيطان (للكميات)
}

// ===== هندسة الحيطان =====
export const sideLen = (r: { w: number; d: number }, s: Side) => (s === 'N' || s === 'S' ? r.w : r.d)

export function wallLine(r: { x: number; y: number; w: number; d: number }, s: Side) {
  if (s === 'N') return { axis: 'h' as const, fixed: r.y, from: r.x, to: r.x + r.w }
  if (s === 'S') return { axis: 'h' as const, fixed: r.y + r.d, from: r.x, to: r.x + r.w }
  if (s === 'W') return { axis: 'v' as const, fixed: r.x, from: r.y, to: r.y + r.d }
  return { axis: 'v' as const, fixed: r.x + r.w, from: r.y, to: r.y + r.d }
}

// الغرف الملاصقة لحيطة غرفة (والجزء المشترك بينهم)
function neighborsOn(rooms: Room[], r: Room, s: Side) {
  const l = wallLine(r, s), out: { n: Room; lo: number; hi: number }[] = []
  for (const n of rooms) {
    if (n.id === r.id) continue
    const w = wallLine(n, OPP[s])
    if (w.axis !== l.axis || Math.abs(w.fixed - l.fixed) > EPS) continue
    const lo = Math.max(l.from, w.from), hi = Math.min(l.to, w.to)
    if (hi - lo > EPS) out.push({ n, lo, hi })
  }
  return out.sort((p, q) => p.lo - q.lo)
}

// الأجزاء الخارجية من حيطة (اللي مش ملاصقة لأي غرفة)
export function exteriorIntervals(rooms: Room[], r: Room, s: Side): [number, number][] {
  const l = wallLine(r, s), out: [number, number][] = []
  let cur = l.from
  for (const { lo, hi } of neighborsOn(rooms, r, s)) {
    if (lo - cur > EPS) out.push([cur, lo])
    cur = Math.max(cur, hi)
  }
  if (l.to - cur > EPS) out.push([cur, l.to])
  return out
}

export function bounds(rooms: { x: number; y: number; w: number; d: number }[]) {
  if (!rooms.length) return { x0: 0, y0: 0, x1: 1, y1: 1 }
  return {
    x0: Math.min(...rooms.map((r) => r.x)), y0: Math.min(...rooms.map((r) => r.y)),
    x1: Math.max(...rooms.map((r) => r.x + r.w)), y1: Math.max(...rooms.map((r) => r.y + r.d)),
  }
}
export const builtArea = (rooms: { w: number; d: number }[]) => rooms.reduce((s, r) => s + r.w * r.d, 0)

// ===== حل الفتحات: الفتحة على حيطة مشتركة بتظهر في الغرفتين =====
function neighborOf(own: Room, o: Opening, rooms: Room[]): Room | null {
  const l = wallLine(own, o.side), c = l.from + o.offset, h = o.width / 2
  for (const n of rooms) {
    if (n.id === own.id) continue
    const w = wallLine(n, OPP[o.side])
    if (w.axis === l.axis && Math.abs(w.fixed - l.fixed) < EPS && c - h >= w.from - EPS && c + h <= w.to + EPS) return n
  }
  return null
}

export function resolveOpenings(r: Room, rooms: Room[], ops: Opening[]): Resolved[] {
  const out: Resolved[] = []
  for (const o of ops) {
    const own = rooms.find((x) => x.id === o.roomId)
    if (!own) continue
    if (own.id === r.id) {
      const nb = o.kind !== 'window' ? neighborOf(own, o, rooms) : null
      const l = wallLine(r, o.side)
      out.push({ id: o.id, kind: o.kind, side: o.side, c: l.from + o.offset - (l.from + l.to) / 2, width: o.width, sill: o.sill, to: nb ? nb.id : null, own: true, tt: nb ? nb.type : undefined })
    } else if (o.kind !== 'window') {
      const nb = neighborOf(own, o, rooms)
      if (nb && nb.id === r.id) {
        const side = OPP[o.side], l = wallLine(own, o.side), w = wallLine(r, side)
        out.push({ id: o.id, kind: o.kind, side, c: l.from + o.offset - (w.from + w.to) / 2, width: o.width, sill: o.sill, to: own.id, own: false, tt: own.type })
      }
    }
  }
  return out
}

// الفاقد من كل ضلع: الحيطة الخارجية بسمكها كامل، والداخلية بنصف سمكها (الحيطة بين غرفتين)
function sideLoss(a: Apartment, r: Room, s: Side) {
  const len = sideLen(r, s)
  const ext = Math.min(len, exteriorIntervals(a.rooms, r, s).reduce((t, [lo, hi]) => t + (hi - lo), 0))
  return len > 0 ? (ext * a.wallExt + (len - ext) * (a.wallInt / 2)) / len : 0
}
export function clearDims(a: Apartment, r: Room): [number, number] {
  return [
    Math.max(0.5, r.w - sideLoss(a, r, 'W') - sideLoss(a, r, 'E')),
    Math.max(0.5, r.d - sideLoss(a, r, 'N') - sideLoss(a, r, 'S')),
  ]
}
export function setWalls(a: Apartment, ext: number, int: number) {
  a.wallExt = clamp(ext, 0.1, 0.6)
  a.wallInt = clamp(int, 0.07, 0.3)
  return null
}

export function buildViews(a: Apartment, style: StyleId): RoomView[] {
  return a.rooms.map((r) => {
    const f = a.finish[r.id] ?? presetFor(style, r.type)
        const [cw, cd] = clearDims(a, r)
        return {
      ...r, h: a.height, wall: f.wall, floor: f.floor, ceiling: f.ceiling, openings: resolveOpenings(r, a.rooms, a.openings),
      columns: a.columns.filter((c) => c.roomId === r.id), furniture: a.furniture[r.id] ?? [], fon: a.furnOn, ofin: a.openFin, odef: a.odef, fabric: a.fabric, wood: a.wood,cw, cd,
    }
  })
}

// ===== التوزيع المخصص (مستطيل ومربع وL وU) =====
interface Wing { x: number; y: number; w: number; d: number; pub: boolean; hall: 'mid' | 'N' | 'none' }

const dims = (a: Apartment): [number, number] => [a.width, a.shape === 'square' ? a.width : a.length]

function wingsOf(a: Apartment): Wing[] {
  const [W, L] = dims(a)
  if (a.shape === 'L') {
    const nw = clamp(a.notchW, 2, W - 3), nd = clamp(a.notchD, 2, L - 4.5)
    return [
      { x: 0, y: nd, w: W, d: L - nd, pub: true, hall: 'N' },
      { x: 0, y: 0, w: W - nw, d: nd, pub: false, hall: 'none' },
    ]
  }
  if (a.shape === 'U') {
    const nw = clamp(a.notchW, 2, W - 6), nd = clamp(a.notchD, 2, L - 4.5), aw = (W - nw) / 2
    return [
      { x: 0, y: nd, w: W, d: L - nd, pub: true, hall: 'N' },
      { x: 0, y: 0, w: aw, d: nd, pub: false, hall: 'none' },
      { x: W - aw, y: 0, w: aw, d: nd, pub: false, hall: 'none' },
    ]
  }
  return [{ x: 0, y: 0, w: W, d: L, pub: true, hall: 'mid' }]
}

function orderPrivate(list: Wish[]): Wish[] {
  const beds = list.filter((w) => w.type === 'bed'), baths = list.filter((w) => w.type === 'bath')
  const rest = list.filter((w) => w.type !== 'bed' && w.type !== 'bath')
  const out: Wish[] = []
  let bi = 0
  if (beds[0]) out.push(beds[0])
  if (baths[bi]) out.push(baths[bi++])
  for (let i = 1; i < beds.length; i++) {
    out.push(beds[i])
    if (i % 2 === 0 && baths[bi]) out.push(baths[bi++])
  }
  while (bi < baths.length) out.push(baths[bi++])
  return [...out, ...rest]
}

function allocate(a: Apartment, wings: Wing[]): Wish[][] {
  const out: Wish[][] = wings.map(() => [])
  const pub = a.wishes.filter((w) => isPub(w.type)).sort((p, q) => (p.type === 'living' ? 0 : 1) - (q.type === 'living' ? 0 : 1))
  const priv = orderPrivate(a.wishes.filter((w) => !isPub(w.type)))
  if (wings.length === 1) { out[0] = [...pub, ...priv]; return out }
  const pubIdx = Math.max(0, wings.findIndex((w) => w.pub))
  const privIdx = wings.map((_, i) => i).filter((i) => !wings[i].pub)
  out[pubIdx] = [...pub]
  const cap = privIdx.map((i) => wings[i].w * wings[i].d * 0.9)
  const sumC = cap.reduce((s, c) => s + c, 0)
  const area = (w: Wish) => w.w * w.d
  const P = priv.reduce((s, w) => s + area(w), 0)
  const eff = Math.min(P, sumC)
  let cum = 0
  priv.forEach((it) => {
    const mid = cum + area(it) / 2
    cum += area(it)
    if (mid > sumC * 1.05) { out[pubIdx].push(it); return }
    let acc = 0, j = privIdx.length - 1
    for (let k = 0; k < privIdx.length; k++) {
      acc += (eff * cap[k]) / sumC
      if (mid <= acc) { j = k; break }
    }
    out[privIdx[j]].push(it)
  })
  return out
}

function packWing(wing: Wing, items: Wish[], nextId: () => number): Room[] {
  const horiz = wing.w >= wing.d
  const U = horiz ? wing.w : wing.d
  const V = horiz ? wing.d : wing.w
  const at = (u: number, v: number, a: number, b: number) =>
    horiz ? { x: wing.x + u, y: wing.y + v, w: a, d: b } : { x: wing.x + v, y: wing.y + u, w: b, d: a }
  const out: Room[] = []
  const hall = (u: number, v: number, a: number, b: number, name = '') => {
    out.push({ id: nextId(), type: 'hall', name, ...at(u, v, a, b) })
  }
  if (!items.length) { hall(0, 0, U, V); return out }

  const meanD = (rw: Wish[]) => {
    const A = rw.reduce((s, w) => s + w.w * w.d, 0)
    return clamp(rw.reduce((s, w) => s + w.d * w.w * w.d, 0) / Math.max(1, A), 2.4, 6.5)
  }
  type Band = { kind: 'hall' } | { kind: 'row'; list: Wish[]; t: number }
  const row = (list: Wish[]): Band => ({ kind: 'row', list, t: meanD(list) })
  const pub = items.filter((w) => isPub(w.type)), priv = items.filter((w) => !isPub(w.type))

  let bands: Band[]
  if (wing.hall === 'N' && horiz) bands = [{ kind: 'hall' }, row([...pub, ...priv])]
  else if (pub.length && priv.length) bands = [row(priv), { kind: 'hall' }, row(pub)]
  else {
    const list = pub.length ? pub : priv
    if (list.length >= 4 && V > 7.5) {
      const half = list.reduce((s, w) => s + w.w * w.d, 0) / 2
      const a1: Wish[] = [], a2: Wish[] = []
      let c = 0
      list.forEach((w) => { (c < half ? a1 : a2).push(w); c += w.w * w.d })
      bands = a2.length ? [row(a1), { kind: 'hall' }, row(a2)] : [row(a1)]
    } else bands = [row(list)]
  }

  const nHall = bands.filter((b) => b.kind === 'hall').length
  const raw = bands.reduce((s, b) => s + (b.kind === 'row' ? b.t : 0), 0)
  const f = Math.max(0.3, (V - nHall * HALL_T) / raw)

  const packRow = (list: Wish[], v: number, t: number) => {
    let wid = list.map((w) => Math.max(MIN_W[w.type], (w.w * w.d) / t))
    const need = wid.reduce((s, x) => s + x, 0)
    let filler = 0
    if (need >= U) wid = wid.map((x) => (x * U) / need)
    else {
      const k = Math.min(1.35, U / need)
      wid = wid.map((x) => x * k)
      const left = U - need * k
      if (left >= 1.5) filler = left
      else wid = wid.map((x) => (x * U) / (need * k))
    }
    let u = 0
    list.forEach((w, i) => { out.push({ id: w.id, type: w.type, name: w.name, ...at(u, v, wid[i], t) }); u += wid[i] })
    if (filler > 0) hall(u, v, filler, t, 'صالة')
  }

  let v = 0
  for (const b of bands) {
    if (b.kind === 'hall') { hall(0, v, U, HALL_T); v += HALL_T; continue }
    const t = b.t * f
    packRow(b.list, v, t)
    v += t
  }
  return out
}

function customRooms(a: Apartment): { rooms: Room[]; W: number; L: number } {
  const [W, L] = dims(a)
  const wings = wingsOf(a)
  const groups = allocate(a, wings)
  let hid = 0
  let rooms: Room[] = []
  wings.forEach((wg, i) => { rooms.push(...packWing(wg, groups[i], () => --hid)) })
  if (a.shape === 'L' && a.mirror) rooms = rooms.map((r) => ({ ...r, x: W - r.x - r.w }))
  return { rooms, W, L }
}

function templateRooms(a: Apartment): { rooms: Room[]; W: number; L: number } {
  const t = tplById(a.tpl)
  const [W, L] = dimsFor(a.area, clamp(a.ratio, t.rmin, t.rmax))
  const rooms: Room[] = layoutTemplate(t, W, L).map((p, i) => ({
    id: i + 1, type: p.t, name: p.n, x: p.x, y: p.y, w: p.w, d: p.d, entry: p.entry, ens: p.ens,
  }))
  return { rooms, W, L }
}

// بيوزّع الشقة (نموذج جاهز أو شكل مخصص) والشارع تحت، وبعدين يدوّر حسب ناحية الشارع
export function regenerate(a: Apartment) {
  const base = a.mode === 'template' ? templateRooms(a) : customRooms(a)
  let rooms = base.rooms
  let bw = base.W, bl = base.L
  const turns = Math.max(0, (['S', 'W', 'N', 'E'] as Side[]).indexOf(a.front))
  for (let t = 0; t < turns; t++) {
    rooms = rooms.map((r) => ({ ...r, x: bl - r.y - r.d, y: r.x, w: r.d, d: r.w }))
    const tmp = bw; bw = bl; bl = tmp
  }
  rooms = rooms
    .map((r) => {
      const x1 = sn(r.x), x2 = sn(r.x + r.w), y1 = sn(r.y), y2 = sn(r.y + r.d)
      return { ...r, x: r2(x1), y: r2(y1), w: r2(x2 - x1), d: r2(y2 - y1) }
    })
    .filter((r) => r.w >= 0.3 && r.d >= 0.3)
  rooms.forEach((r) => { if (r.type === 'hall' && !r.name) r.name = r.w * r.d >= 10 ? 'صالة' : 'ممر' })
  a.rooms = rooms
  a.columns = []; a.furniture = {} // التوزيع اتغيّر: الأعمدة والفرش بيتمسحوا
  Object.keys(a.finish).forEach((k) => { if (Number(k) < 0) delete a.finish[Number(k)] })
  autoOpenings(a)
}

// ===== الأبواب والشبابيك التلقائية =====
function findSlot(used: [number, number][], lo: number, hi: number, width: number, prefer?: number): number | null {
  const m = 0.15, a0 = lo + m + width / 2, a1 = hi - m - width / 2
  if (a1 < a0 - 1e-6) return null
  const pref = clamp(prefer ?? (lo + hi) / 2, a0, a1)
  const ok = (c: number) => !used.some(([u0, u1]) => c + width / 2 > u0 && c - width / 2 < u1)
  for (let i = 0; i <= 800; i++) {
    for (const g of [1, -1]) {
      const c = pref + g * i * 0.05
      if (c < a0 - 1e-6 || c > a1 + 1e-6) continue
      if (ok(c)) return c
    }
  }
  return null
}

export function autoOpenings(a: Apartment) {
  const rooms = a.rooms
  a.openFin = {} // أرقام الفتحات بتتغير، فاختيارات الأنواع بتتمسح
  const ops: Opening[] = []
  const used = new Map<string, [number, number][]>()
  const key = (id: number, s: Side) => id + '|' + s
  const mark = (id: number, s: Side, lo: number, hi: number) => {
    const k = key(id, s)
    used.set(k, [...(used.get(k) ?? []), [lo, hi]])
  }
  const slot = (id: number, s: Side, lo: number, hi: number, width: number, prefer?: number) =>
    findSlot(used.get(key(id, s)) ?? [], lo, hi, width, prefer)
  const push = (room: Room, s: Side, center: number, width: number, kind: Opening['kind'], sill: number, nb: Room | null) => {
    const l = wallLine(room, s)
    ops.push({ id: a.nextId++, kind, roomId: room.id, side: s, offset: r2(center - l.from), width, sill })
    mark(room.id, s, center - width / 2 - 0.05, center + width / 2 + 0.05)
    if (nb) mark(nb.id, OPP[s], center - width / 2 - 0.05, center + width / 2 + 0.05)
  }

  interface Adj { r: Room; s: Side; n: Room; lo: number; hi: number }
  const adj: Adj[] = []
  for (const r of rooms) for (const s of SIDES) for (const x of neighborsOn(rooms, r, s)) if (x.hi - x.lo >= 1.1) adj.push({ r, s, n: x.n, lo: x.lo, hi: x.hi })
  const best = (list: Adj[]) => [...list].sort((p, q) => q.hi - q.lo - (p.hi - p.lo))
  const doorW = (t: RoomType) => (t === 'bath' ? 0.8 : t === 'living' || t === 'hall' ? 1 : 0.9)

  const pairs = new Set<string>()
  const edges: [number, number][] = []
  const pkey = (p: number, q: number) => [p, q].sort((x, y) => x - y).join('|')
  const link = (x: Adj) => {
    if (pairs.has(pkey(x.r.id, x.n.id))) return false
    const w = doorW(x.r.type)
    const c = slot(x.r.id, x.s, x.lo, x.hi, w)
    if (c === null) return false
    push(x.r, x.s, c, w, 'door', 0, x.n)
    pairs.add(pkey(x.r.id, x.n.id)); edges.push([x.r.id, x.n.id])
    return true
  }
  const has = (id: number) => edges.some((e) => e[0] === id || e[1] === id)

    // المطبخ: ملاصق للريسبشن
  //   مقفول = باب | بار = ممر من غير ضلفة + بار رخام بكراسي | أمريكان = الحيطة تتشال بالكامل + جزيرة رخام
  const kitchenLink = (r: Room, mine: Adj[]) => {
    const livs = best(mine.filter((y) => y.n.type === 'living'))
    if (a.kitchen !== 'closed') {
      for (const x of livs) {
        const len = x.hi - x.lo
        if (pairs.has(pkey(x.r.id, x.n.id))) continue
        if (a.kitchen === 'open' && len >= 2.7) {
          const w = Math.min(len - 0.3, 6)
          const c = slot(r.id, x.s, x.lo, x.hi, w)
          if (c !== null) { push(r, x.s, c, w, 'pass', 0, x.n); pairs.add(pkey(x.r.id, x.n.id)); edges.push([r.id, x.n.id]); return true }
        }
        if (a.kitchen === 'bar' && len >= 2.4) {
          const pc = slot(r.id, x.s, x.lo, x.hi, 1, x.lo + 0.65)
          if (pc !== null) {
            push(r, x.s, pc, 1, 'pass', 0, x.n)
            const start = pc + 0.5 + 0.2, end = x.hi - 0.15
            const bw = Math.min(4, end - start - 0.3)
            if (bw >= 0.8) {
              const bc = slot(r.id, x.s, start, end, bw, start + bw / 2)
              if (bc !== null) push(r, x.s, bc, bw, 'pass', 0.95, x.n)
            }
            pairs.add(pkey(x.r.id, x.n.id)); edges.push([r.id, x.n.id])
            return true
          }
        }
      }
    }
    for (const x of livs) if (link(x)) return true
    return false
  }

  // 0) ريسبشن مفتوح: القطع المتجاورة من نوع ريسبشن بتتوصل بفتحة واسعة
  for (const x of adj.filter((y) => y.r.type === 'living' && y.n.type === 'living' && y.r.id < y.n.id)) {
    const w = Math.min(5, x.hi - x.lo - 0.6)
    if (w < 1.2 || pairs.has(pkey(x.r.id, x.n.id))) continue
    const c = slot(x.r.id, x.s, x.lo, x.hi, w)
    if (c === null) continue
    push(x.r, x.s, c, w, 'pass', 0, x.n); pairs.add(pkey(x.r.id, x.n.id)); edges.push([x.r.id, x.n.id])
  }

  // 1) كل غرفة ليها باب: الحمام الملحق لغرفة النوم، والمطبخ للريسبشن، والباقي على ممر مجاور
  for (const r of rooms.filter((x) => x.type !== 'hall')) {
    if (r.type === 'living') continue // الريسبشن والسفرة بيتوصّلوا بفتحات مفتوحة (خطوة 0 و2) مش بأبواب
    const mine = adj.filter((x) => x.r.id === r.id)
    if (r.type === 'kitchen' && kitchenLink(r, mine)) continue
    if (r.ens) {
      const isMaster = (n: Room) => /رئيسية|ماستر/.test(n.name)
      let ok = false
      const beds = best(mine.filter((y) => y.n.type === 'bed')).sort((p, q) => (isMaster(q.n) ? 1 : 0) - (isMaster(p.n) ? 1 : 0))
      for (const x of beds) { if (link(x)) { ok = true; break } }
      if (ok) continue
    }
    let done = false
    for (const x of best(mine.filter((y) => y.n.type === 'hall'))) { if (link(x)) { done = true; break } }
    if (done) continue
    const order: RoomType[] = r.type === 'bath' ? (r.ens ? ['bed', 'living', 'kitchen', 'other'] : ['living', 'hall', 'kitchen', 'other', 'bed']) : ['living', 'kitchen', 'bed', 'other', 'bath']
    const cand = best(mine).sort((p, q) => order.indexOf(p.n.type) - order.indexOf(q.n.type))
    for (const x of cand) if (link(x)) break
  }

    // 2) الصالة بتتفتح على الريسبشن/السفرة بفتحة واسعة من غير باب (مش كأنها أوضة)، وبأي صالة تانية ملاصقة
  const openLink = (x: Adj) => {
    if (pairs.has(pkey(x.r.id, x.n.id))) return false
    const len = x.hi - x.lo
    if (len < 1.4) return link(x)
    const w = clamp(len - 0.3, 1.1, 2.4)
    const c = slot(x.r.id, x.s, x.lo, x.hi, w)
    if (c === null) return link(x)
    push(x.r, x.s, c, w, 'pass', 0, x.n)
    pairs.add(pkey(x.r.id, x.n.id)); edges.push([x.r.id, x.n.id])
    return true
  }
  const livingIds = new Set(rooms.filter((x) => x.type === 'living').map((x) => x.id))
  for (const h of rooms.filter((x) => x.type === 'hall')) {
    let hasLiving = edges.some(([p, q]) => (p === h.id && livingIds.has(q)) || (q === h.id && livingIds.has(p)))
    for (const x of best(adj.filter((y) => y.r.id === h.id && (y.n.type === 'living' || y.n.type === 'hall')))) {
      if (x.n.type === 'living') { if (!hasLiving && openLink(x)) hasLiving = true } else openLink(x)
    }
  }

  // 3) نتأكد إن كل الغرف متوصّلة ببعض
  const reach = () => {
    const seen = new Set<number>()
    if (!rooms.length) return seen
    const start = (rooms.find((x) => x.type === 'hall') ?? rooms[0]).id
    const q = [start]; seen.add(start)
    while (q.length) {
      const u = q.pop() as number
      for (const [p, w] of edges) {
        const v = p === u ? w : w === u ? p : null
        if (v !== null && !seen.has(v)) { seen.add(v); q.push(v) }
      }
    }
    return seen
  }
  for (let guard = 0; guard < rooms.length + 2; guard++) {
    const seen = reach()
    const lost = rooms.filter((x) => !seen.has(x.id))
    if (!lost.length) break
    let fixed = false
    for (const r of lost) {
      for (const x of best(adj.filter((y) => y.r.id === r.id && seen.has(y.n.id)))) { if (link(x)) { fixed = true; break } }
      if (fixed) break
    }
    if (!fixed) break
  }

  // 4) باب الشقة: على ناحية الشارع في الريسبشن (غرفة المدخل) أو الممر
  const front = a.front
  const longest = (list: [number, number][]) => [...list].sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0]
  const cands = rooms
    .filter((r) => r.type === 'living' || r.type === 'hall')
    .map((r) => ({ r, iv: longest(exteriorIntervals(rooms, r, front)) }))
    .filter((x): x is { r: Room; iv: [number, number] } => !!x.iv && x.iv[1] - x.iv[0] >= 1.3)
    .sort((p, q) => (q.r.entry ? 1 : 0) - (p.r.entry ? 1 : 0) || (p.r.type === 'living' ? 0 : 1) - (q.r.type === 'living' ? 0 : 1) || q.iv[1] - q.iv[0] - (p.iv[1] - p.iv[0]))
  let entered = false
  for (const e of cands) {
    const c = slot(e.r.id, front, e.iv[0], e.iv[1], 1, e.iv[0] + (e.iv[1] - e.iv[0]) * 0.72)
    if (c !== null) { push(e.r, front, c, 1, 'door', 0, null); entered = true; break }
  }
  if (!entered) {
    outer: for (const r of rooms.filter((x) => x.type === 'living' || x.type === 'hall')) {
      for (const s of SIDES) {
        const iv = longest(exteriorIntervals(rooms, r, s))
        if (!iv || iv[1] - iv[0] < 1.3) continue
        const c = slot(r.id, s, iv[0], iv[1], 1)
        if (c !== null) { push(r, s, c, 1, 'door', 0, null); break outer }
      }
    }
  }

  // 5) الشبابيك على الحيطان الخارجية (من غير الجانبين لو الشقة ملاصقة لعمارات)
  const blind: Side[] = a.mode === 'template' && a.blind ? (front === 'N' || front === 'S' ? ['E', 'W'] : ['N', 'S']) : []
  const cfg: Record<RoomType, { n: number; w: number; sill: number }> = {
    bed: { n: 1, w: 1.5, sill: 0.9 }, living: { n: 2, w: 1.8, sill: 0.9 }, kitchen: { n: 1, w: 1.2, sill: 1.1 },
    bath: { n: 1, w: 0.6, sill: 1.5 }, other: { n: 1, w: 1.4, sill: 0.9 }, hall: { n: 0, w: 0, sill: 0 },
  }
  for (const r of rooms) {
    const c = cfg[r.type]
    if (!c.n || r.ens) continue
    const ivs: { s: Side; lo: number; hi: number }[] = []
    for (const s of SIDES) {
      if (blind.includes(s)) continue
      for (const [lo, hi] of exteriorIntervals(rooms, r, s)) if (hi - lo >= 1) ivs.push({ s, lo, hi })
    }
    ivs.sort((p, q) => q.hi - q.lo - (p.hi - p.lo))
    let placed = 0
    for (const iv of ivs) {
      if (placed >= c.n) break
      const ww = Math.min(c.w, iv.hi - iv.lo - 0.8, r.type === 'living' ? (iv.hi - iv.lo) * 0.5 : 9)
      if (ww < (r.type === 'bath' ? 0.5 : 0.7)) continue
      const pos = slot(r.id, iv.s, iv.lo, iv.hi, ww)
      if (pos === null) continue
      push(r, iv.s, pos, ww, 'window', c.sill, null)
      placed++
    }
  }
  a.openings = ops
}

// ===== التحقق من الفتحات =====
function spansOn(a: Apartment, room: Room, side: Side, ignoreId?: number): [number, number][] {
  const w = wallLine(room, side)
  return resolveOpenings(room, a.rooms, a.openings.filter((o) => o.id !== ignoreId))
    .filter((x) => x.side === side)
    .map((x) => {
      const cc = (w.from + w.to) / 2 + x.c
      return [cc - x.width / 2 - 0.05, cc + x.width / 2 + 0.05] as [number, number]
    })
}

function openingError(a: Apartment, o: Opening, checkClash = true): string | null {
  const r = a.rooms.find((x) => x.id === o.roomId)
  if (!r) return 'الغرفة مش موجودة'
  const l = wallLine(r, o.side), len = l.to - l.from
  const maxW = o.kind === 'pass' ? 8 : 3
  if (o.width < 0.4 || o.width > maxW) return `العرض لازم يكون بين 0.4 و${maxW} متر`
  if (o.offset - o.width / 2 < 0.1 - EPS || o.offset + o.width / 2 > len - 0.1 + EPS) {
    return `الفتحة خارج الحيطة. طول الحيطة ${len.toFixed(2)} م، والفتحة لازم تبعد عن الأركان 10 سم على الأقل`
  }
  const c = l.from + o.offset, h = o.width / 2
  const ext = exteriorIntervals(a.rooms, r, o.side).some(([lo, hi]) => c - h >= lo - EPS && c + h <= hi + EPS)
  const nb = o.kind !== 'window' ? neighborOf(r, o, a.rooms) : null
  if (o.kind === 'window') {
    if (!ext) return 'الشباك لازم يكون كله على جزء خارجي من الحيطة (مش ملاصق لغرفة تانية)'
    if (o.sill < 0 || o.sill > 1.8 || 2.1 - o.sill < 0.3) return 'ارتفاع الجلسة لازم يكون بين 0 و1.8 متر'
  } else {
    if (!ext && !nb) return 'الفتحة لازم تكون كلها على حيطة مشتركة مع غرفة واحدة، أو على حيطة خارجية'
    if (o.kind === 'pass' && (o.sill < 0 || o.sill > 1.2)) return 'ارتفاع البار لازم يكون بين 0 و1.2 متر'
  }
  if (checkClash) {
    const clash = (room: Room, side: Side) => spansOn(a, room, side, o.id).some(([a0, a1]) => c + h > a0 && c - h < a1)
    if (clash(r, o.side) || (nb && clash(nb, OPP[o.side]))) return 'الفتحة دي بتتداخل مع فتحة تانية على نفس الحيطة'
  }
  return null
}

// بيشيل الفتحات اللي مبقتش مناسبة بعد تغيير الأبعاد أو الأماكن، وبيرجّع عددها
function pruneColumns(a: Apartment) {
  a.columns = a.columns.filter((c) => {
    const r = a.rooms.find((x) => x.id === c.roomId)
    if (!r) return false
    const len = sideLen(r, c.side)
    return c.offset - c.w / 2 >= 0.02 && c.offset + c.w / 2 <= len - 0.02
  })
}

// بيشيل الفتحات اللي مبقتش مناسبة بعد تغيير الأبعاد أو الأماكن، وبيرجّع عددها (وبيظبط الأعمدة والفرش)
export function pruneOpenings(a: Apartment): number {
  const before = a.openings.length
  a.openings = a.openings.filter((o) => openingError(a, o, false) === null)
  pruneColumns(a)
  fitFurniture(a)
  return before - a.openings.length
}
const pruneMsg = (n: number) => (n ? `اتشال ${n} فتحة (باب أو شباك) لأنها مبقتش مناسبة بعد التغيير. تقدر تضيف غيرها من الخطوة ٣.` : null)

export function addDefaultOpening(a: Apartment, roomId: number, kind: 'door' | 'window'): string | null {
  const r = a.rooms.find((x) => x.id === roomId)
  if (!r) return 'اختار غرفة الأول'
  const width = kind === 'door' ? 0.9 : 1.4, sill = kind === 'door' ? 0 : 0.9
  for (const s of SIDES) {
    const l = wallLine(r, s)
    const ivs: [number, number][] = kind === 'window'
      ? exteriorIntervals(a.rooms, r, s)
      : [...neighborsOn(a.rooms, r, s).map((x) => [x.lo, x.hi] as [number, number]), ...exteriorIntervals(a.rooms, r, s)]
    for (const [lo, hi] of ivs) {
      const c = findSlot(spansOn(a, r, s), lo, hi, width)
      if (c === null) continue
      const o: Opening = { id: a.nextId, kind, roomId, side: s, offset: r2(c - l.from), width, sill }
      if (openingError(a, o) === null) { a.nextId++; a.openings.push(o); return null }
    }
  }
  return kind === 'window' ? 'مفيش جزء خارجي مناسب على حيطان الغرفة دي للشباك' : 'مفيش مكان مناسب لباب على حيطان الغرفة دي'
}

export function updateOpening(a: Apartment, id: number, patch: Partial<Pick<Opening, 'side' | 'offset' | 'width' | 'sill'>>): string | null {
  const o = a.openings.find((x) => x.id === id)
  if (!o) return null
  const r = a.rooms.find((x) => x.id === o.roomId)
  if (!r) return null
  const next: Opening = { ...o, ...patch }
  if (patch.side && patch.offset === undefined) next.offset = sideLen(r, next.side) / 2
  const e = openingError(a, next)
  if (e) return e
  Object.assign(o, next)
  return null
}

export function removeOpening(a: Apartment, id: number) { a.openings = a.openings.filter((x) => x.id !== id) }

// ===== النماذج الجاهزة =====
export function setMode(a: Apartment, mode: Mode) {
  a.mode = mode
  a.finish = {}
  regenerate(a)
  return null
}

function pickTemplate(a: Apartment, id: string) {
  const t = tplById(id)
  a.tpl = t.id; a.ratio = t.ratio; a.kitchen = t.kitchen; a.blind = t.blind; a.finish = {}
  return t
}

export function setTemplate(a: Apartment, id: string) {
  const t = pickTemplate(a, id)
  if (a.area < t.min * 0.9 || a.area > t.max * 1.1) a.area = t.nominal
  regenerate(a)
  return null
}

// تغيير المساحة: لو خرجت من مدى النموذج بنختار أنسب نموذج تلقائي
export function setArea(a: Apartment, v: number) {
  a.area = clamp(v, 50, 420)
  const t = tplById(a.tpl)
  if (a.area < t.min * 0.92 || a.area > t.max * 1.08) {
    const bestT = suggest(a.area, t.beds)[0]
    if (bestT.id !== a.tpl) pickTemplate(a, bestT.id)
  }
  regenerate(a)
  return null
}

export function setRatio(a: Apartment, v: number) { const t = tplById(a.tpl); a.ratio = clamp(v, t.rmin, t.rmax); regenerate(a); return null }
export function setKitchen(a: Apartment, k: KitchenMode) { a.kitchen = k; autoOpenings(a); return null }
export function setBlind(a: Apartment, b: boolean) { a.blind = b; autoOpenings(a); return null }

// ===== التوزيع المخصص =====
export function setFootprint(a: Apartment, p: Partial<Pick<Apartment, 'shape' | 'width' | 'length' | 'notchW' | 'notchD' | 'mirror' | 'front'>>) {
  Object.assign(a, p)
  const u = a.shape === 'U', l = a.shape === 'L'
  a.width = clamp(a.width, u ? 10 : l ? 7 : 4, 40)
  a.length = clamp(a.length, u || l ? 8 : 4, 40)
  a.notchW = clamp(a.notchW, 2, 40)
  a.notchD = clamp(a.notchD, 2, 40)
  regenerate(a)
  return null
}

export function setHeight(a: Apartment, h: number) { a.height = clamp(h, 2.4, 4) }

export function addWish(a: Apartment, type: RoomType) {
  const n = a.wishes.filter((w) => w.type === type).length
  const [w, d] = DEFAULT_SIZE[type]
  a.wishes.push({ id: a.nextId++, type, name: TYPE_NAMES[type] + (n ? ' ' + (n + 1) : ''), w, d })
  regenerate(a)
}

export function removeWish(a: Apartment, id: number): string | null {
  if (a.wishes.length <= 1) return 'لازم يفضل في الشقة غرفة واحدة على الأقل'
  a.wishes = a.wishes.filter((w) => w.id !== id)
  delete a.finish[id]
  regenerate(a)
  return null
}

export function updateWish(a: Apartment, id: number, p: Partial<Pick<Wish, 'name' | 'type' | 'w' | 'd'>>) {
  const w = a.wishes.find((x) => x.id === id)
  if (!w) return null
  if (p.name !== undefined) w.name = p.name
  if (p.type !== undefined) w.type = p.type
  if (p.w !== undefined) w.w = clamp(p.w, 1, 15)
  if (p.d !== undefined) w.d = clamp(p.d, 1, 15)
  const onlyName = p.type === undefined && p.w === undefined && p.d === undefined
  if (onlyName) { const r = a.rooms.find((x) => x.id === id); if (r) r.name = w.name }
  else regenerate(a)
  return null
}

// ===== تعديل الغرف الموزّعة (الخطوة ٢) =====
const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)
const clashWith = (rooms: Room[], c: Room): Room | null =>
  rooms.find((n) => n.id !== c.id && overlap1(n.x, n.x + n.w, c.x, c.x + c.w) > 0.03 && overlap1(n.y, n.y + n.d, c.y, c.y + c.d) > 0.03) ?? null

export function updateRoomInfo(a: Apartment, id: number, p: { name?: string; type?: RoomType }) {
  const r = a.rooms.find((x) => x.id === id)
  if (!r) return
  if (p.name !== undefined) r.name = p.name
  if (p.type !== undefined) r.type = p.type
  const w = a.wishes.find((x) => x.id === id)
  if (a.mode === 'custom' && w) { if (p.name !== undefined) w.name = p.name; if (p.type !== undefined) w.type = p.type }
}

/*================================*/

const MIN_SIDE = 1

// بيحرّك خط الحيطة كله (كل الغرف اللي حيطانها على نفس الخط ومتصلة ببعض)، فمفيش فراغات ولا تداخل والمساحة ثابتة.
// delta موجب = الغرفة بتكبر ناحية الحيطة دي. الحيطة الخارجية مينفعش تتحرك (هتغيّر شكل الشقة).
function wallMove(rooms: Room[], id: number, side: Side, delta: number): { rooms?: Room[]; err?: string } {
  const r = rooms.find((x) => x.id === id)
  if (!r) return { err: 'الغرفة مش موجودة' }
  if (Math.abs(delta) < 1e-9) return { rooms }
  const vertical = side === 'E' || side === 'W'
  const fixed = vertical ? (side === 'E' ? r.x + r.w : r.x) : side === 'S' ? r.y + r.d : r.y
  const shift = side === 'E' || side === 'S' ? delta : -delta // حركة الخط الفعلية في اتجاه +x أو +y
  const edgeB = (n: Room) => (vertical ? n.x + n.w : n.y + n.d) // الحافة اللي قبل الخط
  const edgeA = (n: Room) => (vertical ? n.x : n.y)             // الحافة اللي بعد الخط
  const span = (n: Room): [number, number] => (vertical ? [n.y, n.y + n.d] : [n.x, n.x + n.w])
  const before = rooms.filter((n) => Math.abs(edgeB(n) - fixed) < EPS)
  const after = rooms.filter((n) => Math.abs(edgeA(n) - fixed) < EPS)
  const chain = new Set<number>([r.id]) // السلسلة المتصلة اللي بتبدأ من الغرفة المختارة
  let [lo, hi] = span(r)
  for (let grown = true; grown;) {
    grown = false
    for (const n of [...before, ...after]) {
      if (chain.has(n.id)) continue
      const [s0, s1] = span(n)
      if (overlap1(lo, hi, s0, s1) > EPS) { chain.add(n.id); lo = Math.min(lo, s0); hi = Math.max(hi, s1); grown = true }
    }
  }
  const cover = (g: Room[]) => g.filter((n) => chain.has(n.id)).reduce((s, n) => s + (span(n)[1] - span(n)[0]), 0)
  if (cover(before) < hi - lo - 0.03 || cover(after) < hi - lo - 0.03) {
    return { err: 'الحيطة دي (أو جزء منها) على حدود الشقة من برّه، مينفعش تتحرك. حرّك الحيطة اللي قصادها.' }
  }
  const next = rooms.map((n) => ({ ...n }))
  for (const n of next) {
    if (!chain.has(n.id)) continue
    if (before.some((b) => b.id === n.id)) { if (vertical) n.w = r2(n.w + shift); else n.d = r2(n.d + shift) }
    else if (vertical) { n.x = r2(n.x + shift); n.w = r2(n.w - shift) } else { n.y = r2(n.y + shift); n.d = r2(n.d - shift) }
  }
  const tiny = next.find((n) => chain.has(n.id) && (n.w < MIN_SIDE || n.d < MIN_SIDE))
  if (tiny) return { err: `${tiny.name} هتبقى أصغر من متر.` }
  return { rooms: next }
}

// تغيير عرض/طول غرفة: بنحرّك حيطة من الاتنين (الأولى، وإلا اللي قصادها لو الأولى خارجية)
function resizeCore(rooms: Room[], id: number, w: number, d: number): { rooms?: Room[]; err?: string } {
  const r = rooms.find((x) => x.id === id)
  if (!r) return { err: 'الغرفة مش موجودة' }
  let cur = rooms
  const grow = (dim: number, sides: [Side, Side]) => {
    if (Math.abs(dim) < 1e-6) return null
    let e = ''
    for (const s of sides) { const m = wallMove(cur, id, s, dim); if (m.rooms) { cur = m.rooms; return null } e = m.err ?? '' }
    return e
  }
  const e1 = grow(sn(clamp(w, MIN_SIDE, 30)) - r.w, ['E', 'W'])
  if (e1) return { err: e1 }
  const e2 = grow(sn(clamp(d, MIN_SIDE, 30)) - r.d, ['S', 'N'])
  if (e2) return { err: e2 }
  return { rooms: cur }
}

// تحريك حيطة واحدة من الغرفة المختارة
export function moveWall(a: Apartment, id: number, side: Side, delta: number): string | null {
  const m = wallMove(a.rooms, id, side, delta)
  if (!m.rooms) return m.err ?? null
  a.rooms = m.rooms
  return pruneMsg(pruneOpenings(a))
}

// تغيير الأبعاد. absorb = الغرف المجاورة بتتعدّل تلقائي من غير فراغات
export function resizeRoom(a: Apartment, id: number, w: number, d: number, absorb: boolean): string | null {
  const r = a.rooms.find((x) => x.id === id)
  if (!r) return null
  if (absorb) {
    const m = resizeCore(a.rooms, id, w, d)
    if (!m.rooms) return m.err ?? null
    a.rooms = m.rooms
    return pruneMsg(pruneOpenings(a))
  }
  const next = a.rooms.map((x) => ({ ...x }))
  const nr = next.find((x) => x.id === id) as Room
  nr.w = r2(sn(clamp(w, MIN_SIDE, 30))); nr.d = r2(sn(clamp(d, MIN_SIDE, 30)))
  for (const n of next) {
    const hit = clashWith(next, n)
    if (hit) return `الغرفة هتتداخل مع ${hit.name}. فعّل "عدّل الغرف المجاورة" أو صغّر الجارة الأول.`
  }
  a.rooms = next
  return pruneMsg(pruneOpenings(a))
}



function relocate(a: Apartment, r: Room, x: number, y: number): string | null {
  const cand = { ...r, x: r2(x), y: r2(y) }
  const hit = clashWith(a.rooms, cand)
  if (hit) return `مينفعش، الغرفة هتتداخل مع ${hit.name}.`
  r.x = cand.x; r.y = cand.y
  return pruneMsg(pruneOpenings(a))
}

export function moveRoom(a: Apartment, id: number, dx: number, dy: number): string | null {
  const r = a.rooms.find((x) => x.id === id)
  return r ? relocate(a, r, r.x + dx, r.y + dy) : null
}

export function placeBeside(a: Apartment, id: number, targetId: number, where: Side, align: 'start' | 'center' | 'end'): string | null {
  const r = a.rooms.find((x) => x.id === id), t = a.rooms.find((x) => x.id === targetId)
  if (!r || !t || r.id === t.id) return 'اختار غرفة تانية'
  const al = (t0: number, tl: number, rl: number) => (align === 'start' ? t0 : align === 'center' ? t0 + (tl - rl) / 2 : t0 + tl - rl)
  let x = r.x, y = r.y
  if (where === 'E') { x = t.x + t.w; y = al(t.y, t.d, r.d) }
  else if (where === 'W') { x = t.x - r.w; y = al(t.y, t.d, r.d) }
  else if (where === 'S') { y = t.y + t.d; x = al(t.x, t.w, r.w) }
  else { y = t.y - r.d; x = al(t.x, t.w, r.w) }
  return relocate(a, r, sn(x), sn(y))
}

export function swapRooms(a: Apartment, id1: number, id2: number): string | null {
  const p = a.rooms.find((x) => x.id === id1), q = a.rooms.find((x) => x.id === id2)
  if (!p || !q) return null
  const t = { type: p.type, name: p.name }
  p.type = q.type; p.name = q.name
  q.type = t.type; q.name = t.name
  const f1 = a.finish[id1], f2 = a.finish[id2]
  delete a.finish[id1]; delete a.finish[id2]
  if (f1) a.finish[id2] = f1
  if (f2) a.finish[id1] = f2
  if (a.mode === 'custom') {
    for (const w of a.wishes) {
      if (w.id === id1) { w.type = p.type; w.name = p.name }
      if (w.id === id2) { w.type = q.type; w.name = q.name }
    }
  }
  return null
}

export function removeRoom(a: Apartment, id: number): string | null {
  if (a.rooms.length <= 1) return 'لازم يفضل في الشقة غرفة واحدة على الأقل'
  a.rooms = a.rooms.filter((x) => x.id !== id)
  if (a.mode === 'custom') a.wishes = a.wishes.filter((x) => x.id !== id)
  delete a.finish[id]
  a.openings = a.openings.filter((o) => o.roomId !== id)
  return pruneMsg(pruneOpenings(a))
}

export function resetFinish(a: Apartment) { a.finish = {} }
export function setFinish(
  a: Apartment,
  r: { id: number; wall: WallConfig; floor: FloorConfig; ceiling: CeilingConfig },
  patch: Partial<{ wall: WallConfig; floor: FloorConfig; ceiling: CeilingConfig }>,
) {
  a.finish[r.id] = { wall: r.wall, floor: r.floor, ceiling: r.ceiling, ...patch }
}

// ===== تنبيهات التصميم =====
export interface Report { fit: string | null; narrow: string[]; noWindow: string[]; isolated: string[] }

export function analyze(a: Apartment): Report {
  let fit: string | null = null
  if (a.mode === 'custom') {
    const wished = a.wishes.reduce((s, w) => s + w.w * w.d, 0)
    const actual = a.rooms.filter((r) => r.id > 0).reduce((s, r) => s + r.w * r.d, 0)
    if (wished > 0) {
      const k = actual / wished
      if (k < 0.92) fit = `الشكل ده مساحته أقل من المطلوب، فالغرف اتصغّرت بنسبة ${Math.round((1 - k) * 100)}% تقريباً. كبّر الشقة أو قلل مساحات الغرف.`
      else if (k > 1.12) fit = `الشكل ده أكبر من المطلوب، فالغرف اتكبّرت بنسبة ${Math.round((k - 1) * 100)}% تقريباً.`
    }
  }
  const narrow = a.rooms.filter((r) => r.type !== 'hall' && Math.min(r.w, r.d) < MIN_W[r.type] - 0.05).map((r) => `${r.name} ضيقة (${r.w.toFixed(1)}×${r.d.toFixed(1)} م)`)
  const noWindow = a.rooms
    .filter((r) => r.type !== 'hall' && r.type !== 'bath' && r.type !== 'other' && !a.openings.some((o) => o.kind === 'window' && o.roomId === r.id))
    .map((r) => `${r.name} من غير شباك`)

  const edges: [number, number][] = []
  for (const r of a.rooms) {
    for (const x of resolveOpenings(r, a.rooms, a.openings)) {
      if ((x.kind === 'door' || (x.kind === 'pass' && x.sill < 0.01)) && x.to !== null) edges.push([r.id, x.to])
    }
  }
  const seen = new Set<number>()
  if (a.rooms.length) {
    const start = (a.rooms.find((x) => x.type === 'hall') ?? a.rooms[0]).id
    const q = [start]; seen.add(start)
    while (q.length) {
      const u = q.pop() as number
      for (const [p, w] of edges) {
        const v = p === u ? w : w === u ? p : null
        if (v !== null && !seen.has(v)) { seen.add(v); q.push(v) }
      }
    }
  }
  const isolated = a.rooms.filter((r) => !seen.has(r.id)).map((r) => `مفيش باب بيوصّل لـ${r.name}`)
  return { fit, narrow, noWindow, isolated }
}

// ===== الشقة المبدئية =====
export function defaultApartment(): Apartment {
  const a: Apartment = {
    mode: 'template', area: 120, ratio: 1.3, tpl: 'T120', kitchen: 'bar', blind: false,
    shape: 'rect', width: 14, length: 10, notchW: 4, notchD: 4, mirror: false, front: 'S', height: 2.8,
    wishes: [
      { id: 1, type: 'bed', name: 'غرفة نوم رئيسية', w: 4, d: 4 },
      { id: 2, type: 'bed', name: 'غرفة نوم 2', w: 3.5, d: 3.5 },
      { id: 3, type: 'bed', name: 'غرفة نوم 3', w: 3.5, d: 3.5 },
      { id: 4, type: 'bath', name: 'حمام 1', w: 2, d: 2.5 },
      { id: 5, type: 'bath', name: 'حمام 2', w: 2, d: 2.5 },
      { id: 6, type: 'living', name: 'ريسبشن', w: 5.5, d: 4.5 },
      { id: 7, type: 'kitchen', name: 'مطبخ', w: 3.5, d: 3 },
    ],
    rooms: [], openings: [], finish: {}, nextId: 100,
    columns: [], furniture: {}, furnOn: false, fabric: '#CDBFA6', wood: '#A9784F', openFin: {}, odef: {},
    wallExt: RULES.defaultWallExt, wallInt: RULES.defaultWallInt,
  }
  regenerate(a)
  return a
}