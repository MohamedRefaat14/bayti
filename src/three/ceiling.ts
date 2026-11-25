import * as THREE from 'three'
import type { RoomView } from '../apartment'
import { spotPositions } from '../data/ceilingCatalog'
import type { Lit } from '../data/lighting'
import { wmById } from '../data/wallCatalog'
import { wallParams } from './wallTexture'
import { paintParams } from './paint'

const T = 0.12 // سمك الحيطة (نفس القيمة في buildRoom)
const OFF = 0x3b3b3b // لون الإضاءة وهي مطفية
type Params = THREE.MeshStandardMaterialParameters

// خطوط ألواح الـPVC: خط كل 20 سم
function pvcMap(L: number) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64
  const x = cv.getContext('2d')!
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64)
  x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, 64, 4)
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, L / 0.2)
  return t
}

export function buildCeiling(scene: THREE.Object3D, R: RoomView, aniso: number, lit: Lit, lights = true) {
  const W = R.w, L = R.d, H = R.h, c = R.ceiling
  const iw = W - 2 * T, il = L - 2 * T // الأبعاد الداخلية بين الحيطان
  const rough = c.material === 'pvc' ? 0.35 : c.material === 'wood' ? 0.55 : 0.9
  const paint: Params = { color: c.color, roughness: rough, envMapIntensity: 0.15 + 0.4 * (1 - rough) }

  const add = (sx: number, sy: number, sz: number, x: number, y: number, z: number, par: Params = paint) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial(par))
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m)
  }
  // سطح مضيء (شريط LED): بيتحول لرمادي لما الإنارة تتطفى
  const glow = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color: lit.on ? lit.hex : OFF }))
    m.position.set(x, y, z); scene.add(m)
  }
  // مصدر ضوء فعلي: بيتلغي لما الإنارة تتطفى، وشدته بتتضرب في السطوع
  const light = (x: number, y: number, z: number, intensity: number, dist: number) => {
    if (!lit.on || !lights) return
    const l = new THREE.PointLight(lit.hex, intensity * lit.level, dist); l.position.set(x, y, z); scene.add(l)
  }
  const ledOn = c.led !== 'off'

  // البلاطة الأساسية (أعلى نقطة في السقف)
  let slab: Params = paint
  if (c.type === 'flat' && c.material === 'concrete') slab = wallParams(wmById('concrete'), c.color, W, L, 0, 0, aniso)
  else if (c.type === 'flat' && c.material === 'pvc') slab = { ...paint, map: pvcMap(L) }
  else if (c.type === 'slats') slab = { color: '#2B2B2B', roughness: 0.9 }
  else slab = { ...paintParams(c.color, 'matt', W, L, 0, 0, aniso), emissive: c.color, emissiveIntensity: 0.2 } // سقف مدهون: بيرجّع إحساس الضوء المرتد
  add(W, 0.05, L, 0, H + 0.02, 0, slab)

  // إطار حوالين الغرفة: offset = البعد عن الحيطة، w = العرض، drop = النزول عن السقف
  const ring = (offset: number, w: number, drop: number) => {
    const y = H - drop / 2
    add(iw - 2 * offset, drop, w, 0, y, -il / 2 + offset + w / 2)
    add(iw - 2 * offset, drop, w, 0, y, il / 2 - offset - w / 2)
    add(w, drop, Math.max(0.1, il - 2 * offset - 2 * w), -iw / 2 + offset + w / 2, y, 0)
    add(w, drop, Math.max(0.1, il - 2 * offset - 2 * w), iw / 2 - offset - w / 2, y, 0)
  }
  // شريط LED على مستطيل بداخل الحيطان بمقدار inset
  const strip = (inset: number, y: number) => {
    const sw = Math.max(0.2, iw - 2 * inset), sl = Math.max(0.2, il - 2 * inset)
    glow(sw, 0.03, 0.04, 0, y, -il / 2 + inset); glow(sw, 0.03, 0.04, 0, y, il / 2 - inset)
    glow(0.04, 0.03, sl, -iw / 2 + inset, y, 0); glow(0.04, 0.03, sl, iw / 2 - inset, y, 0)
  }

  let baseTop = H // مستوى لوح المركز (للسبوت والنجفة)
  let spotY = H - 0.012

  if (c.type === 'cove') {
    ring(0, 0.45, 0.15)
    if (ledOn) { strip(0.5, H - 0.04); light(0, H - 0.3, 0, 0.3, 8) }
  } else if (c.type === 'stepped') {
    ring(0, 0.4, 0.26)
    ring(0.4, 0.35, 0.13)
    if (ledOn) { strip(0.78, H - 0.1); light(0, H - 0.3, 0, 0.3, 8) }
  } else if (c.type === 'coffered') {
    const nx = Math.max(1, Math.round(iw / 1.2)), nz = Math.max(1, Math.round(il / 1.2))
    for (let i = 0; i <= nx; i++) add(0.12, 0.1, il, -iw / 2 + (i * iw) / nx, H - 0.05, 0)
    for (let j = 0; j <= nz; j++) add(iw, 0.1, 0.12, 0, H - 0.05, -il / 2 + (j * il) / nz)
  } else if (c.type === 'floating') {
    const pw = Math.max(0.5, iw - 0.8), pl = Math.max(0.5, il - 0.8)
    add(pw, 0.06, pl, 0, H - 0.2, 0)
    baseTop = H - 0.23; spotY = H - 0.2 - 0.04
    if (ledOn) {
      glow(pw + 0.1, 0.03, 0.04, 0, H - 0.12, -pl / 2 - 0.1); glow(pw + 0.1, 0.03, 0.04, 0, H - 0.12, pl / 2 + 0.1)
      glow(0.04, 0.03, pl + 0.1, -pw / 2 - 0.1, H - 0.12, 0); glow(0.04, 0.03, pl + 0.1, pw / 2 + 0.1, H - 0.12, 0)
      light(0, H - 0.35, 0, 0.3, 8)
    }
  } else if (c.type === 'slats') {
    const step = Math.max(0.1, iw / 60), n = Math.floor(iw / step)
    const wood: Params = { color: c.color, roughness: 0.55, envMapIntensity: 0.3 }
    for (let i = 0; i < n; i++) add(0.05, 0.06, il - 0.04, -iw / 2 + (i + 0.5) * step, H - 0.03, 0, wood)
    spotY = H - 0.065
  }

  // كورنيش (للمسطح والكوفرد)
  if ((c.type === 'flat' || c.type === 'coffered') && c.cornice !== 'none') {
    const wp: Params = { color: '#F4F4F2', roughness: 0.7 }
    const frame = (s: number, h: number, y: number) => {
      add(iw, h, s, 0, y, -il / 2 + s / 2, wp); add(iw, h, s, 0, y, il / 2 - s / 2, wp)
      add(s, h, il, -iw / 2 + s / 2, y, 0, wp); add(s, h, il, iw / 2 - s / 2, y, 0, wp)
    }
    if (c.cornice === 'simple') frame(0.07, 0.07, H - 0.035)
    else { frame(0.12, 0.05, H - 0.025); frame(0.07, 0.06, H - 0.08) }
  }

  // سبوت لايت
  const spots = spotPositions(iw, il, c.spots, c.type)
  if (spots.length) {
    const g = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 16), m = new THREE.MeshBasicMaterial({ color: lit.on ? lit.hex : 0x555555 })
    spots.forEach(([x, z]) => { const s = new THREE.Mesh(g, m); s.position.set(x, spotY, z); scene.add(s) })
    const idx = Array.from(new Set([0, Math.floor(spots.length / 2), spots.length - 1]))
    idx.forEach((k) => light(spots[k][0], spotY - 0.15, spots[k][1], 0.2, 6))
  }

  // نجفة
  if (c.chandelier) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#555555' }))
    rod.position.set(0, baseTop - 0.25, 0); scene.add(rod)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#B89B5E', metalness: 0.6, roughness: 0.4 }))
    body.position.set(0, baseTop - 0.52, 0); scene.add(body)
    const bulb = new THREE.SphereGeometry(0.04, 10, 8), bm = new THREE.MeshBasicMaterial({ color: lit.on ? lit.hex : 0x666666 })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, b = new THREE.Mesh(bulb, bm)
      b.position.set(Math.cos(a) * 0.24, baseTop - 0.47, Math.sin(a) * 0.24); scene.add(b)
    }
    light(0, baseTop - 0.6, 0, 0.35, 7)
  }
}