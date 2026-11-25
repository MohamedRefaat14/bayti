import type { RoomType } from '../apartment'

export const RULES = {
  // الهدر
  waste: {
    straight: 1.07,    // رص مستقيم (5 إلى 7%)
    brick: 1.12,       // رص طوبي (10 إلى 12%)
    diagonal: 1.15,    // مائل
    herringbone: 1.2,  // سمكة
    seamless: 1.05,    // إيبوكسي وموكيت وخامة متصلة
    skirting: 1.05,    // وزرات
    wallMaterial: 1.1, // خامات الحيطان غير الدهان
  },
  box: { tile: 1.44, plank: 2.2 }, // م² في الكرتونة
  skirtLen: 2.4,                    // طول قطعة الوزرة بالمتر
  paint: { coats: 2, spread: 10, bucket: 9 }, // أوجه، م² للتر للوجه، لتر في البستلة
  slatW: 0.15,                      // عرض شريحة بديل الخشب (م)
  sheet: { w: 1.22, h: 2.8 },       // لوح بديل الرخام (م)
  // معادلة الإضاءة: لوكس كل نوع غرفة، وسبوت 600 لومن
  lux: { bed: 150, living: 150, kitchen: 300, bath: 200, hall: 100, other: 200 } as Record<RoomType, number>,
  spot: { lumens: 600, uf: 0.55, mf: 0.8 },
  defaultWallExt: 0.25, // سمك الحيطة الخارجية (م)
  defaultWallInt: 0.12, // سمك الحيطة الداخلية (م)
}

// عدد السبوتات الموصى به: N = ⌈E × A / (F × UF × MF)⌉
export const recommendedSpots = (type: RoomType, area: number) =>
  Math.ceil(((RULES.lux[type] ?? 150) * area) / (RULES.spot.lumens * RULES.spot.uf * RULES.spot.mf))