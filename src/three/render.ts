import * as THREE from 'three'

// إعدادات الريندر في مكان واحد
export const RENDER = {
  filmic: true,   // true = ألوان صح (sRGB) + tone mapping فيلمي | false = الشكل القديم
  exposure: 1.05,  // سطوع الصورة كلها (زوّده لو غامقة، وقلله لو منوّرة زيادة)
  lightK: 0.72,   // معامل تقليل شدة الإضاءة في الوضع الجديد (زوّده لو غامقة)
}

export function configureRenderer(r: THREE.WebGLRenderer) {
  THREE.ColorManagement.enabled = RENDER.filmic
  r.outputColorSpace = RENDER.filmic ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
  ;(r as unknown as { useLegacyLights: boolean }).useLegacyLights = true
  r.toneMapping = RENDER.filmic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
  r.toneMappingExposure = RENDER.exposure
}

// بيتنده على كل مشهد بعد بنائه: بيظبط فضاء ألوان الخامات ويعدّل شدة الإضاءة للوضع الفيلمي
export function finalizeScene(scene: THREE.Scene) {
  if (!RENDER.filmic) return
  const k = RENDER.lightK
  scene.traverse((o) => {
    const l = o as THREE.Light
    if (l.isLight) l.intensity *= k
    const raw = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!raw) return
    for (const m of Array.isArray(raw) ? raw : [raw]) {
      const mm = m as THREE.MeshStandardMaterial
      if (mm.isMeshStandardMaterial) mm.envMapIntensity *= k
      const map = (m as THREE.MeshBasicMaterial).map
      if (map && map.colorSpace !== THREE.SRGBColorSpace) { map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true }
    }
  })
}