import { TYPE_NAMES, defaultApartment, pruneOpenings } from './apartment'
import type { Apartment, Column, Opening, Room, RoomType, Side, Wish } from './apartment'
import { ALL_FLOORS, LAYOUTS, allowedLayouts, defaultLayout } from './data/catalog'
import type { FloorConfig } from './data/catalog'
import { CEILING_TYPES, allowedMaterials } from './data/ceilingCatalog'
import type { CeilingConfig } from './data/ceilingCatalog'
import { presetFor } from './data/materials'
import { BUDGETS, STYLES } from './data/options'
import type { BudgetId, StyleId } from './data/options'
import { FINISHES, WALL_MATERIALS } from './data/wallCatalog'
import type { WallConfig } from './data/wallCatalog'
import { FURN } from './furniture'
import type { FurnItem } from './furniture'
import { OPEN } from './openings'
import { session } from './state'
import { TEMPLATES } from './templates'

export const FORMAT = 'bayti-project'
export const VERSION = 1

export interface Needs { floors: { id: string; name: string }[]; furniture: { id: string; name: string }[]; openings: { id: string; name: string }[] }
export interface ProjectFile {
  format: string; version: number; name: string; savedAt: string
  data: { style: StyleId; budget: BudgetId; mode: 'build' | 'finish' | 'furnish'; apt: Apartment }
  needs?: Needs
}
export type ParseResult = { ok: true; file: ProjectFile; warnings: string[] } | { ok: false; error: string }

// رسالة بتظهر في صفحة مشاريعي بعد فتح أو إنشاء مشروع (لأن الصفحة بتتبني من جديد)
export const notice = { text: '', warnings: [] as string[] }

const SIDES: Side[] = ['N', 'E', 'S', 'W']
const TYPES: RoomType[] = ['bed', 'bath', 'living', 'kitchen', 'hall', 'other']
const isObj = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const fin = (v: any): v is number => typeof v === 'number' && Number.isFinite(v)
const int = (v: any): v is number => fin(v) && Number.isInteger(v)
const num = (v: any, d: number, lo: number, hi: number) => (fin(v) ? Math.min(hi, Math.max(lo, v)) : d)
const hex = (v: any, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d)
const str = (v: any, d: string, max = 80) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : d)
const oneOf = <T,>(v: any, list: readonly T[], d: T): T => ((list as readonly any[]).includes(v) ? (v as T) : d)
const r2 = (v: number) => Math.round(v * 100) / 100

// ===== الأحداث: لما مشروع يتفتح الصفحات بتتبني من جديد =====
const bus = new EventTarget()
export function bumpProject() { session.rev = (session.rev || 0) + 1; bus.dispatchEvent(new Event('change')) }
export function onProject(cb: () => void) { bus.addEventListener('change', cb); return () => bus.removeEventListener('change', cb) }

// ===== اللقطة =====
function collectNeeds(a: Apartment): Needs {
  const fl = new Map<string, string>(), fu = new Map<string, string>(), op = new Map<string, string>()
  for (const f of Object.values(a.finish ?? {})) { const m = ALL_FLOORS.find((x) => x.id === f?.floor?.material); if (m?.custom) fl.set(m.id, m.name) }
  for (const list of Object.values(a.furniture ?? {})) for (const it of list) { const d = FURN[it.kind]; if (d?.custom) fu.set(it.kind, d.name) }
  const ids = [...Object.values(a.openFin ?? {}).map((v) => v.style), ...Object.values(a.odef ?? {})]
  for (const id of ids) { const d = id ? OPEN[id] : undefined; if (d?.custom) op.set(id as string, d.name) }
  const arr = (m: Map<string, string>) => [...m].map(([id, name]) => ({ id, name }))
  return { floors: arr(fl), furniture: arr(fu), openings: arr(op) }
}

export function snapshot(): ProjectFile {
  const apt: Apartment = JSON.parse(JSON.stringify(session.apt))
  return {
    format: FORMAT, version: VERSION, name: session.name, savedAt: new Date().toISOString(),
    data: { style: session.style, budget: session.budget, mode: session.mode, apt },
    needs: collectNeeds(apt),
  }
}

// ===== التنظيف: أي ملف بيتفحص ويتصلّح قبل ما يدخل الموقع =====
function cleanWall(w: any, p: WallConfig): WallConfig {
  const o = isObj(w) ? w : {}, acc = isObj(o.accent) ? o.accent : {}, dd = isObj(o.dado) ? o.dado : {}, sk = isObj(o.skirt) ? o.skirt : {}
  const mat = (id: any, d: string) => (typeof id === 'string' && (id === '' || WALL_MATERIALS.some((m) => m.id === id)) ? id : d)
  return {
    color: hex(o.color, p.color), finish: oneOf(o.finish, Object.keys(FINISHES) as any[], p.finish),
    accent: { side: oneOf<Side | null>(acc.side, [...SIDES, null], null), material: mat(acc.material, 'wood-slats') || 'wood-slats', color: hex(acc.color, p.accent.color) },
    dado: { on: typeof dd.on === 'boolean' ? dd.on : p.dado.on, height: num(dd.height, p.dado.height, 0.3, 2.4), material: mat(dd.material, ''), color: hex(dd.color, p.dado.color) },
    skirt: { height: num(sk.height, p.skirt.height, 0.03, 0.4), color: hex(sk.color, p.skirt.color) },
  }
}
function cleanFloor(f: any, p: FloorConfig, missing: Set<string>): FloorConfig {
  const o = isObj(f) ? f : {}
  const m = ALL_FLOORS.find((x) => x.id === o.material)
  if (!m) { if (typeof o.material === 'string') missing.add(o.material); return { ...p } }
  const lay = oneOf(o.layout, Object.keys(LAYOUTS) as any[], p.layout)
  return { material: m.id, color: hex(o.color, m.base), layout: allowedLayouts(m).includes(lay) ? lay : defaultLayout(m), groutColor: hex(o.groutColor, p.groutColor), groutMm: num(o.groutMm, p.groutMm, 0, 20) }
}
function cleanCeiling(c: any, p: CeilingConfig): CeilingConfig {
  const o = isObj(c) ? c : {}
  const type = oneOf(o.type, CEILING_TYPES.map((t) => t.id), p.type)
  const allowed = allowedMaterials(type)
  return {
    type, material: oneOf(o.material, allowed, allowed[0]), color: hex(o.color, p.color),
    led: oneOf(o.led, ['off', 'warm', 'neutral', 'cool'] as const, p.led), spots: oneOf(o.spots, ['none', 'grid', 'perimeter'] as const, p.spots),
    chandelier: typeof o.chandelier === 'boolean' ? o.chandelier : p.chandelier, cornice: oneOf(o.cornice, ['none', 'simple', 'classic'] as const, p.cornice),
  }
}

function cleanApartment(src: any, style: StyleId, needsRaw: any, warnings: string[]): { apt: Apartment } | { error: string } {
  const a = defaultApartment()
  a.mode = oneOf(src.mode, ['template', 'custom'] as const, 'template')
  a.tpl = TEMPLATES.some((t) => t.id === src.tpl) ? src.tpl : a.tpl
  a.area = num(src.area, a.area, 50, 420); a.ratio = num(src.ratio, a.ratio, 0.5, 2.5)
  a.kitchen = oneOf(src.kitchen, ['closed', 'bar', 'open'] as const, a.kitchen)
  a.blind = typeof src.blind === 'boolean' ? src.blind : a.blind
  a.shape = oneOf(src.shape, ['rect', 'square', 'L', 'U'] as const, 'rect')
  a.width = num(src.width, a.width, 2, 80); a.length = num(src.length, a.length, 2, 80)
  a.notchW = num(src.notchW, a.notchW, 1, 80); a.notchD = num(src.notchD, a.notchD, 1, 80)
  a.mirror = src.mirror === true
  a.front = oneOf(src.front, SIDES, 'S')
  a.height = num(src.height, 2.8, 2.4, 4)
  a.wallExt = num(src.wallExt, a.wallExt, 0.1, 0.6); a.wallInt = num(src.wallInt, a.wallInt, 0.07, 0.3)
  a.furnOn = src.furnOn === true
  a.fabric = hex(src.fabric, a.fabric); a.wood = hex(src.wood, a.wood)

  // الغرف
  const rooms: Room[] = [], rid = new Set<number>()
  let badRooms = 0
  for (const r of Array.isArray(src.rooms) ? src.rooms.slice(0, 80) : []) {
    const valid = isObj(r) && int(r.id) && !rid.has(r.id) && (TYPES as string[]).includes(r.type) && [r.x, r.y, r.w, r.d].every(fin)
      && r.w >= 0.3 && r.d >= 0.3 && r.w <= 80 && r.d <= 80 && Math.abs(r.x) <= 500 && Math.abs(r.y) <= 500
    if (!valid) { badRooms++; continue }
    rid.add(r.id)
rooms.push({
  id: r.id, type: r.type, name: str(r.name, TYPE_NAMES[r.type as RoomType]),
  x: r.x, y: r.y, w: r.w, d: r.d,
  ...(r.entry === true ? { entry: true } : {}),
  ...(r.ens === true ? { ens: true } : {}),
})
  }
  if (!rooms.length) return { error: 'الملف مفيهوش غرف سليمة' }
  if (badRooms) warnings.push(`اتشالت ${badRooms} غرفة بياناتها غير سليمة.`)
  a.rooms = rooms

  // الأرقام اللي بتتولد منها أرقام جديدة (لازم تفضل فريدة)
  const used = new Set<number>(rid)
  const fresh = (id: any) => int(id) && !used.has(id)

  // الفتحات
  const openings: Opening[] = []
  let badOps = 0
  for (const o of Array.isArray(src.openings) ? src.openings.slice(0, 400) : []) {
    const valid = isObj(o) && int(o.id) && !used.has(o.id) && ['door', 'window', 'pass'].includes(o.kind) && rid.has(o.roomId)
      && (SIDES as string[]).includes(o.side) && [o.offset, o.width, o.sill].every(fin) && o.width >= 0.3 && o.width <= 8 && o.offset >= 0 && o.offset <= 80 && o.sill >= 0 && o.sill <= 2.5
    if (!valid) { badOps++; continue }
    used.add(o.id)
openings.push({
  id: o.id, kind: o.kind, roomId: o.roomId, side: o.side,
  offset: o.offset, width: o.width, sill: o.sill,
})
  }
  a.openings = openings

  // الأعمدة
  const columns: Column[] = []
  for (const c of Array.isArray(src.columns) ? src.columns.slice(0, 100) : []) {
    const valid = isObj(c) && fresh(c.id) && rid.has(c.roomId) && (SIDES as string[]).includes(c.side) && [c.offset, c.w, c.d].every(fin)
      && c.w >= 0.1 && c.w <= 1.5 && c.d >= 0.02 && c.d <= 1 && c.offset >= 0 && c.offset <= 80
    if (!valid) continue
    used.add(c.id)
columns.push({
  id: c.id, roomId: c.roomId, side: c.side,
  offset: c.offset, w: c.w, d: c.d,
})
  }
  a.columns = columns

  // الغرف المطلوبة (الشكل المخصص)
  const wishes: Wish[] = []
  for (const w of Array.isArray(src.wishes) ? src.wishes.slice(0, 60) : []) {
    const valid = isObj(w) && fresh(w.id) && (TYPES as string[]).includes(w.type) && fin(w.w) && fin(w.d)
    if (!valid) continue
    used.add(w.id)
    wishes.push({ id: w.id, type: w.type, name: str(w.name, TYPE_NAMES[w.type as RoomType]), w: num(w.w, 3, 1, 15), d: num(w.d, 3, 1, 15) })
  }
  if (wishes.length) a.wishes = wishes

  // الفرش (القطع المجهولة بتتشال، وبنفتكر أسماءها للتحذير)
  const furniture: Record<number, FurnItem[]> = {}
  const missingFurn = new Set<string>()
  let droppedFurn = 0
  if (isObj(src.furniture)) {
    for (const [k, list] of Object.entries(src.furniture)) {
      const roomId = Number(k)
      if (!rid.has(roomId) || !Array.isArray(list)) continue
      const items: FurnItem[] = []
      for (const it of list.slice(0, 200)) {
        if (!isObj(it) || !fresh(it.id) || typeof it.kind !== 'string') { droppedFurn++; continue }
        if (!FURN[it.kind]) { missingFurn.add(it.kind); droppedFurn++; continue }
        if (![it.x, it.z, it.rot, it.y].every(fin) || Math.abs(it.x) > 100 || Math.abs(it.z) > 100 || it.y < 0 || it.y > 5) { droppedFurn++; continue }
        used.add(it.id)
items.push({
  id: it.id, kind: it.kind,
  x: it.x, z: it.z, rot: it.rot, y: it.y,
  ...(int(it.host) ? { host: it.host } : {}),
  ...(typeof it.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(it.color) ? { color: it.color } : {}),
})
      }
      furniture[roomId] = items
    }
  }
  a.furniture = furniture

  // التشطيب لكل غرفة (بيتدمج فوق التشطيب الافتراضي للستايل)
  const missingFloors = new Set<string>()
  a.finish = {}
  if (isObj(src.finish)) {
    for (const room of rooms) {
      const f = src.finish[room.id]
      if (!isObj(f)) continue
      const p = presetFor(style, room.type)
      a.finish[room.id] = { wall: cleanWall(f.wall, p.wall), floor: cleanFloor(f.floor, p.floor, missingFloors), ceiling: cleanCeiling(f.ceiling, p.ceiling) }
    }
  }

  // أنواع الأبواب والشبابيك
  const openIds = new Set(openings.map((o) => o.id)), missingOpen = new Set<string>()
  a.openFin = {}; a.odef = {}
  if (isObj(src.openFin)) {
    for (const [k, v] of Object.entries(src.openFin)) {
      const id = Number(k)
      if (!openIds.has(id) || !isObj(v)) continue
      const e: { style?: string; color?: string } = {}
      if (typeof v.style === 'string') { if (OPEN[v.style]) e.style = v.style; else missingOpen.add(v.style) }
      if (typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color)) e.color = v.color
      a.openFin[id] = e
    }
  }
  if (isObj(src.odef)) {
    for (const [k, v] of Object.entries(src.odef)) {
      if (typeof v !== 'string') continue
      if (OPEN[v]) a.odef[k] = v; else missingOpen.add(v)
    }
  }

  let maxId = 0
  used.forEach((v) => { if (v > maxId) maxId = v })
  a.nextId = Math.max(100, maxId + 1, int(src.nextId) ? src.nextId : 0)

  // مراجعة هندسية: بتشيل الفتحات اللي مبقتش مناسبة، والأعمدة والفرش اللي خارج الغرف
  const countOps = a.openings.length, countFurn = Object.values(a.furniture).reduce((s, l) => s + l.length, 0), countCols = a.columns.length
  pruneOpenings(a)
  const lostOps = countOps - a.openings.length, lostFurn = countFurn - Object.values(a.furniture).reduce((s, l) => s + l.length, 0), lostCols = countCols - a.columns.length

  if (badOps + lostOps) warnings.push(`اتشال ${badOps + lostOps} باب أو شباك لأنهم مش مناسبين لأبعاد الغرف.`)
  if (lostCols) warnings.push(`اتشال ${lostCols} عمود لأنه خارج حيطة غرفته.`)
  const nameOf = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((x) => x.id === id)?.name ?? id
  const nr = isObj(needsRaw) ? needsRaw : {}
  if (missingFloors.size) warnings.push(`خامات أرضيات مضافة من الداشبورد مش موجودة على الجهاز ده (${[...missingFloors].map((i) => nameOf(nr.floors, i)).join('، ')}). استُبدلت بالافتراضي.`)
  if (missingFurn.size) warnings.push(`قطع فرش مضافة من الداشبورد مش موجودة على الجهاز ده (${[...missingFurn].map((i) => nameOf(nr.furniture, i)).join('، ')}). اتشالت من الغرف.`)
  if (droppedFurn - missingFurn.size > 0 || lostFurn > 0) warnings.push(`اتشالت ${droppedFurn + lostFurn} قطعة فرش (مجهولة أو خارج الغرفة).`)
  if (missingOpen.size) warnings.push(`أنواع أبواب أو شبابيك مضافة من الداشبورد مش موجودة على الجهاز ده (${[...missingOpen].map((i) => nameOf(nr.openings, i)).join('، ')}). استُبدلت بالافتراضي.`)
  return { apt: a }
}

export function parseProject(text: string): ParseResult {
  if (typeof text !== 'string' || text.length > 8_000_000) return { ok: false, error: 'الملف كبير أو غير سليم.' }
  let raw: any
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'الملف مش بصيغة مشروع سليمة (JSON).' } }
  if (!isObj(raw) || raw.format !== FORMAT) return { ok: false, error: 'ده مش ملف مشروع من بيتي.' }
  if (!int(raw.version) || raw.version < 1) return { ok: false, error: 'رقم نسخة الملف غير سليم.' }
  if (raw.version > VERSION) return { ok: false, error: 'الملف ده من نسخة أحدث من الموقع. حدّث الموقع الأول.' }
  const data = raw.data
  if (!isObj(data) || !isObj(data.apt)) return { ok: false, error: 'بيانات المشروع ناقصة.' }
  const warnings: string[] = []
  const style = oneOf<StyleId>(data.style, STYLES.map((s) => s.id), 'modern')
  const budget = oneOf<BudgetId>(data.budget, BUDGETS.map((b) => b.id), 'economy')
  const mode = oneOf(data.mode, ['build', 'finish', 'furnish'] as const, 'finish')
  const res = cleanApartment(data.apt, style, raw.needs, warnings)
  if ('error' in res) return { ok: false, error: res.error }
  return {
    ok: true, warnings,
    file: { format: FORMAT, version: VERSION, name: str(raw.name, 'مشروع مستورد', 60), savedAt: str(raw.savedAt, new Date().toISOString(), 40), data: { style, budget, mode, apt: res.apt }, needs: collectNeeds(res.apt) },
  }
}

// ===== فتح مشروع ومشروع جديد =====
export function applyProject(f: ProjectFile, text = '') {
  session.style = f.data.style; session.budget = f.data.budget; session.mode = f.data.mode
  session.apt = f.data.apt; session.name = f.name
  notice.text = text
  bumpProject()
}
export function newProject() {
  session.mode = 'finish'; session.style = 'modern'; session.budget = 'economy'
  session.apt = defaultApartment(); session.name = 'مشروع جديد'
  notice.text = 'بدأت مشروع جديد.'; notice.warnings = []
  bumpProject()
}
export function importText(text: string): { ok: boolean; error?: string } {
  const r = parseProject(text)
  if (!r.ok) return { ok: false, error: r.error }
  notice.warnings = r.warnings
  applyProject(r.file, `اتفتح مشروع "${r.file.name}".`)
  return { ok: true }
}

// ===== التخزين في المتصفح =====
const AUTO = 'bayti.autosave.v1', SLOTS = 'bayti.projects.v1'
const store = (): Storage | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }

export function restoreAutosave(): boolean {
  const raw = store()?.getItem(AUTO)
  if (!raw) return false
  const r = parseProject(raw)
  if (!r.ok) return false
  notice.warnings = r.warnings
  applyProject(r.file, 'رجّعنا آخر مشروع كنت شغال عليه.')
  return true
}

// بيحفظ المشروع الحالي كل ثانية ونص لو اتغيّر
export function startAutosave(): () => void {
  let last = ''
  const flush = () => {
    try {
      const s = store()
      if (!s) return
      const f = snapshot(), body = JSON.stringify({ n: f.name, d: f.data })
      if (body === last) return
      s.setItem(AUTO, JSON.stringify(f)); last = body
    } catch { /* المساحة ممتلئة: تجاهل */ }
  }
  const t = setInterval(flush, 1500)
  const vis = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('visibilitychange', vis); addEventListener('pagehide', flush)
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', flush) }
}

export interface Slot { id: string; name: string; savedAt: string; summary: { area: number; rooms: number }; file: ProjectFile }
export function listSlots(): Slot[] {
  try {
    const arr = JSON.parse(store()?.getItem(SLOTS) ?? '[]')
    return Array.isArray(arr) ? arr.filter((s) => isObj(s) && typeof s.id === 'string' && isObj(s.file)) : []
  } catch { return [] }
}
function writeSlots(slots: Slot[]): string | null {
  try { store()?.setItem(SLOTS, JSON.stringify(slots)); return null } catch { return 'المساحة المتاحة في المتصفح خلصت. امسح مشاريع قديمة أو نزّل ملفات.' }
}
const summarize = (f: ProjectFile) => ({ area: Math.round(f.data.apt.rooms.reduce((s, r) => s + r.w * r.d, 0)), rooms: f.data.apt.rooms.length })

export function saveSlot(name: string, id?: string): string | null {
  const file = snapshot(); file.name = str(name, 'مشروع', 60)
  const slot: Slot = { id: id ?? 's' + Date.now().toString(36), name: file.name, savedAt: file.savedAt, summary: summarize(file), file }
  const all = listSlots()
  const err = writeSlots(id && all.some((s) => s.id === id) ? all.map((s) => (s.id === id ? slot : s)) : [slot, ...all])
  if (!err) session.name = file.name
  return err
}
export function openSlot(id: string): string | null {
  const s = listSlots().find((x) => x.id === id)
  if (!s) return 'المشروع مش موجود'
  const r = importText(JSON.stringify(s.file))
  return r.ok ? null : r.error ?? 'تعذر الفتح'
}
export function deleteSlot(id: string) { writeSlots(listSlots().filter((s) => s.id !== id)) }
export function duplicateSlot(id: string): string | null {
  const all = listSlots(), s = all.find((x) => x.id === id)
  if (!s) return 'المشروع مش موجود'
  const copy: Slot = { ...JSON.parse(JSON.stringify(s)), id: 's' + Date.now().toString(36), name: s.name + ' (نسخة)' }
  copy.file.name = copy.name
  return writeSlots([copy, ...all])
}
export function exportFileName(name: string) {
  const clean = name.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().slice(0, 40) || 'project'
  return `${clean}-${new Date().toISOString().slice(0, 10)}.bayti.json`
}