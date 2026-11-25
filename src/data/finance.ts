// إعدادات القسم المالي: المصنعية والمواد المساعدة والمصاريف غير المباشرة وهامش الربح.
// كلها بتتعدل من داشبورد الإدارة (تبويب "المقايسة والتسعير")، وبتتحفظ في المتصفح.

export type LaborKey = 'floor' | 'wall' | 'accent' | 'dado' | 'skirt' | 'ceiling' | 'spot' | 'led' | 'chandelier' | 'cornice' | 'door' | 'window' | 'furn'
export type ConsCat = 'floor' | 'wall' | 'accent' | 'dado' | 'skirt' | 'ceiling' | 'light' | 'openings' | 'furn'
type Tier = [number, number, number]

export const LABOR_LABELS: Record<LaborKey, { name: string; unit: string }> = {
  floor: { name: 'تركيب الأرضيات', unit: 'م²' },
  wall: { name: 'دهان الحيطان (معجون وبطانة ووجهين)', unit: 'م²' },
  accent: { name: 'تركيب حيطة الديكور', unit: 'م²' },
  dado: { name: 'تركيب الدادو', unit: 'م²' },
  skirt: { name: 'تركيب الوزرة', unit: 'م.ط' },
  ceiling: { name: 'تنفيذ السقف', unit: 'م²' },
  spot: { name: 'تركيب سبوت لايت (شامل التأسيس)', unit: 'نقطة' },
  led: { name: 'تركيب شريط LED', unit: 'م.ط' },
  chandelier: { name: 'تركيب نجفة', unit: 'قطعة' },
  cornice: { name: 'تركيب كورنيش', unit: 'م.ط' },
  door: { name: 'تركيب باب', unit: 'قطعة' },
  window: { name: 'تركيب شباك', unit: 'م²' },
  furn: { name: 'تركيب وتجميع الفرش', unit: 'قطعة' },
}
export const CONS_LABELS: Record<ConsCat, string> = {
  floor: 'الأرضيات (مونة ولاصق وفوغة)', wall: 'دهان الحيطان (معجون وسنفرة)', accent: 'حيطة الديكور (لواصق ومسامير)',
  dado: 'الدادو', skirt: 'الوزرات', ceiling: 'الأسقف (هيكل ومسامير وشريط)', light: 'الإضاءة (أسلاك وتوصيلات)',
  openings: 'الأبواب والشبابيك (رغوة وإكسسوارات)', furn: 'الفرش',
}

export interface Fin { labor: Record<LaborKey, Tier>; cons: Record<ConsCat, number>; indirect: number; margin: number }

const defaults = (): Fin => ({
  labor: {
    floor: [70, 110, 170], wall: [20, 30, 45], accent: [80, 130, 200], dado: [80, 130, 200], skirt: [12, 18, 30], ceiling: [100, 150, 230],
    spot: [50, 80, 130], led: [20, 30, 50], chandelier: [200, 350, 600], cornice: [35, 55, 90], door: [300, 500, 900], window: [150, 250, 400], furn: [0, 0, 0],
  },
  cons: { floor: 0.12, wall: 0.08, accent: 0.1, dado: 0.1, skirt: 0.08, ceiling: 0.1, light: 0.05, openings: 0.03, furn: 0 },
  indirect: 0.1, // مصاريف غير مباشرة (إشراف، نقل مخلفات، نثريات) كنسبة من التكلفة المباشرة
  margin: 0,     // هامش ربح كنسبة على التكلفة (Markup)
})

export const FIN: Fin = defaults()

// بيدمج قيم محفوظة (بعد التحقق من إنها أرقام سليمة)
export function applyFin(src: any) {
  if (!src || typeof src !== 'object') return
  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  for (const k of Object.keys(FIN.labor) as LaborKey[]) {
    const a = src.labor?.[k]
    if (Array.isArray(a) && a.length === 3 && a.every((x: any) => num(x) !== null)) FIN.labor[k] = [a[0], a[1], a[2]]
  }
  for (const k of Object.keys(FIN.cons) as ConsCat[]) { const v = num(src.cons?.[k]); if (v !== null) FIN.cons[k] = v }
  const i = num(src.indirect), m = num(src.margin)
  if (i !== null) FIN.indirect = i
  if (m !== null) FIN.margin = m
}
export function resetFinDefaults() { applyFin(defaults()) }