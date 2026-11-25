import { SIDE_NAMES } from './apartment'
import type { RoomView, Side } from './apartment'
import type { BudgetId } from './data/options'
import { LAYOUTS, byId, priceOf, wasteOf } from './data/catalog'
import { CEILING_TYPES, CHAND, CORN, LED, MATERIALS, SPOT, ledLength, spotPositions, supportsCornice, supportsLed, typePrice } from './data/ceilingCatalog'
import { FIN } from './data/finance'
import type { LaborKey } from './data/finance'
import { RULES, recommendedSpots } from './data/rules'
import { FINISHES, wmById, wmPrice } from './data/wallCatalog'
import { FURN } from './furniture'
import { doorRole, pickStyle } from './openings'

// أسعار التوريد الافتراضية (جنيه) حسب الفئة: [اقتصادي، متوسط، فاخر]
const IDX: Record<BudgetId, number> = { economy: 0, mid: 1, luxury: 2 }
const PAINT = [45, 70, 110]   // دهان للمتر المربع (مطفي)
const SKIRT = [35, 60, 110]   // وزرة بارتفاع 10 سم للمتر الطولي

export type Cat = 'floor' | 'wall' | 'accent' | 'dado' | 'skirt' | 'ceiling' | 'light' | 'openings' | 'furn'
export const CAT_NAMES: Record<Cat, string> = {
  floor: 'الأرضيات', wall: 'دهان الحيطان', accent: 'حيطة الديكور', dado: 'الدادو', skirt: 'الوزرات',
  ceiling: 'الأسقف', light: 'الإضاءة والكورنيش', openings: 'الأبواب والشبابيك', furn: 'الفرش',
}

// بند في المقايسة: net = الصافي | waste = معامل الهدر | qty = الكمية بعد الهدر
// price = سعر الوحدة الكلي = توريد + مصنعية + مواد مساعدة | cost = qty × price
export interface Line {
  cat: Cat; label: string; spec: string; net: number; waste: number; qty: number; unit: string; price: number; cost: number
  parts: { supply: number; labor: number; cons: number } // مكونات سعر الوحدة
  note?: string; packs?: { n: number; unit: string }
}

export const fmt = (n: number) => Math.round(n).toLocaleString('ar-EG')

// ===== الكميات من الأبعاد الصافية والفتحات والأعمدة الفعلية =====
export function roomQuantities(r: RoomView) {
  const W = r.wall
  const cw = r.cw ?? r.w, cd = r.cd ?? r.d
  const sides: Side[] = ['N', 'S', 'W', 'E']
  const len = (s: Side) => (s === 'N' || s === 'S' ? cw : cd)
  const cut = (s: Side) => r.openings.filter((o) => o.side === s && (o.kind === 'door' || (o.kind === 'pass' && o.sill < 0.01))).reduce((t, o) => t + o.width, 0)
  const oArea = (list: RoomView['openings']) => list.reduce((t, o) => {
    if (o.kind === 'door') return t + o.width * 2.1
    if (o.kind === 'window' || o.sill > 0.01) return t + o.width * Math.max(0, 2.1 - o.sill)
    return t + o.width * (o.width >= 2.4 ? r.h : 2.1)
  }, 0)

  const perimeter = 2 * (cw + cd)
  const wallArea = Math.max(0, perimeter * r.h - oArea(r.openings))
  const accentArea = W.accent.side ? Math.max(0, len(W.accent.side) * r.h - oArea(r.openings.filter((o) => o.side === W.accent.side))) : 0
  const dadoLen = W.dado.on ? sides.filter((s) => s !== W.accent.side).reduce((t, s) => t + Math.max(0, len(s) - cut(s)), 0) : 0
  const dadoCut = W.dado.on ? r.openings
    .filter((o) => o.side !== W.accent.side && (o.kind === 'window' || (o.kind === 'pass' && o.sill > 0.01)))
    .reduce((t, o) => t + o.width * Math.max(0, Math.min(W.dado.height, 2.1) - o.sill), 0) : 0
  const dadoArea = Math.max(0, dadoLen * W.dado.height - dadoCut)
  const colArea = r.columns.reduce((t, c) => t + c.w * c.d, 0)
  const colSides = r.columns.reduce((t, c) => t + 2 * c.d, 0)

  return {
    floorGross: r.w * r.d, floorClear: cw * cd, colArea,
    floorNet: Math.max(0, cw * cd - colArea),
    paint: Math.max(0, wallArea - accentArea - dadoArea) + colSides * r.h,
    accent: accentArea, dado: dadoArea,
    ceiling: cw * cd,
    skirting: sides.reduce((t, s) => t + Math.max(0, len(s) - cut(s)), 0) + colSides,
  }
}

type AddIn = Omit<Line, 'qty' | 'cost' | 'price' | 'parts'> & { key: LaborKey; supply: number }

export function roomLines(r: RoomView, b: BudgetId): Line[] {
  const i = IDX[b], q = roomQuantities(r), W = r.wall, c = r.ceiling
  const cw = r.cw ?? r.w, cd = r.cd ?? r.d
  const out: Line[] = []
  // سعر الوحدة = توريد + مصنعية (من الجدول) + مواد مساعدة (نسبة من التوريد)
  const add = (l: AddIn) => {
    const { key, supply, ...rest } = l
    const labor = FIN.labor[key][i], cons = supply * (FIN.cons[l.cat === 'light' ? 'light' : l.cat] ?? 0)
    const price = supply + labor + cons, qty = l.net * l.waste
    out.push({ ...rest, qty, price, cost: qty * price, parts: { supply, labor, cons } })
  }

  // الأرضية
  const fm = byId(r.floor.material), fw = wasteOf(fm, r.floor.layout)
  const gross = q.floorNet * fw
  const seamless = fm.photo?.mode === 'seamless' || fm.pattern === 'plain' || fm.pattern === 'carpet'
  const boxM2 = fm.pattern === 'plank' ? RULES.box.plank : RULES.box.tile
  const pieces = seamless ? '' : `حوالي ${Math.ceil(gross / (fm.size[0] * fm.size[1]))} قطعة (${Math.round(fm.size[0] * 100)}×${Math.round(fm.size[1] * 100)} سم)`
  const boxes = seamless ? 0 : Math.ceil(gross / boxM2)
  const colNote = q.colArea > 0 ? `بعد خصم الأعمدة (${q.colArea.toFixed(2)} م²)` : ''
  add({
    cat: 'floor', key: 'floor', label: 'الأرضية', spec: `${fm.name} — ${LAYOUTS[r.floor.layout].name}`, net: q.floorNet, waste: fw, unit: 'م²', supply: priceOf(fm, b),
    note: [pieces, boxes ? `${boxes} كرتونة (${boxM2} م² للكرتونة)` : '', colNote].filter(Boolean).join(' | '),
    packs: boxes ? { n: boxes, unit: 'كرتونة' } : undefined,
  })

  // دهان الحيطان
  const liters = (q.paint * RULES.paint.coats) / RULES.paint.spread
  const buckets = Math.ceil(liters / RULES.paint.bucket)
  add({
    cat: 'wall', key: 'wall', label: 'دهان الحيطان', spec: `${FINISHES[W.finish].name} — ${W.color}`, net: q.paint, waste: 1, unit: 'م²',
    supply: PAINT[i] * FINISHES[W.finish].factor, note: `حوالي ${Math.ceil(liters)} لتر (${RULES.paint.coats} وجه) = ${buckets} بستلة (${RULES.paint.bucket} لتر)`,
    packs: { n: buckets, unit: 'بستلة' },
  })

  // حيطة الديكور
  if (W.accent.side) {
    const m = wmById(W.accent.material)
    const alen = W.accent.side === 'N' || W.accent.side === 'S' ? cw : cd
    const note = m.id === 'wood-slats' ? `حوالي ${Math.ceil(alen / RULES.slatW)} شريحة (${Math.round(RULES.slatW * 100)} سم)`
      : m.id === 'marble-look' ? `حوالي ${Math.ceil((q.accent * RULES.waste.wallMaterial) / (RULES.sheet.w * RULES.sheet.h))} لوح (${RULES.sheet.w}×${RULES.sheet.h} م)` : undefined
    add({ cat: 'accent', key: 'accent', label: 'حيطة الديكور', spec: `${m.name} — حيطة ${SIDE_NAMES[W.accent.side]}`, net: q.accent, waste: RULES.waste.wallMaterial, unit: 'م²', supply: wmPrice(m, b), note })
  }

  // الدادو
  if (W.dado.on) {
    const m = W.dado.material ? wmById(W.dado.material) : null
    add({
      cat: 'dado', key: 'dado', label: 'الدادو', spec: `${m ? m.name : 'دهان ساتان'} — ارتفاع ${Math.round(W.dado.height * 100)} سم`, net: q.dado,
      waste: m ? RULES.waste.wallMaterial : 1, unit: 'م²', supply: m ? wmPrice(m, b) : PAINT[i],
    })
  }

  // الوزرة
  const skQty = q.skirting * RULES.waste.skirting
  add({
    cat: 'skirt', key: 'skirt', label: 'الوزرة', spec: `ارتفاع ${Math.round(W.skirt.height * 100)} سم`, net: q.skirting, waste: RULES.waste.skirting, unit: 'م.ط',
    supply: SKIRT[i] * (W.skirt.height / 0.1), note: `حوالي ${Math.ceil(skQty / RULES.skirtLen)} قطعة (${RULES.skirtLen} م)`,
    packs: { n: Math.ceil(skQty / RULES.skirtLen), unit: 'قطعة وزرة' },
  })

  // السقف
  const ct = CEILING_TYPES.find((x) => x.id === c.type)!
  add({ cat: 'ceiling', key: 'ceiling', label: 'السقف', spec: `${ct.name} — ${MATERIALS[c.material].name}`, net: q.ceiling, waste: 1, unit: 'م²', supply: typePrice(c.type, b) * MATERIALS[c.material].factor })
  const spots = spotPositions(r.w - 0.24, r.d - 0.24, c.spots, c.type).length // نفس العدد المرسوم في الـ3D
  const rec = recommendedSpots(r.type, cw * cd)
  if (spots) {
    add({
      cat: 'light', key: 'spot', label: 'السبوت لايت', spec: c.spots === 'grid' ? 'توزيع شبكة' : 'على المحيط', net: spots, waste: 1, unit: 'نقطة', supply: SPOT[i],
      note: `الموصى به حسب الإضاءة (${RULES.lux[r.type]} لوكس): ${rec} سبوت${spots < rec * 0.7 ? ' (العدد الحالي أقل من الموصى به)' : ''}`,
    })
  }
  if (supportsLed(c.type) && c.led !== 'off') {
    add({ cat: 'light', key: 'led', label: 'شريط LED مخفي', spec: c.led === 'warm' ? 'دافئ' : c.led === 'neutral' ? 'محايد' : 'بارد', net: ledLength(cw, cd, c.type), waste: 1, unit: 'م.ط', supply: LED[i] })
  }
  if (c.chandelier) add({ cat: 'light', key: 'chandelier', label: 'نجفة', spec: 'منتصف الغرفة', net: 1, waste: 1, unit: 'قطعة', supply: CHAND[i] })
  if (supportsCornice(c.type) && c.cornice !== 'none') {
    add({ cat: 'light', key: 'cornice', label: 'كورنيش', spec: c.cornice === 'simple' ? 'بسيط' : 'كلاسيك', net: 2 * (cw + cd), waste: 1, unit: 'م.ط', supply: CORN[c.cornice][i] })
  }

  // الأبواب والشبابيك (بتتحسب مرة واحدة: في الغرفة صاحبة الفتحة)
  r.openings.filter((o) => o.own && (o.kind === 'door' || o.kind === 'window')).forEach((o) => {
    const fs = pickStyle(o.kind as 'door' | 'window', doorRole(r.type, o.to, o.tt), r.ofin, r.odef, o.id)
    if (o.kind === 'door') {
      add({ cat: 'openings', key: 'door', label: o.to == null ? 'باب الشقة' : 'باب', spec: `${fs.def.name} — ${Math.round(o.width * 100)}×210 سم`, net: 1, waste: 1, unit: 'قطعة', supply: fs.def.price[i] })
    } else {
      const wh = Math.max(0.3, 2.1 - o.sill)
      add({ cat: 'openings', key: 'window', label: 'شباك', spec: `${fs.def.name} — ${Math.round(o.width * 100)}×${Math.round(wh * 100)} سم`, net: o.width * wh, waste: 1, unit: 'م²', supply: fs.def.price[i] })
    }
  })

  // الفرش
  if (r.fon) {
    const groups = new Map<string, number>()
    r.furniture.forEach((it) => groups.set(it.kind, (groups.get(it.kind) ?? 0) + 1))
    groups.forEach((n, kind) => {
      const d = FURN[kind]
      if (!d) return
      add({ cat: 'furn', key: 'furn', label: d.name, spec: `${Math.round(d.w * 100)}×${Math.round(d.d * 100)} سم`, net: n, waste: 1, unit: 'قطعة', supply: d.price[i] })
    })
  }
  return out
}

// التكلفة المباشرة (DC) لغرفة أو لكل الشقة
export const roomCost = (r: RoomView, b: BudgetId) => roomLines(r, b).reduce((s, l) => s + l.cost, 0)
export const totalCost = (rooms: RoomView[], b: BudgetId) => rooms.reduce((s, r) => s + roomCost(r, b), 0)

// ملخص المشروع: DC ثم المصاريف غير المباشرة ثم الهامش وسعر العقد
export function projectTotals(rooms: RoomView[], b: BudgetId) {
  const lines = rooms.flatMap((r) => roomLines(r, b))
  const sum = (f: (l: Line) => number) => lines.reduce((s, l) => s + f(l), 0)
  const dc = sum((l) => l.cost)
  const supply = sum((l) => l.qty * l.parts.supply), labor = sum((l) => l.qty * l.parts.labor), cons = sum((l) => l.qty * l.parts.cons)
  const ic = dc * FIN.indirect, sub = dc + ic, mg = sub * FIN.margin
  return { dc, supply, labor, cons, ic, sub, mg, price: sub + mg, indirect: FIN.indirect, margin: FIN.margin }
}
export const grandTotal = (rooms: RoomView[], b: BudgetId) => projectTotals(rooms, b).price