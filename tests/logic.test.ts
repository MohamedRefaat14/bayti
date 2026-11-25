// @ts-nocheck
/*
  تيست منطق المشروع: التخطيط، الأبعاد، الفتحات، الكميات، الهدر، التكلفة، الفرش، الأعمدة، الكتالوجات.
  التشغيل من مجلد المشروع:
      npm i -D tsx
      npx tsx tests/logic.test.ts
  بيطبع ملخص لكل قسم، وبعدين الأخطاء (FAIL) والتحذيرات (WARN). ابعتلي الناتج لو فيه أخطاء.
*/
type Lvl = 'fail' | 'warn'
const store = new Map<string, { sec: string; lvl: Lvl; msg: string; n: number; ex: string[] }>()
const secStat = new Map<string, { checks: number; fail: number; warn: number; crash: boolean }>()
let sec = ''
const st = () => { if (!secStat.has(sec)) secStat.set(sec, { checks: 0, fail: 0, warn: 0, crash: false }); return secStat.get(sec)! }
function rec(lvl: Lvl, msg: string, tag = '') {
  const k = sec + '|' + lvl + '|' + msg
  const e = store.get(k) ?? { sec, lvl, msg, n: 0, ex: [] }
  e.n++; if (tag && e.ex.length < 3 && !e.ex.includes(tag)) e.ex.push(tag)
  store.set(k, e); st()[lvl]++
}
const fail = (m: string, t = '') => rec('fail', m, t)
const warn = (m: string, t = '') => rec('warn', m, t)
const ok = (c: any, m: string, t = '') => { st().checks++; if (!c) fail(m, t); return !!c }
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol
async function section(name: string, fn: () => any) {
  sec = name; st()
  try { await fn() } catch (e: any) { st().crash = true; fail('CRASH: ' + (e?.stack?.split('\n').slice(0, 3).join(' | ') ?? e)) }
}
async function load(p: string) { try { return await import(p) } catch (e: any) { console.log('!! تعذر تحميل ' + p + ': ' + e.message); return null } }

const OPP: any = { N: 'S', S: 'N', E: 'W', W: 'E' }
const SIDES = ['N', 'E', 'S', 'W']
const BUD = ['economy', 'mid', 'luxury']
const EPS = 0.07
const rng = (seed: number) => { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
const ov = (p: any, q: any) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.d, q.y + q.d) - Math.max(p.y, q.y))
const leaves = (n: any, f: any): number => ('t' in n ? (f(n) ? 1 : 0) : n.parts.reduce((s: number, p: any) => s + leaves(p.node, f), 0))
const finite = (v: any) => typeof v === 'number' && Number.isFinite(v)

async function main() {
  const A = await load('../src/apartment'), T = await load('../src/templates'), F = await load('../src/furniture')
  const R = await load('../src/report'), C = await load('../src/data/catalog'), W = await load('../src/data/wallCatalog')
  const CE = await load('../src/data/ceilingCatalog'), COL = await load('../src/columns'), OP = await load('../src/openings')
  const PR = await load('../src/data/pricing')
  if (!A || !T) { console.log('لازم src/apartment.ts و src/templates.ts يتحملوا'); process.exit(2) }
  const { TEMPLATES } = T

  const makeApt = (id: string, area: number, ratio: number, front: string, kitchen: string) => {
    const a = A.defaultApartment()
    const t = TEMPLATES.find((x: any) => x.id === id)
    a.mode = 'template'; a.tpl = id; a.area = area; a.ratio = ratio; a.front = front; a.kitchen = kitchen; a.blind = t.blind
    A.regenerate(a)
    return a
  }

  // ===== فحوصات الهندسة =====
  const geometry = (a: any, tag: string) => {
    const rs = a.rooms
    ok(rs.length > 0, 'مفيش غرف', tag)
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      if (ov(rs[i], rs[j]) > 0.01) fail(`غرفتين متداخلتين: ${rs[i].name} و ${rs[j].name}`, tag)
    }
    const total = rs.reduce((s: number, r: any) => s + r.w * r.d, 0)
    const b = A.bounds(rs), box = (b.x1 - b.x0) * (b.y1 - b.y0)
    if (a.mode === 'template') {
      if (Math.abs(total - a.area) > a.area * 0.015) fail(`مجموع مساحات الغرف ${total.toFixed(1)} مختلف عن المساحة المدخلة ${a.area}`, tag)
      if (box - total > 0.4) fail(`فيه فراغات بين الغرف (${(box - total).toFixed(2)} م²)`, tag)
      ok(near(b.x0, 0, 0.06) && near(b.y0, 0, 0.06), 'الشقة مش بادية من نقطة 0', tag)
    }
    for (const r of rs) {
      ok(finite(r.x + r.y + r.w + r.d) && r.w > 0 && r.d > 0, `أبعاد غير سليمة: ${r.name}`, tag)
      const mn = Math.min(r.w, r.d), mx = Math.max(r.w, r.d)
      if (r.type === 'hall') { if (mn < 1.0) warn(`ممر/صالة ضيق (${mn.toFixed(2)} م)`, tag) }
      else {
        if (mn < 1.2) warn(`غرفة ضيقة جداً: ${r.name} ${r.w.toFixed(1)}×${r.d.toFixed(1)}`, tag)
        else if (mx / mn > 3.4) warn(`غرفة طويلة ورفيعة: ${r.name} ${r.w.toFixed(1)}×${r.d.toFixed(1)}`, tag)
        const minA: any = { bed: 8, bath: 3, kitchen: 6, living: 6 }
        if (minA[r.type] && r.w * r.d < minA[r.type]) warn(`مساحة صغيرة: ${r.name} ${(r.w * r.d).toFixed(1)} م²`, tag)
      }
    }
  }

  const openingsCheck = (a: any, tag: string) => {
    const rs = a.rooms, used = new Map<string, [number, number][]>()
    const mark = (id: number, s: string, lo: number, hi: number, who: string) => {
      const k = id + '|' + s, arr = used.get(k) ?? []
      if (arr.some(([x0, x1]) => hi > x0 + 0.001 && lo < x1 - 0.001)) fail(`فتحتين متداخلتين على نفس الحيطة (${who})`, tag)
      arr.push([lo, hi]); used.set(k, arr)
    }
    for (const o of a.openings) {
      const r = rs.find((x: any) => x.id === o.roomId)
      if (!ok(r, 'فتحة على غرفة مش موجودة', tag)) continue
      const l = A.wallLine(r, o.side), len = l.to - l.from, c = l.from + o.offset, h = o.width / 2
      if (o.offset - h < 0.1 - EPS || o.offset + h > len - 0.1 + EPS) fail(`فتحة خارج حدود الحيطة (${r.name})`, tag)
      const ext = A.exteriorIntervals(rs, r, o.side).some(([lo, hi]: any) => c - h >= lo - EPS && c + h <= hi + EPS)
      const nbs = rs.filter((n: any) => n.id !== r.id).filter((n: any) => {
        const w = A.wallLine(n, OPP[o.side])
        return w.axis === l.axis && Math.abs(w.fixed - l.fixed) < EPS && c - h >= w.from - EPS && c + h <= w.to + EPS
      })
      if (o.kind === 'window') {
        if (!ext) fail(`شباك مش على حيطة خارجية (${r.name})`, tag)
        if (o.sill < 0 || o.sill > 1.8) fail('ارتفاع جلسة الشباك غير معقول', tag)
        if (o.width < 0.4 || o.width > 3.5) fail(`عرض شباك غير معقول ${o.width.toFixed(2)}`, tag)
      } else {
        if (!ext && nbs.length !== 1) fail(`باب/فتحة مش على حيطة مشتركة مع غرفة واحدة (${r.name}, عدد الجيران ${nbs.length})`, tag)
        if (o.kind === 'door' && (o.width < 0.7 || o.width > 1.3)) fail(`عرض باب غير معقول ${o.width.toFixed(2)}`, tag)
        if (o.kind === 'pass' && o.sill > 1.2) fail('ارتفاع بار غير معقول', tag)
        if (nbs[0]) mark(nbs[0].id, OPP[o.side], c - h, c + h, 'جار')
      }
      mark(r.id, o.side, c - h, c + h, r.name)
    }
  }

  const logicCheck = (a: any, tag: string) => {
    const views = A.buildViews(a, 'modern'), byId = new Map(views.map((v: any) => [v.id, v]))
    // باب الشقة
    const ent: any[] = []
    views.forEach((v: any) => v.openings.forEach((o: any) => { if (o.own && o.kind === 'door' && o.to == null) ent.push([v, o]) }))
    if (ok(ent.length === 1, `عدد أبواب الشقة ${ent.length} (المفروض 1)`, tag)) {
      const [v, o] = ent[0]
      if (a.mode === 'template') {
        ok(o.side === a.front, 'باب الشقة مش على ناحية الشارع', tag)
        ok(v.type === 'living' || v.type === 'hall', 'باب الشقة مش على ريسبشن أو صالة', tag)
        const entryRoom = views.find((x: any) => x.entry)
        if (entryRoom && entryRoom.id !== v.id) warn('باب الشقة مش على غرفة المدخل المحددة في النموذج', tag)
      }
    }
    // الاتصال بين الغرف
    const edges = new Map<number, number[]>()
    const addE = (p: number, q: number) => { edges.set(p, [...(edges.get(p) ?? []), q]); edges.set(q, [...(edges.get(q) ?? []), p]) }
    views.forEach((v: any) => v.openings.forEach((o: any) => { if (o.to != null && (o.kind === 'door' || (o.kind === 'pass' && o.sill < 0.01))) addE(v.id, o.to) }))
    const start = ent[0]?.[0]?.id ?? views[0].id, seen = new Set([start]), q = [start]
    while (q.length) { const u = q.pop(); for (const w of edges.get(u) ?? []) if (!seen.has(w)) { seen.add(w); q.push(w) } }
    views.forEach((v: any) => { if (!seen.has(v.id)) fail(`مفيش طريق من باب الشقة لـ ${v.name}`, tag) })
    for (const v of views) {
      const conns = new Set(edges.get(v.id) ?? [])
      if (v.type === 'hall' && conns.size < 2) warn(`صالة/ممر بمخرج واحد بس (طريق مسدود): ${v.name}`, tag)
      for (const id of conns) {
        const n: any = byId.get(id)
        const kinds = v.openings.filter((o: any) => o.to === id).map((o: any) => o.kind)
        if ((v.type === 'hall' && n.type === 'living') || (v.type === 'living' && n.type === 'hall') || (v.type === 'living' && n.type === 'living')) {
          if (kinds.includes('door')) fail(`${v.name} ↔ ${n.name} متوصلين بباب (المفروض فتحة مفتوحة)`, tag)
        }
      }
      if (v.ens) {
        const toBeds = [...conns].filter((id) => (byId.get(id) as any).type === 'bed')
        if (toBeds.length !== 1 || conns.size !== 1) fail(`${v.name} (حمام/دريسنج ملحق) لازم يتوصل بغرفة نوم واحدة بس`, tag)
      } else if (v.type === 'bath') {
        if ([...conns].some((id) => (byId.get(id) as any).type === 'bed')) warn(`${v.name} (حمام عام) بابه على غرفة نوم`, tag)
      }
      if (v.type !== 'hall' && conns.size === 0) fail(`${v.name} من غير أي باب`, tag)
    }
    // المطبخ
    if (a.mode === 'template') {
      const k = views.find((x: any) => x.type === 'kitchen')
      if (k) {
        const toLiv = k.openings.filter((o: any) => o.to != null && (byId.get(o.to) as any).type === 'living')
        if (a.kitchen === 'open') {
          const p = toLiv.find((o: any) => o.kind === 'pass' && o.sill < 0.01)
          if (!p) warn('مطبخ أمريكان لكن مفيش فتحة مفتوحة على الريسبشن', tag)
          else if (p.width < 2.4) warn(`مطبخ أمريكان بفتحة ${p.width.toFixed(2)} م (أقل من 2.4 فمش هتتعامل كأمريكان في الـ3D والـ2D)`, tag)
        } else if (a.kitchen === 'bar') {
          if (!toLiv.some((o: any) => o.kind === 'pass' && o.sill > 0.5)) warn('مطبخ بار لكن مفيش بار على الريسبشن', tag)
        } else if (toLiv.some((o: any) => o.kind === 'pass')) fail('مطبخ مقفول لكن فيه فتحة مفتوحة على الريسبشن', tag)
      }
    }
    // الشبابيك
    const rep = A.analyze(a)
    rep.noWindow.forEach((m: string) => warn(m, tag))
  }

  // ===== 1) بيانات النماذج =====
  await section('1. النماذج (بيانات وتوافق)', () => {
    for (const t of TEMPLATES) {
      const beds = leaves(t.tree, (l: any) => l.t === 'bed'), baths = leaves(t.tree, (l: any) => l.t === 'bath'), entry = leaves(t.tree, (l: any) => l.entry)
      ok(beds === t.beds, `${t.id}: عدد غرف النوم في الشجرة ${beds} والمكتوب ${t.beds}`)
      ok(baths === t.baths, `${t.id}: عدد الحمامات في الشجرة ${baths} والمكتوب ${t.baths}`)
      ok(entry === 1, `${t.id}: غرف المدخل ${entry} (المفروض 1)`)
      ok(t.min < t.nominal && t.nominal < t.max, `${t.id}: المدى (min/nominal/max) مش مرتب`)
      const [w, l] = T.dimsFor(t.nominal, t.ratio)
      ok(near(w * l, t.nominal, 1e-6), `${t.id}: dimsFor مش بيحافظ على المساحة`)
      ok(T.suggest(t.nominal, t.beds)[0].id === t.id, `${t.id}: الاقتراح عند المساحة الأساسية وعدد الغرف مش بيطلّعه الأول (طالع ${T.suggest(t.nominal, t.beds)[0].id})`)
      ok(T.suggest(t.min, t.beds)[0].id === t.id || T.suggest(t.min, t.beds)[0].beds === t.beds, `${t.id}: الاقتراح عند أقل مساحة غريب`)
    }
    const ids = new Set(TEMPLATES.map((t: any) => t.id)); ok(ids.size === TEMPLATES.length, 'أرقام النماذج مكررة')
  })

  // ===== 2) التخطيط والفتحات والمنطق لكل النماذج =====
  await section('2. التخطيط والفتحات والمنطق (كل النماذج × مساحات × نسب × ارتفاع الشارع × المطبخ)', () => {
    let n = 0
    for (const t of TEMPLATES) {
      const configs: any[] = []
      for (const area of [t.min, t.nominal, t.max]) for (const ratio of [t.rmin ?? 0.8, t.ratio, t.rmax ?? 1.3]) for (const k of ['closed', 'bar', 'open']) configs.push([area, ratio, 'S', k])
      for (const f of ['N', 'W', 'E']) for (const k of ['closed', 'open']) configs.push([t.nominal, t.ratio, f, k])
      for (const [area, ratio, front, kit] of configs) {
        const tag = `${t.id} ${area}م² نسبة ${ratio} شارع=${front} مطبخ=${kit}`
        const a = makeApt(t.id, area, ratio, front, kit); n++
        geometry(a, tag); openingsCheck(a, tag); logicCheck(a, tag)
        ok(a.openings.length > 0, 'مفيش فتحات', tag)
      }
    }
    console.log(`   (${n} تكوين اتفحص)`)
  })

  // ===== 3) التعديل (حيطان وأبعاد) =====
  await section('3. تعديل الأبعاد وتحريك الحيطان (الحفاظ على المساحة وعدم التداخل)', () => {
    let tested = 0
    for (const t of TEMPLATES) {
      const base = makeApt(t.id, t.nominal, t.ratio, 'S', t.kitchen)
      const total0 = base.rooms.reduce((s: number, r: any) => s + r.w * r.d, 0)
      const check = (c: any, what: string) => {
        geometry({ ...c, mode: 'custom' }, what)
        const total = c.rooms.reduce((s: number, r: any) => s + r.w * r.d, 0)
        if (Math.abs(total - total0) > 0.06) fail(`المساحة الكلية اتغيّرت ${total0.toFixed(2)} → ${total.toFixed(2)} (فراغات أو تداخل)`, what)
        const b = A.bounds(c.rooms), box = (b.x1 - b.x0) * (b.y1 - b.y0)
        if (box - total > 0.4) fail(`فراغات بعد التعديل (${(box - total).toFixed(2)} م²)`, what)
        openingsCheck(c, what)
      }
      for (const room of base.rooms) {
        for (const side of SIDES) for (const delta of [0.25, -0.25, 0.5]) {
          const c = structuredClone(base), before = JSON.stringify(c.rooms)
          A.moveWall(c, room.id, side, delta)
          if (JSON.stringify(c.rooms) === before) continue
          tested++; check(c, `${t.id} moveWall ${room.name} ${side} ${delta}`)
        }
        for (const absorb of [true, false]) for (const [dw, dd] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
          const c = structuredClone(base), before = JSON.stringify(c.rooms)
          A.resizeRoom(c, room.id, room.w + dw, room.d + dd, absorb)
          if (JSON.stringify(c.rooms) === before) continue
          tested++
          if (absorb) check(c, `${t.id} resize ${room.name} ${dw},${dd} absorb`)
          else { geometry({ ...c, mode: 'custom' }, `${t.id} resize ${room.name} no-absorb`) }
        }
      }
      // تبديل أماكن، حذف
      const sw = structuredClone(base); A.swapRooms(sw, base.rooms[0].id, base.rooms[1].id); check(sw, `${t.id} swap`)
      const rm = structuredClone(base); A.removeRoom(rm, base.rooms[2].id)
      geometry({ ...rm, mode: 'custom' }, `${t.id} removeRoom`); openingsCheck(rm, `${t.id} removeRoom`)
    }
    console.log(`   (${tested} تعديل اتجرّب)`)
  })

  // ===== 4) الكميات والهدر والتكلفة =====
  if (R && C && W && CE) await section('4. الكميات والهدر والتكلفة (حسابات مستقلة)', () => {
    const PAINT = [45, 70, 110], SKIRT = [35, 60, 110] // لو غيّرت الأسعار في report.ts غيّرهم هنا
    const wcfg = (o: any = {}) => ({ color: '#F3F3F0', finish: 'matt', accent: { side: null, material: 'wood-slats', color: '#A9784F' }, dado: { on: false, height: 1.2, material: '', color: '#ffffff' }, skirt: { height: 0.1, color: '#ffffff' }, ...o })
    const fcfg = (o: any = {}) => ({ material: 'por-plain', color: '#D8D3CA', layout: 'straight', groutColor: '#C9C5BC', groutMm: 3, ...o })
    const ccfg = (o: any = {}) => ({ type: 'flat', material: 'gypsum', color: '#F6F4EF', led: 'off', spots: 'none', chandelier: false, cornice: 'none', ...o })
    const room = (o: any = {}) => ({
      id: 1, type: 'living', name: 'غرفة اختبار', x: 0, y: 0, w: 4, d: 3, h: 2.8, wall: wcfg(), floor: fcfg(), ceiling: ccfg(),
      openings: [
        { id: 1, kind: 'door', side: 'S', c: 0, width: 0.9, sill: 0, to: null, own: true },
        { id: 2, kind: 'window', side: 'E', c: 0, width: 1.5, sill: 0.9, to: null, own: true },
      ], columns: [], furniture: [], fon: false, fabric: '#CDBFA6', wood: '#A9784F', ofin: {}, odef: {}, ...o,
    })
    // بنقارن بسعر التوريد بس (المصنعية والمواد المساعدة ليها قسم 11)
    const line = (r: any, cat: string, b = 'mid', label?: string) => {
      const l = R.roomLines(r, b).find((x: any) => x.cat === cat && (!label || x.label === label))
      return l && { ...l, cost: l.qty * l.parts.supply }
    }
    const mid = 1
    // أرضية
    let r = room()
    let l = line(r, 'floor')
    ok(near(l.net, 12), `صافي الأرضية ${l.net} (المتوقع 12)`)
    ok(near(l.waste, 1.07), `هدر الصف العادي ${l.waste} (المتوقع 1.10)`)
    ok(near(l.cost, 12 * 1.07 * C.priceOf(C.byId('por-plain'), 'mid'), 0.01), 'تكلفة الأرضية مش = صافي × هدر × سعر')
    for (const [lay, w] of [['straight', 1.07], ['brick', 1.12], ['diagonal', 1.15], ['herringbone', 1.2]] as any) {
      const m = C.byId('hdf')
      if (C.allowedLayouts(m).includes(lay)) ok(near(C.wasteOf(m, lay), w), `هدر ${lay} = ${C.wasteOf(m, lay)} (المتوقع ${w})`)
    }
    ok(near(C.wasteOf(C.byId('epoxy'), 'straight'), 1.05) && near(C.wasteOf(C.byId('carpet'), 'straight'), 1.05), 'هدر الإيبوكسي والموكيت لازم 1.05')
    // دهان
    const wallArea = 14 * 2.8 - 0.9 * 2.1 - 1.5 * (2.1 - 0.9)
    l = line(r, 'wall'); ok(near(l.net, wallArea, 1e-6), `مساحة الدهان ${l.net} (المتوقع ${wallArea})`)
    ok(near(l.cost, wallArea * PAINT[mid], 0.01), 'تكلفة الدهان المطفي')
    r = room({ wall: wcfg({ finish: 'gloss' }) })
    ok(near(line(r, 'wall').cost, wallArea * PAINT[mid] * W.FINISHES.gloss.factor, 0.01), 'معامل اللامع في تكلفة الدهان')
    // وزرة
    l = line(room(), 'skirt'); ok(near(l.net, 14 - 0.9), `طول الوزرة ${l.net} (المتوقع 13.1)`); ok(near(l.cost, 13.1 * 1.05 * SKIRT[mid], 0.01), 'تكلفة الوزرة بهدر 5%')
    ok(near(line(room({ wall: wcfg({ skirt: { height: 0.2, color: '#fff' } }) }), 'skirt').cost, 13.1 * 1.05 * SKIRT[mid] * 2, 0.01), 'وزرة 20 سم لازم تتضاعف')
    // سقف
    l = line(room(), 'ceiling'); ok(near(l.net, 12) && near(l.cost, 12 * CE.typePrice('flat', 'mid'), 0.01), 'تكلفة السقف المسطح')
    // أعمدة
    r = room({ columns: [{ id: 9, roomId: 1, side: 'N', offset: 1, w: 0.3, d: 0.2 }] })
    ok(near(line(r, 'floor').net, 12 - 0.06, 1e-6), 'العمود لازم يتخصم من الأرضية')
    ok(near(line(r, 'wall').net, wallArea + 2 * 0.2 * 2.8, 1e-6), 'جنبين العمود لازم يتضافوا للدهان')
    ok(near(line(r, 'skirt').net, 13.1 + 0.4, 1e-6), 'جنبين العمود لازم يتضافوا للوزرة')
    // حيطة ديكور + دادو
    r = room({ wall: wcfg({ accent: { side: 'N', material: 'wood-slats', color: '#A9784F' } }) })
    l = line(r, 'accent'); ok(near(l.net, 4 * 2.8), `حيطة الديكور ${l.net}`); ok(near(l.waste, 1.1), 'هدر حيطة الديكور 10%')
    ok(near(l.cost, 4 * 2.8 * 1.1 * W.wmPrice(W.wmById('wood-slats'), 'mid'), 0.01), 'تكلفة حيطة الديكور')
    ok(near(line(r, 'wall').net, wallArea - 4 * 2.8, 1e-6), 'الدهان لازم يخصم حيطة الديكور')
    r = room({ wall: wcfg({ dado: { on: true, height: 1.2, material: '', color: '#ffffff' } }) })
    const dadoNaive = (14 - 0.9) * 1.2, dadoIdeal = dadoNaive - 1.5 * Math.max(0, Math.min(1.2, 2.1) - 0.9)
    l = line(r, 'dado')
    ok(near(l.net, dadoIdeal, 0.01), `مساحة الدادو ${l.net.toFixed(2)} م² بيتجاهل الشباك اللي جوه نطاقه (الصح ${dadoIdeal.toFixed(2)})`)
    ok(near(line(r, 'wall').net, wallArea - l.net, 0.01), 'الدهان لازم يخصم الدادو بنفس رقمه')
    // فتحة أمريكان وبار
    r = room({ openings: [{ id: 1, kind: 'pass', side: 'S', c: 0, width: 3, sill: 0, to: 2, own: true }] })
    ok(near(line(r, 'wall').net, 14 * 2.8 - 3 * 2.8, 1e-6), 'فتحة 3 م من غير عتب لازم تخصم الارتفاع كله')
    r = room({ openings: [{ id: 1, kind: 'pass', side: 'S', c: 0, width: 2, sill: 0.95, to: 2, own: true }] })
    ok(near(line(r, 'wall').net, 14 * 2.8 - 2 * (2.1 - 0.95), 1e-6), 'البار لازم يخصم من فوق الجلسة بس')
    ok(near(line(r, 'skirt').net, 14, 1e-6), 'البار مش بيقطع الوزرة')
    // إضاءة السقف
    r = room({ ceiling: ccfg({ type: 'cove', led: 'warm', spots: 'perimeter', chandelier: true }) })
    const spots = CE.spotPositions(4 - 0.24, 3 - 0.24, 'perimeter', 'cove').length
    const ls = R.roomLines(r, 'mid')
    ok(near(ls.find((x: any) => x.label === 'السبوت لايت').net, spots), 'عدد السبوتات في التقرير مختلف عن الرسم')
    ok(near(ls.find((x: any) => x.label === 'شريط LED مخفي').net, CE.ledLength(4, 3, 'cove')), 'طول LED')
    ok(ls.some((x: any) => x.label === 'نجفة'), 'النجفة مش في التقرير')
    // شكل التكلفة عبر الفئات
    for (const [mat, lay] of [['por-plain', 'straight'], ['hdf', 'herringbone'], ['mar-natural', 'diagonal']] as any) {
      const costs = BUD.map((b) => R.roomCost(room({ floor: fcfg({ material: mat, layout: lay }) }), b))
      ok(costs[0] <= costs[1] && costs[1] <= costs[2], `التكلفة مش مرتبة اقتصادي<متوسط<فاخر (${mat})`)
    }
    // الفرش
    r = room({ fon: false, furniture: [{ id: 5, kind: 'sofa', x: 0, y: 0, z: 0, rot: 0 }] })
    ok(near(R.roomCost(r, 'mid'), R.roomCost(room(), 'mid'), 0.01), 'الفرش بيتحسب وهو مقفول')
    r = room({ fon: true, furniture: [{ id: 5, kind: 'sofa', x: 0, y: 0, z: 0, rot: 0 }] })
    ok(near(R.roomCost(r, 'mid') - R.roomCost(room(), 'mid'), F.FURN.sofa.price[1], 0.01), 'سعر الكنبة مش بيتضاف صح')
    // إعادة التصدير
    if (PR) ok(near(PR.totalCost([room()], 'mid'), R.totalCost([room()], 'mid'), 0.01), 'pricing.ts و report.ts طالعين أرقام مختلفة')
  })

  // ===== 5) فحص شامل لأرقام التقرير على كل الشقق مع تشطيبات عشوائية =====
  if (R && C && W && CE) await section('5. فحص أرقام التقرير (قيم سالبة/NaN/اتساق) مع تشطيبات عشوائية', () => {
    const rnd = rng(42)
    const pick = (arr: any[]) => arr[Math.floor(rnd() * arr.length)]
    let nApt = 0
    for (const t of TEMPLATES) for (let k = 0; k < 4; k++) {
      const a = makeApt(t.id, t.nominal, t.ratio, 'S', pick(['closed', 'bar', 'open'])); nApt++
      for (const rm of a.rooms) {
        const fm = pick(C.FLOOR_MATERIALS), lay = pick(C.allowedLayouts(fm)), ct = pick(CE.CEILING_TYPES).id
        const wm = pick(W.WALL_MATERIALS)
        a.finish[rm.id] = {
          wall: { color: '#D9C7A8', finish: pick(['matt', 'satin', 'gloss']), accent: { side: rnd() < 0.5 ? pick(SIDES) : null, material: wm.id, color: wm.base }, dado: { on: rnd() < 0.5, height: pick([0.9, 1.2, 1.5, 2.1]), material: rnd() < 0.5 ? pick(W.WALL_MATERIALS).id : '', color: '#fff' }, skirt: { height: pick([0.07, 0.1, 0.15, 0.2]), color: '#fff' } },
          floor: { material: fm.id, color: fm.base, layout: lay, groutColor: '#C9C5BC', groutMm: 3 },
          ceiling: { type: ct, material: pick(CE.allowedMaterials(ct)), color: '#F6F4EF', led: pick(['off', 'warm']), spots: pick(['none', 'grid', 'perimeter']), chandelier: rnd() < 0.3, cornice: CE.supportsCornice(ct) ? pick(['none', 'simple', 'classic']) : 'none' },
        }
      }
      a.furnOn = true; const v0 = A.buildViews(a, 'modern'); F.autoFurnishAll(a, v0)
      const views = A.buildViews(a, 'modern')
      const doorIds = new Set(a.openings.filter((o: any) => o.kind === 'door').map((o: any) => o.id)), winIds = new Set(a.openings.filter((o: any) => o.kind === 'window').map((o: any) => o.id))
      let doorLines = 0, winLines = 0
      for (const b of BUD) {
        let sum = 0
        for (const v of views) {
          const q = R.roomQuantities(v), ls = R.roomLines(v, b)
          for (const x of Object.values(q) as any[]) if (!finite(x) || x < -1e-9) fail(`كمية غير سليمة في ${v.name}`, `${t.id}`)
          const per = 2 * (v.w + v.d)
          ok(q.paint >= 0 && q.paint <= per * v.h + 2 * v.columns.length * 0.6 * v.h + 1e-6, `مساحة دهان ${q.paint.toFixed(1)} أكبر من مساحة الحيطان الكلية في ${v.name}`, t.id)
          ok(near(q.floorNet + q.colArea, (v.cw ?? v.w) * (v.cd ?? v.d), 1e-6), 'صافي الأرضية + الأعمدة ≠ المساحة الصافية', t.id)
          ok(q.skirting >= 0 && q.skirting <= per + 4 * 0.6 * v.columns.length + 1e-6, `طول الوزرة غير منطقي في ${v.name}`, t.id)
          let rc = 0
          for (const x of ls) {
            ok(finite(x.cost) && x.cost >= 0 && finite(x.qty) && x.qty >= 0 && finite(x.price) && x.price >= 0, `بند غير سليم: ${x.label} في ${v.name}`, t.id)
            ok(x.waste >= 1, `هدر أقل من 1 في ${x.label}`, t.id)
            ok(near(x.cost, x.qty * x.price, 1e-6) && near(x.qty, x.net * x.waste, 1e-6), `${x.label}: cost ≠ qty×price أو qty ≠ net×waste`, t.id)
            rc += x.cost
            if (b === 'mid' && x.cat === 'openings') { if (x.unit === 'قطعة') doorLines++; else winLines++ }
          }
          ok(near(rc, R.roomCost(v, b), 1e-6), 'مجموع بنود الغرفة ≠ roomCost', t.id)
          sum += rc
        }
        ok(near(sum, R.totalCost(views, b), 1e-4), 'مجموع الغرف ≠ totalCost', t.id)
        if (PR) ok(near(sum, PR.totalCost(views, b), 1e-4), 'شريط التكلفة (pricing) مختلف عن التقرير', t.id)
      }
      if (OP && R.CAT_NAMES.openings) {
        ok(doorLines === doorIds.size, `عدد الأبواب في التقرير ${doorLines} ≠ عدد الأبواب ${doorIds.size}`, t.id)
        ok(winLines === winIds.size, `عدد الشبابيك في التقرير ${winLines} ≠ عدد الشبابيك ${winIds.size}`, t.id)
      }
      const costs = BUD.map((b) => R.totalCost(views, b)); ok(costs[0] <= costs[1] && costs[1] <= costs[2], 'التكلفة الكلية مش مرتبة حسب الفئة', t.id)
    }
    console.log(`   (${nApt} شقة بتشطيبات عشوائية)`)
    // جدول مرجعي: تكلفة المتر لكل نموذج بتشطيبه الافتراضي (للمراجعة العينية)
    console.log('   تكلفة النماذج بتشطيبها الافتراضي (من غير فرش):')
    for (const t of TEMPLATES) {
      const a = makeApt(t.id, t.nominal, t.ratio, 'S', t.kitchen), views = A.buildViews(a, 'modern')
      const cs = BUD.map((b) => R.totalCost(views, b)), per = cs.map((c) => Math.round(c / t.nominal))
      console.log(`     ${t.id} ${t.nominal}م²: ${cs.map((c) => Math.round(c).toLocaleString()).join(' / ')} ج  (${per.join(' / ')} ج/م²)`)
      per.forEach((p) => { if (p < 600 || p > 12000) warn(`تكلفة المتر ${p} ج غير معتادة (${t.id})`) })
    }
  })

  // ===== 6) الفرش =====
  if (F) await section('6. الفرش (التموضع والتصادم والمحتوى والتكلفة)', () => {
    for (const t of TEMPLATES) for (const [front, kit] of [['S', t.kitchen], ['N', 'open'], ['W', 'closed']] as any) {
      const tag = `${t.id} شارع=${front} مطبخ=${kit}`
      const a = makeApt(t.id, t.nominal, t.ratio, front, kit)
      a.furnOn = true
      F.autoFurnishAll(a, A.buildViews(a, 'modern'))
      const views = A.buildViews(a, 'modern')
      for (const v of views) {
        const items = a.furniture[v.id] ?? [], n = F.inner(v)
        const roleOf = (i: any) => F.FURN[i.kind]?.role ?? i.kind
        for (const it of items) {
          const d = F.FURN[it.kind]
          if (!ok(d, `نوع فرش مش موجود ${it.kind}`, tag)) continue
          const b = F.boxOf(d, it)
          if (b.x0 < n.x0 - 0.01 || b.x1 > n.x1 + 0.01 || b.z0 < n.z0 - 0.01 || b.z1 > n.z1 + 0.01) fail(`${d.name} طالعة برّه ${v.name}`, tag)
          if (!d.rug && !d.acc) {
            const why = F.blocked(v, d, it, F.obstacles(v, views, items, it.id))
            if (why) fail(`${d.name} في ${v.name} بتخبط في ${why === 'wall' ? 'الحيطة' : why.kind}`, tag)
          }
          if (d.acc) {
            const host = items.find((x: any) => x.id === it.host)
            if (!host) { if (!(it.y > 0)) fail(`إكسسوار ${d.name} من غير سطح`, tag) }
            else { const hd = F.FURN[host.kind]; ok(hd.surf && near(it.y, host.y + hd.surf[2], 0.01), `إكسسوار ${d.name} مش على ارتفاع سطح ${hd.name}`, tag) }
          }
          if (!d.rug && !d.acc && !d.wall) continue
        }
        const solid = items.filter((i: any) => { const d = F.FURN[i.kind]; return d && !d.rug && !d.acc })
        for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
          const p = F.boxOf(F.FURN[solid[i].kind], solid[i]), q = F.boxOf(F.FURN[solid[j].kind], solid[j])
          const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), h = Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0)
          if (w > 0.02 && h > 0.02) fail(`${F.FURN[solid[i].kind].name} و ${F.FURN[solid[j].kind].name} متداخلين في ${v.name}`, tag)
        }
        const has = (...ks: string[]) => items.some((i: any) => ks.includes(roleOf(i)))
        const need = (c: boolean, what: string) => { if (!c) warn(`${v.name} (${v.w.toFixed(1)}×${v.d.toFixed(1)}) من غير ${what}`, tag) }
        if (v.type === 'living') {
          if (/سفرة/.test(v.name)) need(has('dining'), 'سفرة')
          else if (!/ركن جلوس/.test(v.name)) { need(has('sofa'), 'كنبة'); need(has('tvunit'), 'تلفزيون') }
          else need(has('sofa'), 'كنبة')
        } else if (v.type === 'bed') { need(has('bed', 'bedS'), 'سرير'); need(has('wardrobe'), 'دولاب') }
        else if (v.type === 'kitchen') { need(has('kitchenrun'), 'وحدات مطبخ'); need(has('fridge'), 'ثلاجة') }
        else if (v.type === 'bath') { need(has('toilet'), 'مرحاض'); need(has('vanity'), 'حوض'); need(has('shower'), 'دش') }
        if (v.fon !== true) fail('furnOn مش بيوصل للـRoomView', tag)
        const cost = F.furnCost({ ...v, furniture: items, fon: true }, 'mid')
        ok(near(cost, items.reduce((s: number, i: any) => s + (F.FURN[i.kind]?.price[1] ?? 0), 0), 1e-6), 'furnCost مش بيساوي مجموع الأسعار', tag)
      }
    }
    // الالتصاق والتصادم
    const a = makeApt('T120', 120, 1.25, 'S', 'closed'), views = A.buildViews(a, 'modern'), v = views.find((x: any) => x.type === 'living')
    a.furnOn = true; F.furnishRoom(a, v, views)
    const sofa = (a.furniture[v.id] ?? []).find((i: any) => F.FURN[i.kind].role === 'sofa' || i.kind === 'sofa')
    if (sofa) {
      const d = F.FURN[sofa.kind], n = F.inner(v)
      const t0 = { ...sofa, x: n.x1 - 0.1 - d.d / 2 - 0.05, z: 0, rot: Math.PI / 2 * 3 }
      const sn = F.snapToWall(v, d, { ...t0, rot: 0, x: n.x1 - d.w / 2 - 0.1, z: 0 })
      const bx = F.boxOf(d, sn)
      ok(near(bx.x1, n.x1, 0.01) || near(bx.x0, n.x0, 0.01) || near(bx.z0, n.z0, 0.01) || near(bx.z1, n.z1, 0.01), 'الالتصاق بالحيطة مش بيلزق القطعة')
      const far = F.snapToWall(v, d, { ...sofa, x: 0, z: 0, rot: 0 })
      ok(near(far.x, 0, 1e-9) && near(far.z, 0, 1e-9), 'قطعة بعيدة عن الحيطة اتحركت من غير سبب')
    }
  })

  // ===== 7) الأعمدة =====
  if (COL && F) await section('7. الأعمدة (التحقق، الخصم، تأثيرها على الفرش)', () => {
    const a = makeApt('T120', 120, 1.25, 'S', 'closed'), living = a.rooms.find((r: any) => r.type === 'living')
    ok(COL.addColumn(a, living.id) === null, 'addColumn فشل على ريسبشن عادي')
    const c = a.columns[0]
    if (c) {
      ok(COL.columnError(a, { ...c, w: 0.05 }) !== null, 'عمود عرضه 5 سم المفروض يترفض')
      ok(COL.columnError(a, { ...c, d: 0.9 }) !== null, 'بروز 90 سم المفروض يترفض')
      ok(COL.columnError(a, { ...c, offset: -1 }) !== null, 'عمود خارج الحيطة المفروض يترفض')
      const views = A.buildViews(a, 'modern'), v = views.find((x: any) => x.id === living.id)
      ok(v.columns.length === 1, 'العمود مش بيوصل للـRoomView')
      if (R) { const q = R.roomQuantities(v); ok(near(q.floorNet, (v.cw ?? v.w) * (v.cd ?? v.d) - c.w * c.d, 1e-6), 'الأرضية مش بتخصم العمود') }
      a.furnOn = true; F.autoFurnishAll(a, views)
      const views2 = A.buildViews(a, 'modern'), v2 = views2.find((x: any) => x.id === living.id), cb = F.columnBox(v2, c)
      for (const it of a.furniture[v2.id] ?? []) {
        const d = F.FURN[it.kind]; if (d.rug || d.acc) continue
        const b = F.boxOf(d, it)
        if (Math.min(b.x1, cb.x1) - Math.max(b.x0, cb.x0) > 0.01 && Math.min(b.z1, cb.z1) - Math.max(b.z0, cb.z0) > 0.01) fail(`${d.name} بتخترق العمود`)
      }
      // أعمدة كتير على نفس الحيطة
      const before = a.columns.length
      for (let i = 0; i < 6; i++) COL.addColumn(a, living.id)
      ok(a.columns.length > before && a.columns.length <= 8, 'إضافة أعمدة كتير بتعمل حاجة غريبة')
      const views3 = A.buildViews(a, 'modern'); F.autoFurnishAll(a, views3)
      ok(true, '')
    }
  })

  // ===== 8) الكتالوجات =====
  await section('8. الكتالوجات (أسعار، مقاسات، ألوان، قواعد الغرف)', () => {
    const hex = /^#[0-9a-fA-F]{6}$/
    const monotonic = (arr: number[], what: string) => ok(Array.isArray(arr) && arr.length === 3 && arr.every(finite) && arr[0] > 0 && arr[0] <= arr[1] && arr[1] <= arr[2], `أسعار الفئات غير مرتبة أو ناقصة: ${what} = ${JSON.stringify(arr)}`)
    if (C) {
      const ids = new Set()
      for (const m of C.FLOOR_MATERIALS) {
        ok(!ids.has(m.id), `معرّف أرضية مكرر ${m.id}`); ids.add(m.id)
        monotonic(m.price, 'أرضية ' + m.name)
        ok(m.size[0] > 0 && m.size[1] > 0 && m.size[0] <= 2.5 && m.size[1] <= 2.5, `مقاس بلاطة غير معقول ${m.name}`)
        ok(m.rough >= 0 && m.rough <= 1, `لمعة خارج 0..1 ${m.name}`)
        ok(hex.test(m.base), `لون أساسي مش hex ${m.name}`); (m.swatches ?? []).forEach((s: any) => ok(hex.test(s.hex), `لون مش hex في ${m.name}`))
        ok(['ok', 'avoid', 'no'].includes(m.wet), `قيمة wet غريبة ${m.name}`)
        const lays = C.allowedLayouts(m); ok(lays.includes(C.defaultLayout(m)), `النمط الافتراضي مش مسموح في ${m.name}`)
        const ws = lays.map((l: string) => C.wasteOf(m, l)); ok(ws.every((w: number) => w >= 1 && w <= 1.3), `هدر غير معقول ${m.name}`)
        for (const rt of ['bath', 'kitchen', 'living', 'bed']) { const s = C.suit(m, rt); ok(['good', 'warn', 'bad'].includes(s.level) && s.msg, `suit بيرجّع قيمة غريبة (${m.name}/${rt})`) }
      }
      const bad = C.FLOOR_MATERIALS.filter((m: any) => m.wet === 'no'); bad.forEach((m: any) => ok(C.suit(m, 'bath').level === 'bad', `${m.name} مش بتتحذّر في الحمام`))
      ok(C.PALETTE.every((h: string) => hex.test(h)), 'لوحة الألوان فيها كود غلط')
    }
    if (W) {
      for (const m of W.WALL_MATERIALS) { monotonic(m.price, 'حيطة ' + m.name); ok(m.tile > 0, `tile غير سليم ${m.name}`); ok(hex.test(m.base), `لون ${m.name}`) }
      ok(Object.values(W.FINISHES).every((f: any) => f.factor >= 1), 'معامل لمعة الدهان أقل من 1')
      W.PAINT_GROUPS.forEach((g: any) => g.colors.forEach((c: string) => ok(hex.test(c), `لون دهان غلط ${c}`)))
    }
    if (CE) {
      for (const t of CE.CEILING_TYPES) monotonic(t.price, 'سقف ' + t.name)
      for (const k of Object.keys(CE.MATERIALS)) ok(CE.MATERIALS[k].factor > 0, `معامل خامة سقف ${k}`)
      const flat = { type: 'flat', material: 'gypsum', color: '#fff', led: 'off', spots: 'none', chandelier: false, cornice: 'none' }
      ok(CE.suitCeiling(flat, 'bath', 5, 2.8).level === 'bad', 'جبسوم عادي في الحمام لازم يتحذّر')
      for (const type of CE.CEILING_TYPES.map((t: any) => t.id)) for (const room of ['bath', 'kitchen']) {
        const safe = CE.safeFor({ ...flat, type }, room); ok(CE.suitCeiling(safe, room, 6, 2.8).level !== 'bad', `safeFor مش بيطلّع سقف مناسب (${type}/${room})`)
      }
      const sp = CE.spotPositions(4, 3, 'grid', 'flat'); ok(sp.every(([x, z]: any) => Math.abs(x) < 2 && Math.abs(z) < 1.5), 'سبوتات برّه الغرفة')
    }
    if (F) {
      for (const [k, d] of Object.entries(F.FURN) as any) {
        monotonic(d.price, 'فرش ' + d.name)
        ok(d.w > 0 && d.d > 0 && d.h > 0 && d.w < 6 && d.d < 6 && d.h < 3.2, `مقاس فرش غير معقول ${d.name}`)
        ok(d.rooms.length > 0, `قطعة من غير غرف: ${d.name}`)
        if (d.surf) ok(d.surf[0] <= d.w + 1e-9 && d.surf[1] <= d.d + 1e-9 && d.surf[2] <= d.h + 1e-9, `سطح ${d.name} أكبر من القطعة`)
        if (d.role) ok(F.BASE[d.role], `${d.name}: role غير موجود`)
      }
    }
    if (OP) {
      for (const d of Object.values(OP.OPEN) as any[]) { monotonic(d.price, 'باب/شباك ' + d.name); ok(hex.test(d.color), `لون ${d.name}`) }
      for (const role of ['entrance', 'interior', 'bath', 'window']) {
        const kind = role === 'window' ? 'window' : 'door', p = OP.pickStyle(kind, role, {}, {}, 1)
        ok(p.def && p.def.kind === kind, `الافتراضي لـ${role} مش من النوع الصح`)
        ok(OP.styleList(kind, role).length > 0, `مفيش أنواع متاحة لـ${role}`)
      }
      ok(OP.doorRole('bath', 3, 'hall') === 'bath' && OP.doorRole('bed', 3, 'bath') === 'bath' && OP.doorRole('living', null) === 'entrance' && OP.doorRole('bed', 3, 'hall') === 'interior', 'تصنيف الأبواب (doorRole) غلط')
    }
  })

  // ===== 9) عمليات متنوعة =====
  await section('9. عمليات متنوعة (تبديل النموذج، المساحة، النسبة، الفتحات)', () => {
    const a = A.defaultApartment()
    for (const area of [50, 60, 75, 90, 100, 120, 150, 175, 200, 250, 300, 380, 420, 500]) {
      A.setArea(a, area); geometry(a, `setArea ${area}`); openingsCheck(a, `setArea ${area}`)
      ok(a.area >= 50 && a.area <= 420, `المساحة خارج المدى بعد setArea(${area})`)
    }
    for (const r of [0.7, 1, 1.45, 2, 0.3]) { A.setRatio(a, r); geometry(a, `ratio ${r}`) }
    for (const k of ['closed', 'bar', 'open', 'closed']) { A.setKitchen(a, k); openingsCheck(a, 'kitchen ' + k); logicCheck(a, 'kitchen ' + k) }
    for (const t of TEMPLATES) { A.setTemplate(a, t.id); geometry(a, 'setTemplate ' + t.id) }
    const e = A.setMode(a, 'custom'); geometry(a, 'custom default'); openingsCheck(a, 'custom default'); logicCheck(a, 'custom default')
    for (const shape of ['rect', 'square', 'L', 'U']) for (const front of ['S', 'N', 'W', 'E']) {
      A.setFootprint(a, { shape, front, mirror: front === 'W' }); const tag = `custom ${shape} شارع=${front}`
      geometry(a, tag); openingsCheck(a, tag); logicCheck(a, tag)
    }
    // إضافة وحذف فتحات يدوي
    A.setMode(a, 'template'); A.setTemplate(a, 'T120')
    for (const rm of a.rooms) {
      const e1 = A.addDefaultOpening(a, rm.id, 'door'), e2 = A.addDefaultOpening(a, rm.id, 'window')
      openingsCheck(a, 'addDefaultOpening ' + rm.name)
      if (typeof e1 === 'string' && typeof e2 === 'string') continue
    }
    const o = a.openings[0]; if (o) { const r = A.updateOpening(a, o.id, { width: 9 }); ok(typeof r === 'string', 'عرض فتحة 9 م المفروض يترفض') }
  })

  // ===== 10) الأبعاد الصافية وسمك الحيطان =====
  if (R) await section('10. الأبعاد الصافية وسمك الحيطان', () => {
    for (const t of TEMPLATES) {
      const a = makeApt(t.id, t.nominal, t.ratio, 'S', t.kitchen)
      ok(a.wallExt === 0.25 && a.wallInt === 0.12, 'سمك الحيطان الافتراضي مش 25/12', t.id)
      const views = A.buildViews(a, 'modern')
      let clear = 0, gross = 0
      for (const v of views) {
        ok(v.cw > 0 && v.cd > 0 && v.cw <= v.w + 1e-9 && v.cd <= v.d + 1e-9, `صافي ${v.name} غير منطقي`, t.id)
        ok(v.cw >= v.w - 2 * a.wallExt - 1e-9 && v.cd >= v.d - 2 * a.wallExt - 1e-9, `فاقد ${v.name} أكبر من سمك الخارجية`, t.id)
        clear += v.cw * v.cd; gross += v.w * v.d
      }
      const ratio = clear / gross
      ok(ratio > 0.8 && ratio < 0.98, `نسبة الصافي ${ratio.toFixed(3)} غير معتادة`, t.id)
      // غرفة داخلية بالكامل: الفاقد نص سمك الحيطة الداخلية من كل ناحية
      const inner = views.find((v: any) => A.exteriorIntervals(a.rooms, a.rooms.find((r: any) => r.id === v.id), 'N').length === 0
        && ['S', 'E', 'W'].every((s) => A.exteriorIntervals(a.rooms, a.rooms.find((r: any) => r.id === v.id), s).length === 0))
      if (inner) ok(near(inner.cw, inner.w - 0.12, 1e-6) && near(inner.cd, inner.d - 0.12, 1e-6), 'غرفة داخلية: الصافي لازم ينقص سمك الحيطة الداخلية', t.id)
      // سماكة أكبر = أرضية أقل = تكلفة أقل
      const c1 = R.totalCost(views, 'mid')
      A.setWalls(a, 0.4, 0.2)
      const c2 = R.totalCost(A.buildViews(a, 'modern'), 'mid')
      ok(c2 < c1, 'زيادة سمك الحيطان لازم تقلل الكميات والتكلفة', t.id)
    }
  })

  // ===== 11) القسم المالي =====
  const FI = await load('../src/data/finance')
  if (R && FI && C) await section('11. القسم المالي (توريد + مصنعية + مواد، مصاريف، هامش، سعر العقد)', () => {
    const { FIN } = FI
    const keep = JSON.stringify(FIN)
    const wcfg = { color: '#F3F3F0', finish: 'matt', accent: { side: null, material: 'wood-slats', color: '#A9784F' }, dado: { on: false, height: 1.2, material: '', color: '#fff' }, skirt: { height: 0.1, color: '#fff' } }
    const room = {
      id: 1, type: 'living', name: 'اختبار', x: 0, y: 0, w: 4, d: 3, h: 2.8, wall: wcfg, ceiling: { type: 'flat', material: 'gypsum', color: '#fff', led: 'off', spots: 'none', chandelier: false, cornice: 'none' },
      floor: { material: 'por-plain', color: '#D8D3CA', layout: 'straight', groutColor: '#C9C5BC', groutMm: 3 },
      openings: [], columns: [], furniture: [], fon: false, fabric: '#CDBFA6', wood: '#A9784F', ofin: {}, odef: {},
    }
    // سعر الوحدة = توريد + مصنعية + مواد
    for (const [b, i] of [['economy', 0], ['mid', 1], ['luxury', 2]] as any) {
      const l = R.roomLines(room, b).find((x: any) => x.cat === 'floor')
      const supply = C.priceOf(C.byId('por-plain'), b), labor = FIN.labor.floor[i], cons = supply * FIN.cons.floor
      ok(near(l.parts.supply, supply) && near(l.parts.labor, labor) && near(l.parts.cons, cons, 1e-9), `مكونات سعر الأرضية غلط (${b})`)
      ok(near(l.price, supply + labor + cons, 1e-9), `سعر الوحدة ≠ توريد + مصنعية + مواد (${b})`)
      ok(near(l.cost, l.qty * (supply + labor + cons), 1e-6), `تكلفة البند غلط (${b})`)
    }
    // المصاريف والهامش وسعر العقد
    const dc = R.totalCost([room], 'mid')
    FIN.indirect = 0.1; FIN.margin = 0
    let T = R.projectTotals([room], 'mid')
    ok(near(T.dc, dc, 1e-6) && near(T.supply + T.labor + T.cons, T.dc, 1e-6), 'DC ≠ توريد + مصنعية + مواد')
    ok(near(T.ic, dc * 0.1, 1e-6) && near(T.price, dc * 1.1, 1e-6), 'سعر العقد بهامش صفر لازم = DC × 1.1')
    FIN.margin = 0.2
    T = R.projectTotals([room], 'mid')
    ok(near(T.price, dc * 1.1 * 1.2, 1e-6), `سعر العقد (${T.price}) ≠ (DC + مصاريف) × (1 + هامش)`)
    ok(near(R.grandTotal([room], 'mid'), T.price, 1e-6), 'grandTotal ≠ projectTotals.price')
    ok(T.price >= T.sub && T.sub >= T.dc, 'ترتيب DC ≤ قبل الهامش ≤ السعر مكسور')
    // المصنعية والمواد بترفع التكلفة
    const mt = JSON.parse(keep); FIN.labor.floor = [0, 0, 0]; FIN.cons.floor = 0
    const noExtras = R.roomLines(room, 'mid').find((x: any) => x.cat === 'floor').cost
    FIN.labor.floor = mt.labor.floor; FIN.cons.floor = mt.cons.floor
    ok(R.roomLines(room, 'mid').find((x: any) => x.cat === 'floor').cost > noExtras, 'المصنعية والمواد المساعدة مش بتزوّد تكلفة الأرضية')
    // الفرش من غير مصنعية ومواد
    ok(FIN.labor.furn.every((v: number) => v === 0) && FIN.cons.furn === 0, 'الفرش المفروض من غير مصنعية ومواد (افتراضي)')
    // قيم الجداول
    for (const k of Object.keys(FIN.labor)) { const a = FIN.labor[k]; ok(a.length === 3 && a[0] <= a[1] && a[1] <= a[2] && a.every(finite), `مصنعية ${k} غير مرتبة`) }
    for (const k of Object.keys(FIN.cons)) ok(finite(FIN.cons[k]) && FIN.cons[k] >= 0 && FIN.cons[k] <= 0.5, `نسبة مواد ${k} غير معقولة`)
    // كل بنود التقرير في كل النماذج
    for (const t of TEMPLATES) {
      const a = makeApt(t.id, t.nominal, t.ratio, 'S', t.kitchen), views = A.buildViews(a, 'modern')
      for (const b of BUD) {
        const P = R.projectTotals(views, b)
        ok(near(P.price, (P.dc + P.dc * FIN.indirect) * (1 + FIN.margin), 1e-4), 'سعر العقد غلط على الشقة كلها', t.id)
        ok(near(P.supply + P.labor + P.cons, P.dc, 1e-4), 'مجموع المكونات ≠ DC على الشقة كلها', t.id)
      }
    }
    Object.assign(FIN, JSON.parse(keep)) // رجوع للقيم الأصلية
  })

  // ===== 12) حفظ المشروع =====
  const P = await load('../src/project'), ST = await load('../src/state')
  if (P && ST && R) await section('12. حفظ المشروع (رحلة كاملة، ملفات تالفة، عشوائي)', () => {
    const S = ST.session, keep = { apt: S.apt, style: S.style, budget: S.budget, mode: S.mode, name: S.name }
    const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, canon(v[k])])) : v
    const rnd = rng(77)
    const rich = (id: string) => {
      const a = makeApt(id, TEMPLATES.find((t: any) => t.id === id).nominal, TEMPLATES.find((t: any) => t.id === id).ratio, 'S', 'open')
      a.furnOn = true
      const v0 = A.buildViews(a, 'modern'); F.autoFurnishAll(a, v0)
      if (COL) COL.addColumn(a, a.rooms[0].id)
      A.buildViews(a, 'modern').forEach((v: any) => A.setFinish(a, v, {}))
      return a
    }
    try {
      // 1) رحلة كاملة: نفس الشقة ونفس التكلفة بعد الحفظ والاستيراد
      for (const t of TEMPLATES) {
        const a = rich(t.id)
        S.apt = a; S.style = 'warm'; S.budget = 'mid'; S.name = 'تجربة'
        const r = P.parseProject(JSON.stringify(P.snapshot()))
        if (!ok(r.ok, 'استيراد ملف سليم فشل: ' + r.error, t.id)) continue
        const b = r.file.data.apt
        for (const k of ['rooms', 'openings', 'columns', 'furniture', 'finish', 'openFin', 'odef']) ok(JSON.stringify(canon(b[k])) === JSON.stringify(canon(a[k])), `${k} اتغيّر بعد الحفظ والاستيراد`, t.id)
        ok(r.warnings.length === 0, 'تحذيرات مش متوقعة: ' + r.warnings.join(' | '), t.id)
        ok(r.file.data.style === 'warm' && r.file.data.budget === 'mid' && r.file.name === 'تجربة', 'الستايل أو الميزانية أو الاسم اتغيّروا', t.id)
        const t1 = R.grandTotal(A.buildViews(a, 'warm'), 'mid'), t2 = R.grandTotal(A.buildViews(b, 'warm'), 'mid')
        ok(near(t1, t2, 1e-6), `التكلفة اتغيّرت بعد الاستعادة ${t1} → ${t2}`, t.id)
        const ids: number[] = [...b.rooms.map((x: any) => x.id), ...b.openings.map((x: any) => x.id), ...b.columns.map((x: any) => x.id), ...Object.values(b.furniture).flat().map((x: any) => x.id)]
        ok(new Set(ids).size === ids.length && b.nextId > Math.max(...ids), 'أرقام العناصر مكررة أو nextId صغير', t.id)
      }
      // 2) ملفات غلط معروفة
      const text = JSON.stringify((S.apt = rich('T120'), P.snapshot()))
      const base = () => JSON.parse(text)
      const tryParse = (t: string, what: string) => { try { return P.parseProject(t) } catch (e: any) { fail(`parseProject رمى استثناء (${what}): ${e.message}`); return null } }
      const expect = (what: string, t: string, okExp: boolean) => { const r = tryParse(t, what); if (r) ok(r.ok === okExp, `${what}: النتيجة ${r.ok} والمتوقع ${okExp}`); return r }
      expect('مش JSON', 'مش ملف', false); expect('كائن فاضي', '{}', false)
      expect('format غلط', JSON.stringify({ ...base(), format: 'x' }), false)
      expect('نسخة أحدث', JSON.stringify({ ...base(), version: 999 }), false)
      expect('من غير بيانات', JSON.stringify({ ...base(), data: null }), false)
      const noRooms = base(); noRooms.data.apt.rooms = []; expect('من غير غرف', JSON.stringify(noRooms), false)
      const nanRoom = base(); nanRoom.data.apt.rooms[0].w = null; const r1 = expect('غرفة بعرض null', JSON.stringify(nanRoom), true)
      if (r1?.ok) ok(r1.file.data.apt.rooms.length === base().data.apt.rooms.length - 1 && r1.warnings.length > 0, 'الغرفة التالفة لازم تتشال مع تحذير')
      const unknownFurn = base(); const rid = Object.keys(unknownFurn.data.apt.furniture)[0]
      if (rid) {
        unknownFurn.data.apt.furniture[rid].push({ id: 99999, kind: 'ghost-kind', x: 0, z: 0, rot: 0, y: 0 })
        const r2 = expect('قطعة فرش مجهولة', JSON.stringify(unknownFurn), true)
        if (r2?.ok) { ok(!Object.values(r2.file.data.apt.furniture).flat().some((i: any) => i.kind === 'ghost-kind'), 'القطعة المجهولة لازم تتشال'); ok(r2.warnings.some((w: string) => w.includes('فرش')), 'لازم يظهر تحذير الفرش') }
      }
      const badFloor = base(); const fid = Object.keys(badFloor.data.apt.finish)[0]
      if (fid) { badFloor.data.apt.finish[fid].floor.material = 'ghost-floor'; badFloor.data.apt.finish[fid].floor.layout = 'zzz'; badFloor.data.apt.finish[fid].ceiling.type = 'zzz'
        const r3 = expect('خامات مجهولة', JSON.stringify(badFloor), true)
        if (r3?.ok) { const f = r3.file.data.apt.finish[fid]; ok(f.floor.material !== 'ghost-floor' && A.buildViews(r3.file.data.apt, 'modern').length > 0, 'الخامة المجهولة لازم تتبدل') } }
      const dupe = base(); dupe.data.apt.rooms.push({ ...dupe.data.apt.rooms[0] }); const r4 = expect('غرفة مكررة الرقم', JSON.stringify(dupe), true)
      if (r4?.ok) ok(new Set(r4.file.data.apt.rooms.map((x: any) => x.id)).size === r4.file.data.apt.rooms.length, 'أرقام الغرف لازم تفضل فريدة')
      const huge = base(); huge.data.apt.height = 1e9; huge.data.apt.area = -5; huge.data.apt.wallExt = 99; const r5 = expect('قيم هائلة', JSON.stringify(huge), true)
      if (r5?.ok) ok(r5.file.data.apt.height <= 4 && r5.file.data.apt.area >= 50 && r5.file.data.apt.wallExt <= 0.6, 'القيم الهائلة لازم تتقصّ')
      // 3) تخريب عشوائي: ممنوع أي انهيار، وأي ملف يتقبل لازم يشتغل بعدها
      const GARBAGE: any[] = [null, 'x', -5, 1e9, 0, true, [], {}, '#zzzzzz', 3.14159, 'N', 'matt', -1, 'kitchen']
      const mutate = (obj: any, n: number) => {
        const paths: any[][] = []
        const walk = (v: any, p: any[]) => { if (v && typeof v === 'object') for (const k of Object.keys(v)) { paths.push([...p, k]); walk(v[k], [...p, k]) } }
        walk(obj, [])
        for (let i = 0; i < n; i++) {
          const p = paths[Math.floor(rnd() * paths.length)]
          let cur = obj
          for (let j = 0; j < p.length - 1; j++) { cur = cur?.[p[j]]; if (!cur || typeof cur !== 'object') break }
          if (cur && typeof cur === 'object') { if (rnd() < 0.2) delete cur[p[p.length - 1]]; else cur[p[p.length - 1]] = GARBAGE[Math.floor(rnd() * GARBAGE.length)] }
        }
        return obj
      }
      let accepted = 0, rejected = 0
      for (let i = 0; i < 400; i++) {
        const m = mutate(base(), 1 + Math.floor(rnd() * 5)), r = tryParse(JSON.stringify(m), 'عشوائي #' + i)
        if (!r) continue
        if (!r.ok) { rejected++; continue }
        accepted++
        try {
          const b = r.file.data.apt, views = A.buildViews(b, r.file.data.style)
          A.analyze(b)
          for (const bu of BUD) { const T = R.projectTotals(views, bu); if (![T.dc, T.price].every(finite)) fail('أرقام غير سليمة بعد استيراد ملف مخرّب') }
          views.forEach((v: any) => ok([v.cw, v.cd, v.w, v.d].every(finite) && v.cw > 0, 'أبعاد غير سليمة بعد استيراد ملف مخرّب'))
        } catch (e: any) { fail('انهيار بعد استيراد ملف مخرّب: ' + (e?.message ?? e)) }
      }
      console.log(`   (تخريب عشوائي: ${accepted} اتقبل بعد التنظيف، ${rejected} اترفض)`)
      // 4) حفظ تلقائي وتخزين
      ok(typeof P.exportFileName('مشروع: تجربة/1') === 'string' && !/[\/:]/.test(P.exportFileName('مشروع: تجربة/1')), 'اسم الملف فيه رموز ممنوعة')
    } finally { Object.assign(S, keep) }
  })

  // ===== النتيجة =====
  console.log('\n================ النتيجة ================')
  let totalFail = 0
  for (const [name, s] of secStat) {
    totalFail += s.fail
    console.log(`${s.fail === 0 && !s.crash ? '✅' : '❌'} ${name}  — فحوصات: ${s.checks} | أخطاء: ${s.fail} | تحذيرات: ${s.warn}${s.crash ? ' | انهار!' : ''}`)
  }
  const show = (lvl: Lvl, title: string, max: number) => {
    const all = [...store.values()].filter((e) => e.lvl === lvl).sort((a, b) => b.n - a.n)
    if (!all.length) return
    console.log(`\n---------- ${title} (${all.length} نوع) ----------`)
    let cur = ''
    for (const e of all.slice(0, max)) {
      if (e.sec !== cur) { cur = e.sec; console.log(`\n[${cur}]`) }
      console.log(`  ${e.n}× ${e.msg}${e.ex.length ? '   ← ' + e.ex.join(' ; ') : ''}`)
    }
    if (all.length > max) console.log(`  ... و ${all.length - max} نوع تاني`)
  }
  show('fail', 'أخطاء FAIL', 80)
  show('warn', 'تحذيرات WARN (جودة التخطيط ونواقص، مش بالضرورة أخطاء)', 60)
  console.log(`\nإجمالي الأخطاء: ${totalFail}`)
  process.exit(totalFail ? 1 : 0)
}
main()