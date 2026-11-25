import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FrameDef, Metal } from '../openings'
import { openModel } from '../data/openStore'

// كل الدوال بتبني في إحداثيات الفتحة: المنتصف على x=0، والأرض (أو حافة الشباك) على y=0، والغرفة ناحية +z، وسمك الحيطة T

const MET: Record<Metal, { c: string; m: number; r: number }> = {
  chrome: { c: '#C9CCD1', m: 0.9, r: 0.2 }, gold: { c: '#B8975A', m: 0.85, r: 0.3 }, black: { c: '#26272B', m: 0.5, r: 0.4 },
}
const SOFT = '#EFECE6'

// نقش خشب مرسوم (ألياف رأسية)، متخزن حسب اللون
const grains = new Map<string, THREE.CanvasTexture>()
function grain(hex: string) {
  const hit = grains.get(hex)
  if (hit) return hit
  const W = 128, Hh = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh
  const x = cv.getContext('2d')!
  x.fillStyle = hex; x.fillRect(0, 0, W, Hh)
  let s = 11
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let i = 0; i < 46; i++) {
    const px = rnd() * W, a = 0.03 + rnd() * 0.09, dark = rnd() < 0.6
    x.strokeStyle = dark ? `rgba(30,18,6,${a})` : `rgba(255,240,215,${a})`
    x.lineWidth = 0.6 + rnd() * 1.8
    x.beginPath(); x.moveTo(px, 0)
    x.bezierCurveTo(px + (rnd() - 0.5) * 8, Hh * 0.33, px + (rnd() - 0.5) * 8, Hh * 0.66, px + (rnd() - 0.5) * 6, Hh)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  grains.set(hex, t)
  return t
}

function kit(g: THREE.Object3D, def: FrameDef) {
  const metal = new THREE.MeshStandardMaterial({ color: MET[def.metal].c, metalness: MET[def.metal].m, roughness: MET[def.metal].r, envMapIntensity: 0.8 })
  const wood = (c: string) => new THREE.MeshStandardMaterial({ color: '#ffffff', map: grain(c), roughness: 0.5, envMapIntensity: 0.25 })
  const paint = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.15, envMapIntensity: 0.3, ...o })
  const glass = () => new THREE.MeshStandardMaterial({ color: '#CFE6F5', transparent: true, opacity: 0.32, roughness: 0.05, envMapIntensity: 1, depthWrite: false })
  const rb = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material, r = 0.006) => {
    const rr = Math.max(0.001, Math.min(r, sx / 2 - 0.0005, sy / 2 - 0.0005, sz / 2 - 0.0005))
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, rr), m)
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    g.add(mesh); return mesh
  }
  const bx = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m)
    mesh.position.set(x, y, z); mesh.receiveShadow = true
    g.add(mesh); return mesh
  }
  const cy = (r: number, h: number, x: number, y: number, z: number, m: THREE.Material, rotX = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m)
    mesh.position.set(x, y, z); mesh.rotation.x = rotX; mesh.castShadow = true
    g.add(mesh); return mesh
  }
  return { metal, wood, paint, glass, rb, bx, cy }
}

function tint(root: THREE.Object3D, hex: string, match?: string) {
  const key = (match ?? '').trim().toLowerCase()
  root.traverse((n) => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const out = mats.map((mt) => {
      const sm = mt as THREE.MeshStandardMaterial
      if (!sm.color || (key && !(sm.name || '').toLowerCase().includes(key))) return mt
      const c = sm.clone(); c.color.set(hex); return c
    })
    mesh.material = Array.isArray(mesh.material) ? out : out[0]
  })
}

// موديل glb حقيقي: بيتحجّم على مقاس الفتحة
function fitModel(g: THREE.Object3D, def: FrameDef, color: string, model: THREE.Object3D, w: number, h: number) {
  const m = model.clone(true)
  if (def.colors.length) tint(m, color, def.matMatch)
  const pivot = new THREE.Group(), sc = new THREE.Group()
  pivot.rotation.y = def.modelRot ?? 0
  pivot.add(m); sc.add(pivot)
  const s = new THREE.Box3().setFromObject(sc).getSize(new THREE.Vector3())
  let sx = w / (s.x || 1), sy = h / (s.y || 1), sz = Math.min(sx, sy)
  if (def.fit === 'contain') { const q = Math.min(sx, sy); sx = sy = sz = q }
  sc.scale.set(sx, sy, sz)
  const b = new THREE.Box3().setFromObject(sc), c = b.getCenter(new THREE.Vector3())
  sc.position.set(-c.x, -b.min.y, -c.z)
  sc.traverse((n) => { if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true } })
  g.add(sc)
}

const darker = (hex: string) => '#' + new THREE.Color(hex).multiplyScalar(0.88).getHexString()

export function drawDoor(g: THREE.Object3D, def: FrameDef, color: string, w: number, T: number) {
  const H = 2.1
  const model = openModel(def)
  if (model) { fitModel(g, def, color, model, w, H); return }
  const k = kit(g, def)
  const armored = def.design === 'armored'
  const double = def.design === 'double' && w >= 1.2
  const fm = armored ? k.paint('#3B3B40', { metalness: 0.4 }) : k.wood(color)
  const jd = T + 0.02

  // الحلق والكسوة
  k.rb(0.045, H, jd, -w / 2 + 0.0225, H / 2, 0, fm)
  k.rb(0.045, H, jd, w / 2 - 0.0225, H / 2, 0, fm)
  k.rb(w, 0.045, jd, 0, H - 0.0225, 0, fm)
  const trim = armored ? k.paint('#2E2E32', { metalness: 0.4 }) : k.wood(color)
  k.rb(0.07, H + 0.04, 0.012, -w / 2 - 0.035, (H + 0.04) / 2, T / 2 + 0.006, trim, 0.004)
  k.rb(0.07, H + 0.04, 0.012, w / 2 + 0.035, (H + 0.04) / 2, T / 2 + 0.006, trim, 0.004)
  k.rb(w + 0.14, 0.07, 0.012, 0, H + 0.005, T / 2 + 0.006, trim, 0.004)

  // ضلفة واحدة: cx مركزها، lw عرضها، hand = ناحية المقبض
  const leaf = (cx: number, lw: number, hand: 1 | -1) => {
    const lt = armored ? 0.06 : 0.042, lh = 2.02, ly = 0.03 + lh / 2
    if (def.design === 'glass') {
      const sm = k.wood(color), gm = k.glass()
      k.rb(0.11, lh, lt, cx - lw / 2 + 0.055, ly, 0, sm, 0.006)
      k.rb(0.11, lh, lt, cx + lw / 2 - 0.055, ly, 0, sm, 0.006)
      k.rb(lw, 0.1, lt, cx, 0.03 + lh - 0.05, 0, sm, 0.006)
      k.rb(lw, 0.09, lt, cx, 0.98, 0, sm, 0.006)
      k.rb(lw - 0.16, 0.86, lt - 0.006, cx, 0.46, 0, sm, 0.006)
      const gh = 0.925, gy = 1.4875
      k.bx(lw - 0.2, gh, 0.008, cx, gy, 0, gm)
      k.rb(0.02, gh, 0.016, cx, gy, 0, sm, 0.003)
      k.rb(lw - 0.2, 0.02, 0.016, cx, gy - 0.3, 0, sm, 0.003)
      k.rb(lw - 0.2, 0.02, 0.016, cx, gy + 0.3, 0, sm, 0.003)
    } else {
      k.rb(lw, lh, lt, cx, ly, 0, armored ? k.paint('#4A4036', { metalness: 0.3, roughness: 0.5 }) : k.wood(color), 0.008)
      if (armored) {
        for (const s of [1, -1]) k.rb(lw - 0.1, lh - 0.1, 0.012, cx, ly, s * (lt / 2 + 0.004), k.wood(color), 0.004)
        k.cy(0.012, 0.03, cx, 1.55, lt / 2 + 0.018, k.metal, Math.PI / 2) // عين سحرية
        k.rb(0.05, 0.32, 0.01, cx + hand * (lw / 2 - 0.07), 1.05, lt / 2 + 0.01, k.metal, 0.004) // لوحة القفل
      } else if (def.design === 'panel' || def.design === 'double') {
        const cols = lw > 0.62 ? 2 : 1, margin = 0.1, gap = 0.08
        const pw = (lw - 2 * margin - (cols - 1) * gap) / cols
        const pm = k.wood(darker(color))
        for (let c = 0; c < cols; c++) {
          const px = cx - lw / 2 + margin + pw / 2 + c * (pw + gap)
          for (const [py, ph] of [[1.5, 0.9], [0.55, 0.66]] as [number, number][]) {
            for (const s of [1, -1]) k.rb(pw, ph, 0.012, px, py, s * (lt / 2 + 0.004), pm, 0.004)
          }
        }
      }
    }
    // المقبض (أكرة ليفر بوردة) على الوجهين
    const hx = cx + hand * (lw / 2 - 0.07)
    for (const s of [1, -1]) {
      const z = s * (lt / 2 + 0.008)
      if (armored) {
        k.rb(0.022, 0.5, 0.022, hx, 1.05, z + s * 0.03, k.metal, 0.01)
        k.rb(0.04, 0.04, 0.03, hx, 0.85, z + s * 0.012, k.metal, 0.006)
        k.rb(0.04, 0.04, 0.03, hx, 1.25, z + s * 0.012, k.metal, 0.006)
      } else {
        k.rb(0.045, 0.17, 0.01, hx, 1.0, z, k.metal, 0.004)
        k.rb(0.12, 0.02, 0.02, hx - hand * 0.045, 1.0, z + s * 0.018, k.metal, 0.008)
      }
    }
  }

  if (double) { const lw = (w - 0.09) / 2; leaf(-(lw / 2 + 0.0025), lw, 1); leaf(lw / 2 + 0.0025, lw, -1) } else leaf(0, w - 0.09, 1)

  // المفصلات
  const hingeX = double ? [-w / 2 + 0.052, w / 2 - 0.052] : [-w / 2 + 0.052]
  for (const x of hingeX) for (const y of [0.3, 1.05, 1.8]) k.cy(0.01, 0.1, x, y, 0.03, k.metal)
}

export function drawWindow(g: THREE.Object3D, def: FrameDef, color: string, w: number, h: number, T: number) {
  const model = openModel(def)
  if (model) { fitModel(g, def, color, model, w, h); return }
  const k = kit(g, def)
  const fm = k.paint(color, { roughness: 0.38, metalness: 0.2 })
  const dark = k.paint('#2A2A2E', { roughness: 0.6 })
  const bw = 0.06, dp = 0.08

  // الحلق الخارجي
  k.rb(w, bw, dp, 0, bw / 2, 0, fm)
  k.rb(w, bw, dp, 0, h - bw / 2, 0, fm)
  k.rb(bw, h, dp, -w / 2 + bw / 2, h / 2, 0, fm)
  k.rb(bw, h, dp, w / 2 - bw / 2, h / 2, 0, fm)
  const iw = w - 2 * bw, ih = h - 2 * bw

  if (def.design === 'sliding') {
    const sw = iw / 2 + 0.02, sb = 0.04
    const sash = (cx: number, z: number) => {
      k.rb(sw, sb, 0.03, cx, bw + sb / 2, z, fm, 0.004); k.rb(sw, sb, 0.03, cx, h - bw - sb / 2, z, fm, 0.004)
      k.rb(sb, ih, 0.03, cx - sw / 2 + sb / 2, h / 2, z, fm, 0.004); k.rb(sb, ih, 0.03, cx + sw / 2 - sb / 2, h / 2, z, fm, 0.004)
    }
    sash(-(iw / 2 - sw / 2), 0.018)
    sash(iw / 2 - sw / 2, -0.018)
    k.rb(iw, 0.012, 0.07, 0, bw + 0.006, 0, dark, 0.003)               // مسار السحب
    k.rb(0.02, 0.11, 0.022, 0.02, h * 0.5, 0.045, k.metal, 0.006)      // مقبض السحاب
  } else if (def.design === 'casement') {
    const sw = (iw - 0.05) / 2, sb = 0.045
    k.rb(0.05, ih, 0.06, 0, h / 2, 0, fm, 0.005)                        // القاطع الأوسط
    for (const s of [-1, 1]) {
      const cx = s * (0.025 + sw / 2)
      k.rb(sw, sb, 0.035, cx, bw + sb / 2, 0, fm, 0.004); k.rb(sw, sb, 0.035, cx, h - bw - sb / 2, 0, fm, 0.004)
      k.rb(sb, ih, 0.035, cx - sw / 2 + sb / 2, h / 2, 0, fm, 0.004); k.rb(sb, ih, 0.035, cx + sw / 2 - sb / 2, h / 2, 0, fm, 0.004)
      k.rb(0.09, 0.02, 0.02, s * 0.075, h * 0.45, 0.045, k.metal, 0.006)  // مقبض كل ضلفة
      k.rb(0.04, 0.12, 0.01, s * 0.04, h * 0.45, 0.034, k.metal, 0.004)
    }
  } else {
    k.rb(iw, 0.02, 0.05, 0, bw + 0.01, 0, fm, 0.003); k.rb(iw, 0.02, 0.05, 0, h - bw - 0.01, 0, fm, 0.003)
    k.rb(0.02, ih, 0.05, -iw / 2 + 0.01, h / 2, 0, fm, 0.003); k.rb(0.02, ih, 0.05, iw / 2 - 0.01, h / 2, 0, fm, 0.003)
  }

  // حافة رخام جوه وبرّه، وكسوة بيضا على وش الغرفة
  const sill = k.paint(SOFT, { roughness: 0.2, metalness: 0 })
  k.rb(w + 0.16, 0.03, T + 0.14, 0, -0.015, 0.04, sill, 0.008)
  k.rb(w + 0.1, 0.02, 0.1, 0, -0.01, -T / 2 - 0.05, k.paint('#B9B6AE', { roughness: 0.6 }), 0.005)
  const tm = k.paint(SOFT, { roughness: 0.5, metalness: 0 })
  k.rb(w + 0.16, 0.05, 0.012, 0, h + 0.025, T / 2 + 0.006, tm, 0.004)
  k.rb(0.05, h + 0.05, 0.012, -w / 2 - 0.025, h / 2 + 0.025, T / 2 + 0.006, tm, 0.004)
  k.rb(0.05, h + 0.05, 0.012, w / 2 + 0.025, h / 2 + 0.025, T / 2 + 0.006, tm, 0.004)
}

// مشهد المعاينة في لوحة الإدارة: حيطة فيها الفتحة والباب أو الشباك
export function buildPreview(def: FrameDef, color: string): THREE.Group {
  const g = new THREE.Group(), T = 0.12
  const door = def.kind === 'door'
  const w = door ? 0.9 : 1.6, h = door ? 2.1 : 1.2, sill = door ? 0 : 0.9
  const WH = 2.7, WW = w + 1.4
  const wm = new THREE.MeshStandardMaterial({ color: '#E8E4DA', roughness: 0.9 })
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material = wm) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m)
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh)
  }
  const side = (WW - w) / 2
  box(side, WH, T, -(w / 2 + side / 2), WH / 2, 0)
  box(side, WH, T, w / 2 + side / 2, WH / 2, 0)
  box(w, WH - sill - h, T, 0, sill + h + (WH - sill - h) / 2, 0)
  if (sill > 0) box(w, sill, T, 0, sill / 2, 0)
  const sub = new THREE.Group(); sub.position.set(0, sill, 0); g.add(sub)
  if (door) drawDoor(sub, def, color, w, T)
  else {
    drawWindow(sub, def, color, w, h, T)
    sub.add((() => { const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, h - 0.12, 0.01), new THREE.MeshStandardMaterial({ color: '#CFE6F5', transparent: true, opacity: 0.3, roughness: 0.05, envMapIntensity: 1, depthWrite: false })); m.position.set(0, h / 2, 0); return m })())
  }
  return g
}