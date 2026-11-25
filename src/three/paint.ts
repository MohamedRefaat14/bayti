import * as THREE from 'three'
import type { Side } from '../apartment'
import type { Finish } from '../data/wallCatalog'

const S = 512
const TILE = 1.2 // المقاس اللي بتغطيه صورة الدهان بالمتر قبل ما تتكرر

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ضوضاء ناعمة بتلف على نفسها (من غير حدود ظاهرة لما الصورة تتكرر)
function valueNoise(cells: number, rnd: () => number) {
  const g = new Float32Array(cells * cells)
  for (let i = 0; i < g.length; i++) g[i] = rnd()
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (u: number, v: number) => {
    const x = u * cells, y = v * cells
    const x0 = Math.floor(x) % cells, y0 = Math.floor(y) % cells
    const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells
    const fx = sm(x - Math.floor(x)), fy = sm(y - Math.floor(y))
    const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

let baseColor: THREE.CanvasTexture | null = null
let baseBump: THREE.CanvasTexture | null = null

// صورة اللون: تبقّع خفيف حوالين الأبيض (بتتضرب في لون الدهان) + صورة البروز: قشر البرتقال
function ensureBase() {
  if (baseColor && baseBump) return
  const rnd = rng(20260101)
  const n1 = valueNoise(5, rnd), n2 = valueNoise(21, rnd), n3 = valueNoise(192, rnd)
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c }
  const color = mk(), bump = mk()
  const cx = color.getContext('2d')!, bx = bump.getContext('2d')!
  const ci = cx.createImageData(S, S), bi = bx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, w = rnd(), k = (y * S + x) * 4
      const mott = 0.992 + (n1(u, v) - 0.5) * 0.02 + (n2(u, v) - 0.5) * 0.012 + (w - 0.5) * 0.008
      const c = Math.max(0, Math.min(255, mott * 255))
      ci.data[k] = ci.data[k + 1] = ci.data[k + 2] = c; ci.data[k + 3] = 255
      const h = Math.max(0, Math.min(255, 128 + ((n3(u, v) - 0.5) * 0.6 + (w - 0.5) * 0.4) * 40))
      bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = h; bi.data[k + 3] = 255
    }
  }
  cx.putImageData(ci, 0, 0); bx.putImageData(bi, 0, 0)
  baseColor = new THREE.CanvasTexture(color)
  baseBump = new THREE.CanvasTexture(bump)
}

const FIN: Record<Finish, { rough: number; bump: number; env: number }> = {
  matt: { rough: 0.95, bump: 0.12, env: 0.05 },
  satin: { rough: 0.5, bump: 0.08, env: 0.3 },
  gloss: { rough: 0.2, bump: 0.04, env: 0.7 },
}

// خصائص قطعة دهان: lenX/lenY = مقاسها بالمتر، offX/offY = مكانها عشان الملمس يكمّل بين القطع
export function paintParams(
  color: string, finish: Finish, lenX: number, lenY: number, offX: number, offY: number, aniso: number,
): THREE.MeshStandardMaterialParameters {
  ensureBase()
  const f = FIN[finish]
  const setup = (t: THREE.Texture) => {
    const c = t.clone()
    c.needsUpdate = true
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(lenX / TILE, lenY / TILE)
    c.offset.set(offX / TILE, offY / TILE)
    c.anisotropy = aniso
    return c
  }
  return { color: capWhite(color), map: setup(baseColor!), bumpMap: setup(baseBump!), bumpScale: f.bump, roughness: f.rough, envMapIntensity: f.env }
}

// ===== تظليل الأركان والسقف (ظل ناعم عند التقاء الأسطح) =====
const gradCache: Record<string, THREE.CanvasTexture> = {}
function grad(kind: 'v' | 'h') {
  if (gradCache[kind]) return gradCache[kind]
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = kind === 'v' ? x.createLinearGradient(0, 0, 0, 64) : x.createLinearGradient(0, 0, 64, 0)
  g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(0.45, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  gradCache[kind] = new THREE.CanvasTexture(c)
  return gradCache[kind]
}

const ROT: Record<Side, number> = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }
const LOCAL_X: Record<Side, number> = { N: 1, S: -1, W: -1, E: 1 } // اتجاه محور الصورة على طول الحيطة

export function addEdgeShading(scene: THREE.Object3D, W: number, L: number, H: number, T: number, skip: Side[] = []) {
  const off = T + 0.004
  const at = (side: Side, along: number, y: number): [number, number, number] =>
    side === 'N' ? [along, y, -L / 2 + off] : side === 'S' ? [along, y, L / 2 - off] : side === 'W' ? [-W / 2 + off, y, along] : [W / 2 - off, y, along]
  const mat = (kind: 'v' | 'h') => {
    const m = new THREE.MeshBasicMaterial({ map: grad(kind), transparent: true, depthWrite: false, side: THREE.DoubleSide })
    m.polygonOffset = true; m.polygonOffsetFactor = -1
    return m
  }
  ;(['N', 'S', 'W', 'E'] as Side[]).forEach((side) => {
        if (skip.includes(side)) return // حيطة مفتوحة بالكامل: مفيش تظليل
    const il = (side === 'N' || side === 'S' ? W : L) - 2 * T // طول الحيطة من الداخل
    // ظل تحت السقف
    const top = new THREE.Mesh(new THREE.PlaneGeometry(il, 0.35), mat('v'))
    top.position.set(...at(side, 0, H - 0.175)); top.rotation.y = ROT[side]; top.renderOrder = 1
    scene.add(top)
    // ظل عند كل ركن رأسي
    ;[-1, 1].forEach((e) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, H), mat('h'))
      s.position.set(...at(side, e * (il / 2 - 0.2), H / 2)); s.rotation.y = ROT[side]
      if (e !== -LOCAL_X[side]) s.scale.x = -1 // الجهة الغامقة تبقى ناحية الركن
      s.renderOrder = 1
      scene.add(s)
    })
  })
}
// بيقصّ الأبيض الصريح: أي لون قريب من الأبيض بيتقص لحد 242 (الأبيض المطلق مش موجود في الواقع)
export function capWhite(hex: string, max = 242) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const hi = Math.max(r, g, b)
  if (Math.min(r, g, b) < 215 || hi <= max) return hex
  const k = max / hi
  const h = (v: number) => Math.round(v * k).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

// ===== ظلال التلامس: ظل ناعم على الأرضية عند قاعدة الحيطان، وظل تحت الأجسام =====
let floorGradTex: THREE.CanvasTexture | null = null
function floorGrad() {
  if (floorGradTex) return floorGradTex
  const c = document.createElement('canvas'); c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 0, 64) // الأغمق فوق = ناحية الحيطة
  g.addColorStop(0, 'rgba(0,0,0,0.34)'); g.addColorStop(0.35, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  floorGradTex = new THREE.CanvasTexture(c)
  return floorGradTex
}

export function addContactShadows(scene: THREE.Object3D, W: number, L: number, T: number, skip: Side[] = []) {
  const depth = 0.5
  const mat = new THREE.MeshBasicMaterial({ map: floorGrad(), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  ;(['N', 'S', 'W', 'E'] as Side[]).forEach((side) => {
    if (skip.includes(side)) return
    const half = (side === 'N' || side === 'S' ? L : W) / 2
    const len = (side === 'N' || side === 'S' ? W : L) - 2 * T
    const grp = new THREE.Group(); grp.rotation.y = ROT[side]; scene.add(grp)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), mat)
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, -half + T + depth / 2); m.renderOrder = 1
    grp.add(m)
  })
}

// ظل ناعم دائري أو بيضاوي على الأرضية (تحت كراسي البار والجزيرة)
let blobTex: THREE.CanvasTexture | null = null

export function addBlob(scene: THREE.Object3D, x: number, z: number, rx: number, rz: number, strength = 0.5) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const x2 = c.getContext('2d')!
    const g = x2.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    x2.fillStyle = g; x2.fillRect(0, 0, 64, 64)
    blobTex = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: strength }),
  )
  m.scale.set(2 * rx, 2 * rz, 1); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.renderOrder = 1
  scene.add(m)
}