import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

// مسارات الملفات داخل مجلد public
export const HDR_URL = 'hdri/room.hdr'
export const OUTDOOR_JPG = 'images/outdoor.jpg'
export const DOOR_GLB = 'models/door.glb'

const asset = (p: string) => '/' + p
const texCache = new Map<string, THREE.Texture | null>()
const glbCache = new Map<string, THREE.Object3D | null>()
const grayCache = new Map<string, THREE.Texture>()
const loader = new THREE.TextureLoader()

// بيحمّل الصور (لو الملف مش موجود بيتسجّل null وبنكمّل بالخامة المرسومة)
export async function preload(urls: string[]) {
  await Promise.all(urls.map(async (u) => {
    if (texCache.has(u)) return
    try { texCache.set(u, await loader.loadAsync(asset(u))) } catch { texCache.set(u, null) }
  }))
}
export const getTex = (u: string) => texCache.get(u) ?? null
export const hasTex = (u: string) => !!texCache.get(u)

export async function preloadGlb(u: string) {
  if (glbCache.has(u)) return
  try { glbCache.set(u, (await new GLTFLoader().loadAsync(asset(u))).scene) } catch { glbCache.set(u, null) }
}
export const getGlb = (u: string) => glbCache.get(u) ?? null

export async function loadHdr(u: string): Promise<THREE.DataTexture | null> {
  try { return await new RGBELoader().loadAsync(asset(u)) } catch { return null }
}

// صورة الخامة بدرجات الرمادي ومتوسط سطوع ثابت، عشان نضربها في لون المستخدم ونحتفظ بنقشها الحقيقي
export function grayOf(u: string): THREE.Texture | null {
  const src = getTex(u)
  if (!src) return null
  const hit = grayCache.get(u)
  if (hit) return hit
  const img = src.image as { width: number; height: number }
  const w = Math.min(1024, img.width), h = Math.min(1024, img.height)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const x = cv.getContext('2d')!
  x.drawImage(src.image as CanvasImageSource, 0, 0, w, h)
  const d = x.getImageData(0, 0, w, h), p = d.data
  let sum = 0
  for (let i = 0; i < p.length; i += 4) sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
  const k = Math.min(3, (0.85 * 255) / Math.max(1, sum / (p.length / 4)))
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.min(255, (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * k)
    p[i] = p[i + 1] = p[i + 2] = v
  }
  x.putImageData(d, 0, 0)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  grayCache.set(u, t)
  return t
}