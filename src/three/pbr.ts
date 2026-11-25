import * as THREE from 'three'
import { getTex, grayOf, hasTex } from './assets'

// dir = اسم المجلد جوه public/textures | size = المقاس الحقيقي اللي الصورة بتغطيه بالمتر
// real = خامة بلونها الأصلي من غير تلوين (للرخام والجرانيت والأنواع الطبيعية)
export interface PbrRef { dir: string; size: number; real?: boolean }

const u = (r: PbrRef) => ({ color: `textures/${r.dir}/color.jpg`, normal: `textures/${r.dir}/normal.jpg`, rough: `textures/${r.dir}/rough.jpg` })
export const pbrUrls = (r?: PbrRef) => (r ? Object.values(u(r)) : [])
export const hasPbr = (r?: PbrRef): r is PbrRef => !!r && hasTex(u(r).color)

// خصائص خامة حقيقية: الصورة الأصلية (map) + البروز (normalMap) + اللمعان (roughnessMap)
// lenX/lenY = مقاس السطح بالمتر، offX/offY = مكان القطعة عشان النقش يكمّل بين القطع
export function pbrParams(
  r: PbrRef, tint: string, lenX: number, lenY: number, offX: number, offY: number, aniso: number, normalScale = 1,
): THREE.MeshStandardMaterialParameters | null {
  const urls = u(r)
  const color = r.real ? getTex(urls.color) : grayOf(urls.color)
  if (!color) return null
  const setup = (t: THREE.Texture) => {
    const c = t.clone()
    c.needsUpdate = true
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(lenX / r.size, lenY / r.size)
    c.offset.set(offX / r.size, offY / r.size)
    c.anisotropy = aniso
    return c
  }
  const n = getTex(urls.normal), ro = getTex(urls.rough)
  const p: THREE.MeshStandardMaterialParameters = { color: r.real ? '#ffffff' : tint, map: setup(color), roughness: 1, envMapIntensity: 0.5 }
  if (n) { p.normalMap = setup(n); p.normalScale = new THREE.Vector2(normalScale, normalScale) }
  if (ro) { p.roughnessMap = setup(ro) }
  return p
}