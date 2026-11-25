import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FurnDef, FurnItem } from '../furniture'
import { furnImage } from '../data/furnStore'
import { addBlob } from './paint'

export interface FurnCtx { fabric: string; wood: string; aniso: number }

// خريطة نسيج القماش (normalMap): نسيج متقاطع + ضوضاء خفيفة، بتلف على نفسها من غير حدود
let weave: THREE.CanvasTexture | null = null
function fabricNormal() {
  if (weave) return weave
  const S = 128, h = new Float32Array(S * S)
  let seed = 7
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = 0.5 + 0.22 * Math.sin((x * Math.PI) / 2) * Math.sin((y * Math.PI) / 2) + (rnd() - 0.5) * 0.18
  const g = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)]
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (g(x - 1, y) - g(x + 1, y)) * 2.2, ny = (g(x, y - 1) - g(x, y + 1)) * 2.2, len = Math.hypot(nx, ny, 1)
      const k = (y * S + x) * 4
      img.data[k] = (nx / len * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / len * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / len * 0.5 + 0.5) * 255; img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  weave = new THREE.CanvasTexture(cv)
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping
  return weave
}

// بيلوّن خامات الموديل الحقيقي: كل الخامات، أو اللي اسمها فيه match (مثلاً fabric)
function tintModel(root: THREE.Object3D, hex: string, match?: string) {
  const key = (match ?? '').trim().toLowerCase()
  root.traverse((n) => {
    const mesh = n as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const out = mats.map((mt) => {
      const sm = mt as THREE.MeshStandardMaterial
      if (!sm.color || (key && !(sm.name || '').toLowerCase().includes(key))) return mt
      const c = sm.clone()
      c.color.set(hex)
      return c
    })
    mesh.material = Array.isArray(mesh.material) ? out : out[0]
  })
}

// بيبني قطعة فرش: الأصل في منتصف قاعدتها على الأرضية، ووشها ناحية +z
export function buildItem(it: FurnItem, d: FurnDef, ctx: FurnCtx, glb: THREE.Object3D | null): THREE.Group {
  const grp = new THREE.Group()
  grp.position.set(it.x, it.y, it.z); grp.rotation.y = it.rot; grp.userData.furnId = it.id

  // لون اختاره العميل للقطعة دي (قماش أو خشب حسب نوعها)
  const fabricC = d.colorRole === 'fabric' && it.color ? it.color : ctx.fabric
  const woodC = d.colorRole === 'wood' && it.color ? it.color : ctx.wood

  // الخشب والمعادن العادية (Standard)
  const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, envMapIntensity: 0.25, ...o })

  // خامة القماش (MeshPhysicalMaterial) مع لمسة المخمل/الوبرة (Sheen)
  const fab = (c: string, o: THREE.MeshPhysicalMaterialParameters = {}) => {
    const n = fabricNormal().clone()
    n.needsUpdate = true
    n.repeat.set(24, 24)
    return new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.15,
      sheen: 0.75,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(c).offsetHSL(0, -0.05, 0.18),
      normalMap: n,
      normalScale: new THREE.Vector2(0.85, 0.85),
      ...o,
    })
  }
  const wd = () => std(woodC, { roughness: 0.55 })
  // y = ارتفاع القاعدة من الأرضية
  const rb = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material, r = 0.02) => {
    const rr = Math.max(0.002, Math.min(r, sx / 2 - 0.001, sy / 2 - 0.001, sz / 2 - 0.001))
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, rr), m)
    mesh.position.set(x, y + sy / 2, z); mesh.castShadow = true; mesh.receiveShadow = true
    grp.add(mesh); return mesh
  }
  const cyl = (rt: number, rbt: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rbt, h, seg), m)
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true
    grp.add(mesh); return mesh
  }
  const metal = std('#3B3B3F', { metalness: 0.6, roughness: 0.4 })
  const gold = std('#B8975A', { metalness: 0.8, roughness: 0.3 })
  const white = std('#F2F0EB', { roughness: 0.2 })
  const dark = std('#2A2A2E', { roughness: 0.6 })
  const stone = std('#EDEBE6', { roughness: 0.2 })
  const { w, d: dp } = d

  if (d.custom && d.mode === 'rug') {
    // سجادة من صورة مرفوعة (مفروشة على الأرضية بمقاسها الحقيقي)
    const img = furnImage(d.kind)
    const tex = img ? new THREE.Texture(img) : null
    if (tex) { tex.needsUpdate = true; tex.anisotropy = ctx.aniso }
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.015, dp),
      new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : '#CFC8BC', map: tex ?? undefined, roughness: 1 }),
    )
    mesh.position.y = 0.0075; mesh.receiveShadow = true
    grp.add(mesh)
  } else if (glb) {
    // موديل glb حقيقي: بنحجّمه على مقاسات القطعة وبنحطه على الأرضية
    const m = glb.clone(true)
    if (d.custom && d.colorRole && d.colorRole !== 'none') tintModel(m, d.colorRole === 'fabric' ? fabricC : woodC, d.matMatch)
    const scaler = new THREE.Group(), pivot = new THREE.Group()
    pivot.rotation.y = d.modelRot ?? 0
    pivot.add(m); scaler.add(pivot)
    const s1 = new THREE.Box3().setFromObject(scaler).getSize(new THREE.Vector3())
    let sx = w / (s1.x || 1), sy = d.h / (s1.y || 1), sz = dp / (s1.z || 1)
    if (d.fit === 'contain') { const k = Math.min(sx, sy, sz); sx = sy = sz = k }
    scaler.scale.set(sx, sy, sz)
    const b2 = new THREE.Box3().setFromObject(scaler), ctr = b2.getCenter(new THREE.Vector3())
    scaler.position.set(-ctr.x, -b2.min.y, -ctr.z)
    scaler.traverse((n) => { if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true } })
    grp.add(scaler)
  } else {
    switch (d.kind) {
      case 'sofa': case 'armchair': {
        const fm = fab(fabricC)
        const legH = 0.08
        const arm = d.kind === 'sofa' ? 0.22 : 0.14
        const seatW = w - 2 * arm
        const n = d.kind === 'sofa' ? 3 : 1

        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            cyl(0.022, 0.016, legH, sx * (w / 2 - 0.1), 0, sz * (dp / 2 - 0.1), metal, 12)
          }
        }
        rb(w, 0.18, dp, 0, legH, 0, fm, 0.06)
        for (let i = 0; i < n; i++) {
          const cx = -seatW / 2 + ((i + 0.5) * seatW) / n
          rb(seatW / n - 0.015, 0.16, dp - 0.22, cx, legH + 0.17, 0.09, fm, 0.07)
        }
        rb(w - 0.04, 0.48, 0.22, 0, legH + 0.18, -dp / 2 + 0.11, fm, 0.08)
        rb(arm, 0.34, dp - 0.02, -w / 2 + arm / 2, legH + 0.17, 0.01, fm, 0.09)
        rb(arm, 0.34, dp - 0.02, w / 2 - arm / 2, legH + 0.17, 0.01, fm, 0.09)

        if (d.kind === 'sofa') {
          const pillowMat1 = fab('#2A3B53', { sheenColor: new THREE.Color('#4E6A94') })
          const pillowMat2 = fab('#C4B49A', { sheenColor: new THREE.Color('#E3D6C1') })
          rb(0.44, 0.42, 0.14, -0.65, legH + 0.32, -dp / 2 + 0.28, pillowMat1, 0.07).rotation.x = -0.22
          rb(0.44, 0.42, 0.14, 0.65, legH + 0.32, -dp / 2 + 0.28, pillowMat2, 0.07).rotation.x = -0.22
        }
        break
      }
      case 'coffee': {
        rb(w, 0.04, dp, 0, 0.41, 0, stone, 0.01)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.015, 0.015, 0.41, sx * (w / 2 - 0.08), 0, sz * (dp / 2 - 0.08), gold, 8)
        break
      }
      case 'tvunit': {
        rb(w, 0.34, dp, 0, 0.15, 0, wd(), 0.01)
        for (const sx of [-1, 1]) rb(0.05, 0.15, 0.3, sx * (w / 2 - 0.1), 0, 0, dark, 0.005)
        for (let i = 1; i < 3; i++) rb(0.01, 0.28, 0.005, -w / 2 + (i * w) / 3, 0.18, dp / 2, dark, 0.002)
        rb(w * 0.72, 0.72, 0.04, 0, 0.85, -dp / 2 + 0.03, std('#111114', { roughness: 0.25 }), 0.008) // تلفزيون معلّق
        break
      }
      case 'rug': {
        const rugTex = fabricNormal().clone()
        rugTex.needsUpdate = true
        rugTex.repeat.set(30, 30)
        const rugMat = new THREE.MeshStandardMaterial({
          color: '#D1CAC0', roughness: 1.0, metalness: 0.0, normalMap: rugTex, normalScale: new THREE.Vector2(0.4, 0.4),
        })
        rb(w, 0.015, dp, 0, 0, 0, rugMat, 0.005)
        break
      }
      case 'dining': {
        rb(1.6, 0.05, 0.9, 0, 0.7, 0, wd(), 0.015)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(0.07, 0.7, 0.07, sx * 0.72, 0, sz * 0.38, wd(), 0.01)
        const chair = (cx: number, cz: number) => {
          const g2 = new THREE.Group(); g2.position.set(cx, 0, cz); g2.rotation.y = Math.atan2(-cx, -cz); grp.add(g2)
          const part = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) => {
            const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(0.01, sx / 2 - 0.001, sy / 2 - 0.001, sz / 2 - 0.001)), m)
            mesh.position.set(x, y + sy / 2, z); mesh.castShadow = true; g2.add(mesh)
          }
          const cm = fab('#3B3B3F')
          part(0.42, 0.05, 0.42, 0, 0.43, 0, cm); part(0.42, 0.42, 0.05, 0, 0.5, -0.19, cm)
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(0.04, 0.43, 0.04, sx * 0.18, 0, sz * 0.18, metal)
        }
        for (const x of [-0.45, 0.45]) for (const z of [-0.65, 0.65]) chair(x, z)
        chair(-1.0, 0); chair(1.0, 0)
        break
      }
      case 'console': case 'desk': {
        const lh = d.kind === 'desk' ? 0.71 : 0.74
        rb(w, 0.04, dp, 0, lh, 0, wd(), 0.01)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(0.04, lh, 0.04, sx * (w / 2 - 0.05), 0, sz * (dp / 2 - 0.05), d.kind === 'desk' ? wd() : gold, 0.005)
        break
      }
      case 'bed': case 'bedS': {
        const pil = fab('#F2F0EB')
        rb(w + 0.04, 0.95, 0.1, 0, 0.05, -dp / 2 + 0.05, fab(fabricC), 0.04)
        rb(w, 0.25, dp - 0.02, 0, 0.12, 0.01, std('#6B5442', { roughness: 0.6 }), 0.02)
        rb(w - 0.04, 0.22, dp - 0.12, 0, 0.37, 0.04, std('#F4F2EE', { roughness: 0.85 }), 0.05)
        rb(w - 0.02, 0.05, dp * 0.58, 0, 0.585, dp * 0.18, fab(fabricC), 0.03)
        const np = d.kind === 'bed' ? 2 : 1
        for (let i = 0; i < np; i++) rb(0.55, 0.13, 0.36, np === 1 ? 0 : (i - 0.5) * (w / 2), 0.59, -dp / 2 + 0.4, pil, 0.05)
        break
      }
      case 'night': {
        rb(w, 0.5, dp, 0, 0, 0, wd(), 0.015)
        rb(0.38, 0.01, 0.005, 0, 0.34, dp / 2, dark, 0.002)
        rb(0.38, 0.01, 0.005, 0, 0.17, dp / 2, dark, 0.002)
        break
      }
      case 'wardrobe': {
        rb(w, 2.1, dp, 0, 0, 0, wd(), 0.012)
        const n = Math.max(2, Math.round(w / 0.6))
        for (let i = 1; i < n; i++) rb(0.008, 2.0, 0.005, -w / 2 + (i * w) / n, 0.05, dp / 2, dark, 0.002)
        for (let i = 0; i < n; i += 2) rb(0.02, 0.35, 0.02, -w / 2 + ((i + 1) * w) / n - 0.05, 1.0, dp / 2 + 0.01, gold, 0.005)
        break
      }
      case 'kitchenrun': {
        rb(w, 0.86, dp, 0, 0, 0, wd(), 0.01)
        rb(w + 0.02, 0.04, dp + 0.02, 0, 0.86, 0.01, stone, 0.01)
        rb(0.5, 0.012, 0.4, -w / 4, 0.9, 0.02, std('#B9BEC4', { metalness: 0.7, roughness: 0.3 }), 0.004)
        rb(0.55, 0.012, 0.45, w / 4, 0.9, 0.02, std('#161618', { roughness: 0.3 }), 0.004)
        const n = Math.round(w / 0.6)
        for (let i = 1; i < n; i++) rb(0.008, 0.7, 0.005, -w / 2 + (i * w) / n, 0.1, dp / 2, dark, 0.002)
        break
      }
      case 'fridge': {
        const st = std('#C9CDD2', { metalness: 0.5, roughness: 0.35 })
        rb(w, 1.8, dp, 0, 0, 0, st, 0.03)
        rb(0.012, 0.6, 0.02, -0.06, 0.9, dp / 2 + 0.01, dark, 0.004)
        rb(0.012, 0.5, 0.02, 0.06, 1.2, dp / 2 + 0.01, dark, 0.004)
        rb(w - 0.02, 0.01, 0.005, 0, 1.15, dp / 2, dark, 0.002)
        break
      }
      case 'vanity': {
        rb(w, 0.7, dp, 0, 0, 0, wd(), 0.01)
        rb(w, 0.03, dp, 0, 0.7, 0, stone, 0.008)
        rb(0.4, 0.02, 0.3, 0, 0.73, 0.02, std('#FFFFFF', { roughness: 0.1 }), 0.01)
        cyl(0.012, 0.012, 0.18, 0, 0.75, -0.12, std('#C8C8CC', { metalness: 0.9, roughness: 0.2 }), 8)
        rb(0.5, 0.7, 0.02, 0, 1.15, -dp / 2 + 0.012, std('#CFE8F5', { roughness: 0.05, metalness: 0.6 }), 0.008)
        break
      }
      case 'toilet': {
        rb(0.38, 0.4, 0.5, 0, 0, 0.08, white, 0.1)
        rb(0.36, 0.4, 0.18, 0, 0.38, -dp / 2 + 0.1, white, 0.03)
        break
      }
      case 'shower': {
        const gl = std('#BFE3FF', { transparent: true, opacity: 0.25, roughness: 0.05 })
        rb(w, 0.06, dp, 0, 0, 0, std('#EFEFEF', { roughness: 0.3 }), 0.01)
        rb(w, 1.9, 0.015, 0, 0.06, dp / 2 - 0.01, gl, 0.004)
        rb(0.015, 1.9, dp, w / 2 - 0.01, 0.06, 0, gl, 0.004)
        cyl(0.012, 0.012, 1.8, -0.35, 0.1, -dp / 2 + 0.05, std('#C8C8CC', { metalness: 0.9, roughness: 0.2 }), 8)
        break
      }
      case 'vase': {
        cyl(0.055, 0.04, 0.2, 0, 0, 0, std('#B9D3E0', { transparent: true, opacity: 0.7, roughness: 0.05 }))
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), std('#EDEBDC', { roughness: 0.9 }))
        fl.position.set(0, 0.27, 0); grp.add(fl)
        break
      }
      case 'lamp': {
        cyl(0.07, 0.09, 0.2, 0, 0, 0, gold)
        cyl(0.1, 0.14, 0.2, 0, 0.2, 0, std('#F3E9D2', { roughness: 0.9 }), 20)
        break
      }
      case 'plant': {
        cyl(0.17, 0.13, 0.3, 0, 0, 0, std('#8A6F58', { roughness: 0.8 }), 20)
        cyl(0.02, 0.025, 0.55, 0, 0.3, 0, std('#5B7A44'), 8)
        const lm = std('#3F7A4A', { roughness: 0.75 })
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2, hh = 0.6 + (k % 3) * 0.2
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lm)
          leaf.scale.set(1, 1.7, 0.45)
          leaf.position.set(Math.cos(a) * 0.17, hh + 0.3, Math.sin(a) * 0.17)
          leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
          leaf.castShadow = true; grp.add(leaf)
        }
        break
      }
      case 'bookshelf': {
        const mw = wd()
        rb(0.03, 1.9, dp, -w / 2 + 0.015, 0, 0, mw, 0.005); rb(0.03, 1.9, dp, w / 2 - 0.015, 0, 0, mw, 0.005)
        rb(w, 0.03, dp, 0, 0, 0, mw, 0.005); rb(w, 0.03, dp, 0, 1.87, 0, mw, 0.005)
        rb(w - 0.04, 1.9, 0.01, 0, 0, -dp / 2 + 0.005, mw, 0.002)
        const cols = ['#7A4B3A', '#3B4A6B', '#B9A98C', '#5B6B3F', '#8A3B3B', '#2A2A2E']
        for (let r = 0; r < 5; r++) {
          const y = 0.02 + r * 0.37
          if (r > 0) rb(w - 0.06, 0.025, dp - 0.02, 0, y, 0, mw, 0.004)
          let x = -w / 2 + 0.06, i = 0
          while (x < w / 2 - 0.1) {
            const bw = 0.03 + ((i * 7) % 4) * 0.01, bh = 0.2 + ((i * 5) % 4) * 0.03
            rb(bw, bh, dp - 0.1, x + bw / 2, y + 0.025, 0.01, std(cols[(i + r) % cols.length], { roughness: 0.8 }), 0.003)
            x += bw + 0.004; i++
            if ((i + r) % 9 === 0) x += 0.18
          }
        }
        break
      }
      case 'sideboard': {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.02, 0.015, 0.08, sx * (w / 2 - 0.1), 0, sz * (dp / 2 - 0.08), gold, 8)
        rb(w, 0.7, dp, 0, 0.08, 0, wd(), 0.01)
        rb(w + 0.02, 0.03, dp + 0.02, 0, 0.78, 0, stone, 0.008)
        const n = Math.max(2, Math.round(w / 0.55))
        for (let i = 1; i < n; i++) rb(0.008, 0.62, 0.005, -w / 2 + (i * w) / n, 0.12, dp / 2, dark, 0.002)
        for (let i = 0; i < n; i++) rb(0.015, 0.12, 0.015, -w / 2 + ((i + 0.5) * w) / n, 0.5, dp / 2 + 0.01, gold, 0.004)
        break
      }
      case 'dresser': {
        rb(w, 0.7, dp, 0, 0, 0, wd(), 0.01)
        rb(w + 0.02, 0.03, dp + 0.02, 0, 0.7, 0, stone, 0.008)
        for (let i = 1; i < 3; i++) rb(w - 0.04, 0.008, 0.005, 0, i * 0.22, dp / 2, dark, 0.002)
        for (let i = 0; i < 3; i++) rb(0.14, 0.015, 0.015, 0, 0.1 + i * 0.22, dp / 2 + 0.01, gold, 0.004)
        rb(w * 0.8, 0.85, 0.02, 0, 0.75, -dp / 2 + 0.012, std('#CFE8F5', { roughness: 0.05, metalness: 0.6 }), 0.008)
        break
      }
      case 'shoecab': {
        rb(w, d.h, dp, 0, 0, 0, wd(), 0.01)
        for (let i = 0; i < 6; i++) rb(w - 0.08, 0.012, 0.005, 0, 0.12 + i * 0.16, dp / 2, dark, 0.002)
        rb(0.015, 0.2, 0.015, w / 2 - 0.08, d.h / 2, dp / 2 + 0.01, gold, 0.004)
        break
      }
      case 'washer': {
        rb(w, d.h, dp, 0, 0, 0, white, 0.03)
        const door = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28), std('#9FB4C4', { metalness: 0.3, roughness: 0.1 }))
        door.rotation.x = Math.PI / 2; door.position.set(0, d.h * 0.48, dp / 2 + 0.004); grp.add(door)
        rb(0.5, 0.06, 0.01, 0, d.h - 0.1, dp / 2, std('#2A2A2E', { roughness: 0.4 }), 0.003)
        break
      }
      default: {
        // قطعة بدون موديل (لسه ما اترفعش أو اتلف): مجسم بسيط بمقاساتها عشان متختفيش
        rb(w, d.h, dp, 0, 0, 0, std('#B9B4AA', { roughness: 0.7 }), 0.02)
      }
    }
  }

  // ظل تلامس ناعم تحت القطعة (يلغي إحساس إنها طايرة)
  if (!d.rug && !d.acc) addBlob(grp, 0, 0, w * 0.42, dp * 0.42, 0.4)
  return grp
}