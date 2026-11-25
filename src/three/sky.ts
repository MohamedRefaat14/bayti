import * as THREE from 'three'
import type { Side } from '../apartment'
import type { TimeOfDay } from '../data/lighting'
import { loadHdr } from './assets'

// ملفات البانوراما داخل public/hdri
export const SKY_URL: Record<TimeOfDay, string> = { day: 'hdri/day.hdr', sunset: 'hdri/sunset.hdr', night: 'hdri/night.hdr' }
// سطوع كل وقت: زوّده لو الصورة غامقة، وقلله لو منوّرة زيادة
const EXPOSURE: Record<TimeOfDay, number> = { day: 1.2, sunset: 1.4, night: 4 }
// لو المنظر طالع بزاوية مش عاجباك (بتبص على جدار أو الاتجاه غلط) غيّر الرقم ده بالراديان (3.14 = نص لفة)
export const HDR_YAW = 0
// اتجاه البانوراما بالنسبة للحيطة اللي فيها الشباك
export const SKY_ROT: Record<Side, number> = { N: -Math.PI / 2, S: Math.PI / 2, W: 0, E: Math.PI }
const MAX_W = 2048

export interface Sky { pano: THREE.CanvasTexture; env: THREE.Texture }
const skies: Partial<Record<TimeOfDay, Sky | null>> = {}
export const getSky = (t: TimeOfDay) => skies[t] ?? null

// بيحوّل صورة HDR لصورة عادية (tone mapping + gamma) عشان تتعرض صح على الكرة
function toCanvas(t: THREE.DataTexture, exposure: number) {
  const img = t.image as unknown as {
  width: number
  height: number
  data: Uint16Array | Float32Array
}
  const { width, height, data } = img
  const w = Math.min(MAX_W, width), h = Math.round((w * height) / width)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const x = cv.getContext('2d')!, out = x.createImageData(w, h)
  const half = data instanceof Uint16Array
  for (let j = 0; j < h; j++) {
    const sy = Math.min(height - 1, Math.floor((j * height) / h))
    for (let i = 0; i < w; i++) {
      const sx = Math.min(width - 1, Math.floor((i * width) / w))
      const k = (sy * width + sx) * 4, o = (j * w + i) * 4
      for (let c = 0; c < 3; c++) {
        const v = half ? THREE.DataUtils.fromHalfFloat(data[k + c]) : data[k + c]
        out.data[o + c] = Math.pow(1 - Math.exp(-v * exposure), 1 / 2.2) * 255
      }
      out.data[o + 3] = 255
    }
  }
  x.putImageData(out, 0, 0)
  return cv
}

// بيحمّل بانوراما وقت معين (مرة واحدة). لو الملف مش موجود بيرجّع null
export async function loadSky(t: TimeOfDay, pm: THREE.PMREMGenerator): Promise<Sky | null> {
  if (t in skies) return skies[t] ?? null
  try {
    const hdr = await loadHdr(SKY_URL[t])
    if (!hdr) { skies[t] = null; return null }
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const env = pm.fromEquirectangular(hdr).texture
    const pano = new THREE.CanvasTexture(toCanvas(hdr, EXPOSURE[t]))
    hdr.dispose()
    skies[t] = { pano, env }
    return skies[t] ?? null
  } catch {
    skies[t] = null
    return null
  }
}