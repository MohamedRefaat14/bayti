import type { RoomType } from './apartment'

export type KitchenMode = 'closed' | 'bar' | 'open'

// ورقة (غرفة) أو تقسيم لصف (يمين لشمال) أو عمود (فوق لتحت)
export interface Leaf { t: RoomType; n: string; entry?: boolean; ens?: boolean }
export interface Part { f?: number; m?: number; node: Tree } // f = وزن نسبي | m = مقاس ثابت بالمتر (ممرات وحمامات)
export interface Split { dir: 'row' | 'col'; parts: Part[] }
export type Tree = Leaf | Split

export interface Template {
  id: string; name: string; desc: string
  min: number; max: number; nominal: number // مدى المساحة المناسب والمساحة الأساسية
  ratio: number                             // نسبة عرض الواجهة للعمق
  beds: number; baths: number
  blind: boolean                            // الجانبين ملاصقين لعمارات (من غير شبابيك)
  kitchen: KitchenMode
  tree: Tree
  rmin: number; rmax: number               // مدى نسبة العرض للعمق اللي التوزيع بيفضل سليم جواه
}
export interface Placed { t: RoomType; n: string; x: number; y: number; w: number; d: number; entry?: boolean; ens?: boolean }

const lf = (t: RoomType, n: string, o: { entry?: boolean; ens?: boolean } = {}): Leaf => ({ t, n, ...o })
const R = (...parts: Part[]): Split => ({ dir: 'row', parts })
const C = (...parts: Part[]): Split => ({ dir: 'col', parts })
const f = (w: number, node: Tree): Part => ({ f: w, node })
const m = (meters: number, node: Tree): Part => ({ m: meters, node })

// الشارع تحت. الريسبشن (غرفة المدخل) ملاصق للشارع. الصالة بتتفتح على الريسبشن/السفرة من غير باب،
// وطرفها التاني بينتهي بباب غرفة أو حمام (مفيش طريق مسدود). الحمام الملحق (ens) ملاصق للماستر.
export const TEMPLATES: Template[] = [
  {
    id: 'T75', name: 'نموذج 75 م²: غرفتين', desc: 'ردهة صغيرة بين الغرفتين مفتوحة على السفرة وحمام في آخرها، ريسبشن وسفرة ومطبخ أمريكان.',
    rmin: 0.7, rmax: 1.6, min: 60, max: 90, nominal: 75, ratio: 1.0, beds: 2, baths: 1, blind: true, kitchen: 'open',
    tree: C(
      f(0.5, R(
        f(1.2, lf('bed', 'غرفة نوم رئيسية')),
        m(1.9, C(f(0.5, lf('bath', 'حمام')), f(0.5, lf('hall', 'صالة')))),
        f(1, lf('bed', 'غرفة نوم 2')),
      )),
      f(0.5, R(f(0.42, lf('living', 'ريسبشن', { entry: true })), f(0.3, lf('living', 'سفرة')), f(0.28, lf('kitchen', 'مطبخ')))),
    ),
  },
  {
    id: 'T100', name: 'نموذج 100 م²: غرفتين بحمامين', desc: 'ماستر بحمامه، وصالة بين الحمامين مفتوحة على السفرة، ومطبخ أمريكان فوق ريسبشن عريض.',
    rmin: 0.7, rmax: 1.7, min: 88, max: 110, nominal: 100, ratio: 0.95, beds: 2, baths: 2, blind: false, kitchen: 'open',
    tree: C(
      f(0.4, R(f(1.25, lf('bed', 'غرفة نوم رئيسية')), f(1, lf('bed', 'غرفة نوم 2')))),
      m(2.2, R(m(1.9, lf('bath', 'حمام الماستر', { ens: true })), f(1, lf('hall', 'صالة')), m(1.7, lf('bath', 'حمام عام')))),
      f(0.6, C(
          f(0.6, R(f(0.28, lf('kitchen', 'مطبخ')),
           f(0.3, lf('living', 'سفرة')), f(0.42, lf('living', 'ريسبشن', { entry: true })))),
      )),
    ),
  },
  {
    id: 'T120', name: 'نموذج 120 م²: 3 غرف', desc: 'صالة بين صف الغرف والريسبشن، بين حمامين، مفتوحة على السفرة، ومطبخ بفتحة بار.',
    rmin: 0.9, rmax: 2.0, min: 108, max: 135, nominal: 120, ratio: 1.25, beds: 3, baths: 2, blind: false, kitchen: 'bar',
    tree: C(
      f(0.42, R(f(1.25, lf('bed', 'غرفة نوم رئيسية')), f(1, lf('bed', 'غرفة نوم')), f(1, lf('bed', 'غرفة نوم')))),
      m(2.2, R(m(1.9, lf('bath', 'حمام الماستر', { ens: true })), f(1, lf('hall', 'صالة')), m(1.7, lf('bath', 'حمام عام')))),
      f(0.58, R(f(0.2, lf('kitchen', 'مطبخ')), f(0.28, lf('living', 'سفرة')), f(0.52, lf('living', 'ريسبشن', { entry: true })))),
    ),
  },
  {
    id: 'T150', name: 'نموذج 150 م²: 4 غرف بجناحين', desc: 'جناح نوم بصالة بتتفتح على السفرة وبتنتهي بحمام عام، وماستر بحمام ودريسنج، وجناح ريسبشن وسفرة ومطبخ وحمام ضيوف.',
    rmin: 1.35, rmax: 1.75, min: 135, max: 175, nominal: 150, ratio: 1.5, beds: 4, baths: 3, blind: false, kitchen: 'bar',
    tree: R(
      f(0.585, C(
        f(0.4, R(f(1, lf('bed', 'غرفة نوم')), f(1, lf('bed', 'غرفة نوم')))),
        m(2.2, R(m(2.0, lf('bath', 'حمام عام')), f(1, lf('hall', 'صالة')))),
        f(0.6, R(
          f(1.3, lf('bed', 'غرفة نوم رئيسية')),
          m(2.0, C(m(2.4, lf('bath', 'حمام الماستر', { ens: true })), f(1, lf('other', 'دريسنج', { ens: true })))),
          f(1, lf('bed', 'غرفة نوم')),
        )),
      )),
      f(0.415, C(
        f(0.28, R(f(0.7, lf('kitchen', 'مطبخ')), m(1.8, lf('bath', 'حمام ضيوف')))),
        f(0.32, lf('living', 'سفرة')),
        f(0.4, lf('living', 'ريسبشن', { entry: true })),
      )),
    ),
  },
  {
    id: 'T200', name: 'نموذج 200 م²: 4 غرف وماستر سويت', desc: 'صالة مفتوحة على السفرة وبتنتهي بحمام عام، ماستر سويت، ريسبشن وركن جلوس وسفرة، مطبخ وحمام ضيوف ومخزن.',
    rmin: 1.25, rmax: 2.0, min: 175, max: 250, nominal: 200, ratio: 1.6, beds: 4, baths: 3, blind: false, kitchen: 'closed',
    tree: R(
      f(0.55, C(
        f(0.4, R(f(1, lf('bed', 'غرفة نوم')), f(1, lf('bed', 'غرفة نوم')))),
        m(2.4, R(m(2.0, lf('bath', 'حمام عام')), f(1, lf('hall', 'صالة')))),
        f(0.6, R(
          f(1.2, lf('bed', 'غرفة نوم رئيسية')),
          m(2.0, C(m(2.4, lf('bath', 'حمام الماستر', { ens: true })), f(1, lf('other', 'دريسنج', { ens: true })))),
          f(1, lf('bed', 'غرفة نوم')),
        )),
      )),
      f(0.45, C(
        f(0.28, R(f(0.6, lf('kitchen', 'مطبخ')), m(1.9, lf('bath', 'حمام ضيوف')), f(0.4, lf('other', 'مخزن وغسيل')))),
        f(0.72, R(
          f(0.5, C(f(0.42, lf('living', 'سفرة')), f(0.58, lf('living', 'ريسبشن', { entry: true })))),
          f(0.5, lf('living', 'ركن جلوس')),
        )),
      )),
    ),
  },
  {
    id: 'T300', name: 'نموذج 300 م²: 5 غرف وغرفة معيشة', desc: 'صالة مفتوحة على السفرة، 5 غرف نوم وماستر سويت، ريسبشن وركن جلوس وغرفة معيشة عائلية وحمام ضيوف.',
    rmin: 1.35, rmax: 2.0, min: 250, max: 420, nominal: 300, ratio: 1.5, beds: 5, baths: 3, blind: false, kitchen: 'closed',
    tree: R(
      f(0.55, C(
        f(0.45, R(f(1, lf('bed', 'غرفة نوم')), f(1, lf('bed', 'غرفة نوم')), f(1, lf('bed', 'غرفة نوم')))),
        m(2.6, R(m(2.0, lf('bath', 'حمام عام')), f(1, lf('hall', 'صالة')))),
        f(0.55, R(
          f(1.3, lf('bed', 'غرفة نوم رئيسية')),
          m(2.2, C(m(2.6, lf('bath', 'حمام الماستر', { ens: true })), f(1, lf('other', 'دريسنج', { ens: true })))),
          f(0.9, lf('bed', 'غرفة نوم')),
        )),
      )),
      f(0.45, C(
        f(0.3, R(f(0.5, lf('kitchen', 'مطبخ')), m(2.0, lf('bath', 'حمام ضيوف')), f(0.5, lf('living', 'غرفة معيشة')))),
        f(0.7, R(
          f(0.5, C(f(0.4, lf('living', 'سفرة')), f(0.6, lf('living', 'ريسبشن', { entry: true })))),
          f(0.5, lf('living', 'ركن جلوس')),
        )),
      )),
    ),
  },
]

export const tplById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[2]

// أبعاد الشقة من المساحة ونسبة العرض للعمق
export function dimsFor(area: number, ratio: number): [number, number] {
  const W = Math.sqrt(area * ratio)
  return [W, area / W]
}

// بيرتّب النماذج من الأنسب للمساحة وعدد الغرف
export function suggest(area: number, beds: number): Template[] {
  const score = (t: Template) => (area < t.min ? t.min - area : area > t.max ? area - t.max : 0) / 8 + Math.abs(beds - t.beds) * 2.5
  return [...TEMPLATES].sort((p, q) => score(p) - score(q))
}

function layoutNode(node: Tree, x: number, y: number, w: number, d: number, out: Placed[]) {
  if ('t' in node) { out.push({ t: node.t, n: node.n, x, y, w, d, entry: node.entry, ens: node.ens }); return }
  const along = node.dir === 'row' ? w : d
  const fixed = node.parts.reduce((s, p) => s + (p.m ?? 0), 0)
  const flex = node.parts.filter((p) => p.m === undefined)
  const wsum = flex.reduce((s, p) => s + (p.f ?? 1), 0)
  let k = 1
  let avail = along - fixed
  if (avail < flex.length * 0.8) { // المقاسات الثابتة أكبر من المتاح: نصغّرها
    k = Math.max(0.3, (along - flex.length * 0.8) / Math.max(fixed, 0.01))
    avail = along - fixed * k
  }
  let pos = 0
  for (const p of node.parts) {
    const size = p.m !== undefined ? p.m * k : wsum > 0 ? (avail * (p.f ?? 1)) / wsum : 0
    if (node.dir === 'row') layoutNode(p.node, x + pos, y, size, d, out)
    else layoutNode(p.node, x, y + pos, w, size, out)
    pos += size
  }
}

// بيوزّع النموذج على مساحة W×L، وبيرقّم الأسماء المتكررة (غرفة نوم 2 و3...)
export function layoutTemplate(t: Template, W: number, L: number): Placed[] {
  const out: Placed[] = []
  layoutNode(t.tree, 0, 0, W, L, out)
  const count: Record<string, number> = {}
  out.forEach((p) => { count[p.n] = (count[p.n] ?? 0) + 1 })
  const seen: Record<string, number> = {}
  return out.map((p) => {
    if (count[p.n] < 2) return p
    const i = (seen[p.n] = (seen[p.n] ?? 0) + 1)
    return { ...p, n: `${p.n} ${i + (p.n === 'غرفة نوم' ? 1 : 0)}` }
  })
}