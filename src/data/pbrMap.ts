import type { RoomView } from '../apartment'
import { hasPbr, pbrUrls } from '../three/pbr'
import type { PbrRef } from '../three/pbr'

const r = (dir: string, size = 1): PbrRef => ({ dir, size })
// خامة حقيقية بلونها الأصلي (من غير تلوين): للرخام والجرانيت الطبيعي
const real = (dir: string, size = 1): PbrRef => ({ dir, size, real: true })

// لكل خامة في كتالوج الأرضيات مجلدها الخاص
export const FLOOR_PBR: Record<string, PbrRef> = {
  'por-plain': r('floor-tile', 1),
  'cer-plain': r('floor-ceramic', 0.8),
  'por-anti': r('floor-antislip', 1),
  'por-marble': r('floor-marble', 1.2),
  'por-cement': r('floor-cement', 1.2),
  'por-wood': r('floor-porcelain-wood', 1),
  'mar-natural': r('floor-marble', 1.2),   // احتياطي لو مجلد اللون مش موجود
  'gra-natural': r('floor-granite', 1),    // احتياطي لو مجلد اللون مش موجود
  hdf: r('floor-hdf', 1),
  lam: r('floor-laminate', 1),
  wood: r('floor-wood', 1),
  spc: r('floor-spc', 1),
  carpet: r('floor-carpet', 1),
}

// اختيارات ليها خامة حقيقية خاصة بدل تلوين خامة واحدة. المفتاح = كود اللون (بحروف صغيرة)
export const FLOOR_VARIANTS: Record<string, Record<string, PbrRef>> = {
  'mar-natural': {
    '#ededee': real('floor-marble-carrara', 1.2),
    '#9a9da3': real('floor-marble-grey', 1.2),
    '#1e1e20': real('floor-marble-black', 1.2),
    '#d9cbb0': real('floor-marble-beige', 1.2),
    '#4e6b58': real('floor-marble-green', 1.2),
  },
  'gra-natural': {
    '#7b7e83': real('floor-granite-grey', 1),
    '#25262a': real('floor-granite-black', 1),
    '#8a4b44': real('floor-granite-red', 1),
    '#b9a58a': real('floor-granite-beige', 1),
  },
  // مثال لو عايز أنواع خشب حقيقية مختلفة (شيل الشرطتين قبل السطور وحط المجلدات):
  // hdf: {
  //   '#a9784f': real('floor-hdf-oak', 1),
  //   '#6b4a33': real('floor-hdf-walnut', 1),
  //   '#8e8b87': real('floor-hdf-grey', 1),
  // },
}

// الخامة الأنسب للأرضية: لو اللون ليه خامة حقيقية محمّلة بنستخدمها، وإلا الخامة الأساسية
export function floorRef(id: string, color: string): PbrRef | undefined {
  const v = FLOOR_VARIANTS[id]?.[color.toLowerCase()]
  return v && hasPbr(v) ? v : FLOOR_PBR[id]
}

export const WALL_PBR: Record<string, PbrRef> = {
  'wp-stripe': r('wall-wallpaper', 1), 'wp-damask': r('wall-wallpaper', 1), 'wp-dots': r('wall-wallpaper', 1),
  'wood-slats': r('wall-wood', 1), 'marble-look': r('floor-marble', 1.2),
  'stone-ledger': r('wall-stone', 1), brick: r('wall-brick', 1),
  'tile-subway': r('wall-tile', 1), 'tile-square': r('wall-tile', 1),
  concrete: r('wall-concrete', 1.2), plaster: r('wall-plaster', 1.2),
}

// الصور المطلوب تحميلها لغرفة (الأرضية بخاماتها الأساسية والخاصة + الحيطة الديكور + الدادو)
export function roomPbrUrls(R: RoomView): string[] {
  const urls = [
    ...pbrUrls(FLOOR_PBR[R.floor.material]),
    ...pbrUrls(FLOOR_VARIANTS[R.floor.material]?.[R.floor.color.toLowerCase()]),
  ]
  const W = R.wall
  if (W.accent.side) urls.push(...pbrUrls(WALL_PBR[W.accent.material]))
  if (W.dado.on && W.dado.material) urls.push(...pbrUrls(WALL_PBR[W.dado.material]))
  return urls
}