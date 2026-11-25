import * as THREE from 'three'
import { byId } from '../data/catalog'
import type { FloorConfig, FloorMaterial, Layout } from '../data/catalog'
import { getPhoto } from '../data/matStore'

interface Rect { x: number; y: number; w: number; h: number; key: number; vertical: boolean }
interface Plan { pw: number; ph: number; rects: Rect[] }
interface Canvases { color: HTMLCanvasElement; bump: HTMLCanvasElement; pw: number; ph: number }
type Ctx = CanvasRenderingContext2D

const hash = (a: number, b: number) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const adj = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + f))))
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}
const wrapKey = (x: number, y: number, pw: number, ph: number) =>
  Math.floor(hash(Math.round((((x % pw) + pw) % pw) * 1000), Math.round((((y % ph) + ph) % ph) * 1000)) * 1e9)

// ===== صورة الخامة الحقيقية (للخامات المضافة من لوحة الإدارة) =====
const tileCache = new Map<string, HTMLCanvasElement>()
function tileSrc(m: FloorMaterial, cfg: FloorConfig): CanvasImageSource | null {
  const p = m.photo
  if (!p) return null
  const img = getPhoto(p.id)
  if (!img) return null
  if (!p.colorable) return img
  // قابلة للتلوين: نحوّلها لدرجات رمادي بسطوع ثابت وبعدين نضربها في لون العميل (عشان النقش يفضل ظاهر)
  const key = [p.id, m.v ?? 0, cfg.color].join('|')
  const hit = tileCache.get(key)
  if (hit) return hit
  const W = 512, H = Math.max(64, Math.round(W * (img.naturalHeight / img.naturalWidth)))
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const x = cv.getContext('2d')!
  x.drawImage(img, 0, 0, W, H)
  const d = x.getImageData(0, 0, W, H), px = d.data
  let sum = 0
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
  const k = Math.min(3, (0.85 * 255) / Math.max(1, sum / (px.length / 4)))
  const n = parseInt(cfg.color.slice(1), 16), cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255
  for (let i = 0; i < px.length; i += 4) {
    const g = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * k
    px[i] = Math.min(255, (g * cr) / 255); px[i + 1] = Math.min(255, (g * cg) / 255); px[i + 2] = Math.min(255, (g * cb) / 255)
  }
  x.putImageData(d, 0, 0)
  tileCache.set(key, cv)
  if (tileCache.size > 24) tileCache.delete(tileCache.keys().next().value as string)
  return cv
}

// بيرسم البلاطة (ولو "تدوير عشوائي" مفعّل بيدوّرها 0/90/180/270 للمربعة، و0/180 للمستطيلة)
function drawTile(c: Ctx, src: CanvasImageSource, x: number, y: number, w: number, h: number, rotate: boolean, rnd: () => number) {
  if (!rotate) { c.drawImage(src, x, y, w, h); return }
  const k = Math.abs(w - h) < 1 ? Math.floor(rnd() * 4) : Math.floor(rnd() * 2) * 2
  c.save()
  c.translate(x + w / 2, y + h / 2)
  c.rotate((k * Math.PI) / 2)
  const sw = k % 2 ? h : w, sh = k % 2 ? w : h
  c.drawImage(src, -sw / 2, -sh / 2, sw, sh)
  c.restore()
}

// ===== توزيع البلاطات / الألواح داخل وحدة متكررة (بالمتر) =====
function planFloor(m: FloorMaterial, layout: Layout): Plan {
  const [a, b] = m.size
  const rects: Rect[] = []

  // صورة متصلة: الوحدة كلها صورة واحدة بمقاسها الحقيقي
  if (m.photo?.mode === 'seamless') {
    return { pw: a, ph: b, rects: [{ x: 0, y: 0, w: a, h: b, key: 7, vertical: false }] }
  }

  if (m.pattern === 'plain' || m.pattern === 'carpet') {
    return { pw: 1, ph: 1, rects: [{ x: 0, y: 0, w: 1, h: 1, key: 7, vertical: false }] }
  }

  if (m.pattern === 'plank' && layout === 'herringbone') {
    // سمكة بزاوية 90°: نقطة الشبكة (k - n*j, k + n*j) × عرض اللوح
    const n = Math.max(3, Math.min(6, Math.round(b / a)))
    const L = n * a, P = 2 * n * a
    for (let k = -4 * n; k <= 4 * n; k++) {
      for (let j = -4; j <= 4; j++) {
        const px = (k - n * j) * a, py = (k + n * j) * a
        const kk = wrapKey(px, py, P, P)
        if (px < P && px + L > 0 && py < P && py + a > 0) rects.push({ x: px, y: py, w: L, h: a, key: kk, vertical: false })
        const vx = px + L, vy = py + a - L
        if (vx < P && vx + a > 0 && vy < P && vy + L > 0) rects.push({ x: vx, y: vy, w: a, h: L, key: kk ^ 0x5bd1e995, vertical: true })
      }
    }
    return { pw: P, ph: P, rects }
  }

  if (m.pattern === 'plank') {
    const rows = 2 * Math.max(1, Math.round(0.6 / a)), pw = b * 2, ph = rows * a
    for (let r = 0; r < rows; r++) {
      const off = layout === 'brick' ? ((r % 2) * b) / 2 : 0
      for (let c = -1; c <= 2; c++) {
        const x = off + c * b, y = r * a
        rects.push({ x, y, w: b, h: a, key: wrapKey(x, y, pw, ph), vertical: false })
      }
    }
    return { pw, ph, rects }
  }

  const nx = Math.max(1, Math.round(1.2 / a)), ny = 2 * Math.max(1, Math.round(0.6 / b))
  const pw = nx * a, ph = ny * b
  for (let r = 0; r < ny; r++) {
    const off = layout === 'brick' && r % 2 ? a / 2 : 0
    for (let c = -1; c <= nx; c++) {
      const x = off + c * a, y = r * b
      rects.push({ x, y, w: a, h: b, key: wrapKey(x, y, pw, ph), vertical: false })
    }
  }
  return { pw, ph, rects }
}

// ===== تفاصيل سطح كل بلاطة / لوح (للخامات المرسومة بالكود) =====
function detail(m: FloorMaterial, cfg: FloorConfig, c: Ctx, bp: Ctx, x: number, y: number, w: number, h: number, rnd: () => number, vertical: boolean) {
  if (m.pattern === 'plank') {
    const along = vertical ? h : w, across = vertical ? w : h
    const n = Math.max(5, Math.round(across / 3))
    for (let i = 0; i < n; i++) {
      const p = rnd() * across, al = 0.03 + rnd() * 0.09, dark = rnd() < 0.65, wob = (rnd() - 0.5) * 3, lw = 0.6 + rnd() * 1.6
      const col = dark ? `rgba(40,25,10,${al})` : `rgba(255,236,205,${al})`
      const draw = (ctx: Ctx, stroke: string) => {
        ctx.strokeStyle = stroke
        ctx.lineWidth = lw
        ctx.beginPath()
        if (vertical) { ctx.moveTo(x + p, y); ctx.quadraticCurveTo(x + p + wob, y + along / 2, x + p, y + along) }
        else { ctx.moveTo(x, y + p); ctx.quadraticCurveTo(x + along / 2, y + p + wob, x + along, y + p) }
        ctx.stroke()
      }
      draw(c, col)
      draw(bp, `rgba(0,0,0,${al * 2})`)
    }
    return
  }

  if (m.pattern === 'stone') {
    if (m.look === 'granite') {
      const cnt = Math.round((w * h) / 45)
      for (let i = 0; i < cnt; i++) {
        const t = rnd()
        c.fillStyle = t < 0.45 ? 'rgba(20,20,22,.45)' : t < 0.8 ? 'rgba(240,240,240,.4)' : 'rgba(150,110,100,.35)'
        c.beginPath(); c.arc(x + rnd() * w, y + rnd() * h, 0.5 + rnd() * 1.4, 0, 7); c.fill()
      }
      return
    }
    if (m.look === 'cement') {
      for (let i = 0; i < 8; i++) {
        const cx = x + rnd() * w, cy = y + rnd() * h, rad = (0.2 + rnd() * 0.5) * Math.max(w, h)
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad)
        const rgb = rnd() < 0.5 ? '0,0,0' : '255,255,255'
        g.addColorStop(0, `rgba(${rgb},.07)`); g.addColorStop(1, `rgba(${rgb},0)`)
        c.fillStyle = g; c.fillRect(x, y, w, h)
      }
      return
    }
    const vein = lum(cfg.color) < 90 ? '214,180,110' : '95,100,112'
    for (let i = 0; i < 4; i++) {
      const cx = x + rnd() * w, cy = y + rnd() * h, rad = (0.25 + rnd() * 0.4) * Math.max(w, h)
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad)
      g.addColorStop(0, `rgba(${vein},.10)`); g.addColorStop(1, `rgba(${vein},0)`)
      c.fillStyle = g; c.fillRect(x, y, w, h)
    }
    const nv = 3 + Math.floor(rnd() * 3)
    for (let i = 0; i < nv; i++) {
      c.strokeStyle = `rgba(${vein},${0.25 + rnd() * 0.3})`
      c.lineWidth = 0.6 + rnd() * 2.2
      c.beginPath()
      c.moveTo(x + rnd() * w, y)
      c.bezierCurveTo(x + rnd() * w, y + h * 0.33, x + rnd() * w, y + h * 0.66, x + rnd() * w, y + h)
      c.stroke()
    }
    return
  }

  if (m.pattern === 'tile') {
    const cnt = Math.round((w * h) / 300)
    for (let i = 0; i < cnt; i++) {
      c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.06)'
      c.fillRect(x + rnd() * w, y + rnd() * h, 1.5, 1.5)
    }
    return
  }

  if (m.pattern === 'carpet') {
    const cnt = Math.round((w * h) / 8)
    for (let i = 0; i < cnt; i++) {
      const px = x + rnd() * w, py = y + rnd() * h, d = rnd() < 0.5
      c.fillStyle = d ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.14)'
      c.fillRect(px, py, 1.5, 1.5)
      bp.fillStyle = d ? '#808080' : '#d8d8d8'
      bp.fillRect(px, py, 1.5, 1.5)
    }
    return
  }

  // epoxy: غيوم ناعمة
  for (let i = 0; i < 6; i++) {
    const cx = x + rnd() * w, cy = y + rnd() * h, rad = (0.2 + rnd() * 0.4) * Math.max(w, h)
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad)
    g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g; c.fillRect(x, y, w, h)
  }
}

function paint(m: FloorMaterial, cfg: FloorConfig, plan: Plan): Canvases {
  const CW = 1024, ppm = CW / plan.pw
  const CH = Math.max(64, Math.min(2048, Math.round(plan.ph * ppm)))
  const mk = () => { const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; return cv }
  const color = mk(), bump = mk()
  const c = color.getContext('2d')!, bp = bump.getContext('2d')!
  const src = tileSrc(m, cfg) // صورة الخامة الحقيقية لو الخامة مضافة من لوحة الإدارة

  // خامة متصلة: الصورة كلها على الوحدة
  if (src && m.photo?.mode === 'seamless') {
    c.drawImage(src, 0, 0, CW, CH)
    bp.fillStyle = '#808080'; bp.fillRect(0, 0, CW, CH)
    bp.globalAlpha = 0.5; bp.drawImage(src, 0, 0, CW, CH); bp.globalAlpha = 1
    return { color, bump, pw: plan.pw, ph: plan.ph }
  }

  const grout = m.grout && (m.pattern === 'tile' || m.pattern === 'stone' || !!m.photo) ? Math.max(1.2, (cfg.groutMm / 1000) * ppm) : 0
  const gap = grout || (m.pattern === 'plank' ? 1 : 0)
  c.fillStyle = grout ? cfg.groutColor : adj(cfg.color, -0.25); c.fillRect(0, 0, CW, CH)
  bp.fillStyle = '#303030'; bp.fillRect(0, 0, CW, CH)

  plan.rects.forEach((r) => {
    const x = r.x * ppm + gap / 2, y = r.y * ppm + gap / 2, w = r.w * ppm - gap, h = r.h * ppm - gap
    if (x > CW || y > CH || x + w < 0 || y + h < 0) return
    const rnd = rng(r.key)
    const shade = (rnd() - 0.5) * (m.pattern === 'plank' ? 0.16 : m.pattern === 'tile' ? 0.05 : 0.07)
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip()
    if (src) {
      drawTile(c, src, x, y, w, h, !!m.photo?.rotate, rnd)
      c.fillStyle = shade > 0 ? `rgba(255,255,255,${shade * 0.5})` : `rgba(0,0,0,${-shade * 0.5})`
      c.fillRect(x, y, w, h)
    } else {
      c.fillStyle = adj(cfg.color, shade); c.fillRect(x, y, w, h)
    }
    bp.save(); bp.beginPath(); bp.rect(x, y, w, h); bp.clip()
    bp.fillStyle = '#c8c8c8'; bp.fillRect(x, y, w, h)
    if (src) { bp.globalAlpha = 0.3; bp.drawImage(src, x, y, w, h); bp.globalAlpha = 1 }
    else detail(m, cfg, c, bp, x, y, w, h, rnd, r.vertical)
    c.restore(); bp.restore()
  })
  return { color, bump, pw: plan.pw, ph: plan.ph }
}

const cache = new Map<string, Canvases>()
// mat اختياري: بيستخدم لمعاينة خامة لسه ما اتحفظتش في لوحة الإدارة
export function floorCanvas(cfg: FloorConfig, mat?: FloorMaterial): Canvases {
  const m = mat ?? byId(cfg.material)
  const k = [
    m.id, m.v ?? 0, m.size.join('x'), m.grout ? 1 : 0,
    m.photo ? [m.photo.mode, m.photo.rotate, m.photo.colorable].join('') : '',
    cfg.color, cfg.layout, cfg.groutColor, cfg.groutMm,
  ].join('|')
  let v = cache.get(k)
  if (!v) {
    v = paint(m, cfg, planFloor(m, cfg.layout))
    cache.set(k, v)
    if (cache.size > 16) cache.delete(cache.keys().next().value as string)
  }
  return v
}

// خامات three.js لغرفة بأبعاد معينة (الصورة بتتكرر بالمقاس الحقيقي)
export function floorTextures(cfg: FloorConfig, W: number, L: number, aniso: number) {
  const m = byId(cfg.material), d = floorCanvas(cfg)
  const mk = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(W / d.pw, L / d.ph)
    t.anisotropy = aniso
    if (cfg.layout === 'diagonal') { t.center.set(0.5, 0.5); t.rotation = Math.PI / 4 }
    return t
  }
  return { map: mk(d.color), bump: mk(d.bump), rough: m.rough }
}

// صورة مصغرة لعرض الخامة في القائمة
const thumbs: Record<string, string> = {}
export function floorThumb(m: FloorMaterial): string {
  const key = m.id + '|' + (m.v ?? 0)
  if (!thumbs[key]) {
    const d = floorCanvas({ material: m.id, color: m.base, layout: m.pattern === 'plank' ? 'brick' : 'straight', groutColor: m.groutColor ?? '#C9C5BC', groutMm: m.groutMm ?? 3 }, m)
    const t = document.createElement('canvas'); t.width = t.height = 96
    t.getContext('2d')!.drawImage(d.color, 0, 0, d.color.width, Math.min(d.color.height, d.color.width), 0, 0, 96, 96)
    thumbs[key] = t.toDataURL()
  }
  return thumbs[key]
}