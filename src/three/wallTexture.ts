import * as THREE from 'three'
import type { WallMaterial } from '../data/wallCatalog'

const S = 512
type Ctx = CanvasRenderingContext2D
interface Pair { c: HTMLCanvasElement; b: HTMLCanvasElement }

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
const both = (x: Ctx, y: Ctx, fn: (g: Ctx) => void) => { fn(x); fn(y) }

function paintMat(m: WallMaterial, color: string): Pair {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c }
  const c = mk(), b = mk(), x = c.getContext('2d')!, y = b.getContext('2d')!
  let seed = 7; for (let i = 0; i < m.id.length; i++) seed = (seed * 31 + m.id.charCodeAt(i)) | 0
  const rnd = rng(seed)
  x.fillStyle = color; x.fillRect(0, 0, S, S)
  y.fillStyle = '#808080'; y.fillRect(0, 0, S, S)

  switch (m.id) {
    case 'wp-stripe': {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = adj(color, i % 2 ? -0.1 : 0.08); x.fillRect(i * 64, 0, 64, S)
        y.fillStyle = i % 2 ? '#707070' : '#909090'; y.fillRect(i * 64, 0, 64, S)
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i * 64, 0, 2, S)
      }
      break
    }
    case 'wp-damask': {
      both(x, y, (g) => { g.lineWidth = 3 })
      x.strokeStyle = adj(color, -0.18); y.strokeStyle = '#505050'
      for (let k = -4; k <= 8; k++) {
        both(x, y, (g) => { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128 + S, S); g.moveTo(k * 128, S); g.lineTo(k * 128 + S, 0); g.stroke() })
      }
      for (let a = 0; a <= 4; a++) for (let d = 0; d <= 4; d++) {
        x.fillStyle = adj(color, 0.14); x.beginPath(); x.arc(a * 128, d * 128, 14, 0, 7); x.fill()
        y.fillStyle = '#b0b0b0'; y.beginPath(); y.arc(a * 128, d * 128, 14, 0, 7); y.fill()
      }
      break
    }
    case 'wp-dots': {
      for (let j = -1; j <= 8; j++) for (let i = -1; i <= 8; i++) {
        const px = i * 64 + 32 + (j % 2) * 32, py = j * 64 + 32
        x.fillStyle = adj(color, lum(color) > 140 ? -0.12 : 0.18); x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill()
        y.fillStyle = '#a0a0a0'; y.beginPath(); y.arc(px, py, 10, 0, 7); y.fill()
      }
      break
    }
    case 'wood-slats': {
      x.fillStyle = adj(color, -0.5); x.fillRect(0, 0, S, S)
      y.fillStyle = '#303030'; y.fillRect(0, 0, S, S)
      for (let i = 0; i < 8; i++) {
        x.fillStyle = adj(color, (rnd() - 0.5) * 0.14); x.fillRect(i * 64 + 3, 0, 58, S)
        y.fillStyle = '#c0c0c0'; y.fillRect(i * 64 + 3, 0, 58, S)
        for (let g = 0; g < 10; g++) {
          const gx = i * 64 + 6 + rnd() * 52
          x.strokeStyle = rnd() < 0.6 ? 'rgba(40,25,10,.1)' : 'rgba(255,236,205,.1)'; x.lineWidth = 0.8 + rnd() * 1.4
          x.beginPath(); x.moveTo(gx, 0); x.quadraticCurveTo(gx + (rnd() - 0.5) * 4, S / 2, gx, S); x.stroke()
        }
      }
      break
    }
    case 'panel-3d': {
      for (let px = 0; px < S; px++) {
        const v = Math.sin((px / 64) * Math.PI * 2)
        x.fillStyle = adj(color, v * 0.18); x.fillRect(px, 0, 1, S)
        const g = Math.round(128 + v * 70); y.fillStyle = `rgb(${g},${g},${g})`; y.fillRect(px, 0, 1, S)
      }
      break
    }
    case 'marble-look': {
      const vein = lum(color) < 90 ? '214,180,110' : '95,100,112'
      for (let i = 0; i < 4; i++) {
        const cx = rnd() * S, cy = rnd() * S, rad = 120 + rnd() * 200
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad)
        g.addColorStop(0, `rgba(${vein},.10)`); g.addColorStop(1, `rgba(${vein},0)`)
        x.fillStyle = g; x.fillRect(0, 0, S, S)
      }
      for (let i = 0; i < 7; i++) {
        x.strokeStyle = `rgba(${vein},${0.25 + rnd() * 0.3})`; x.lineWidth = 0.6 + rnd() * 2.2
        x.beginPath(); x.moveTo(rnd() * S, 0)
        x.bezierCurveTo(rnd() * S, S * 0.33, rnd() * S, S * 0.66, rnd() * S, S); x.stroke()
      }
      break
    }
    case 'stone-ledger': {
      x.fillStyle = adj(color, -0.5); x.fillRect(0, 0, S, S)
      y.fillStyle = '#303030'; y.fillRect(0, 0, S, S)
      const rows = 8, rh = S / rows
      for (let r = 0; r < rows; r++) {
        let px = 0
        while (px < S) {
          let w = 70 + rnd() * 110
          if (S - px - w < 50) w = S - px
          x.fillStyle = adj(color, (rnd() - 0.5) * 0.3); x.fillRect(px + 2, r * rh + 2, w - 4, rh - 4)
          y.fillStyle = `rgb(${170 + Math.floor(rnd() * 60)},${170 + Math.floor(rnd() * 60)},${170 + Math.floor(rnd() * 60)})`; y.fillRect(px + 2, r * rh + 2, w - 4, rh - 4)
          for (let k = 0; k < 14; k++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'; x.fillRect(px + 4 + rnd() * (w - 8), r * rh + 4 + rnd() * (rh - 8), 3, 2) }
          px += w
        }
      }
      break
    }
    case 'brick': {
      x.fillStyle = '#BDB8AE'; x.fillRect(0, 0, S, S)
      y.fillStyle = '#303030'; y.fillRect(0, 0, S, S)
      for (let r = 0; r < 8; r++) {
        const off = (r % 2) * 64
        for (let cI = -1; cI < 5; cI++) {
          const bx = cI * 128 + off
          x.fillStyle = adj(color, (rnd() - 0.5) * 0.25); x.fillRect(bx + 3, r * 64 + 3, 122, 58)
          y.fillStyle = '#d0d0d0'; y.fillRect(bx + 3, r * 64 + 3, 122, 58)
          for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(bx + 6 + rnd() * 112, r * 64 + 6 + rnd() * 50, 3, 3) }
        }
      }
      break
    }
    case 'tile-subway': {
      x.fillStyle = '#CFCBC2'; x.fillRect(0, 0, S, S)
      y.fillStyle = '#303030'; y.fillRect(0, 0, S, S)
      const rh = S / 6, tw = S / 2
      for (let r = 0; r < 6; r++) {
        const off = (r % 2) * (tw / 2)
        for (let cI = -1; cI < 3; cI++) {
          const tx = cI * tw + off
          x.fillStyle = adj(color, (rnd() - 0.5) * 0.04); x.fillRect(tx + 2, r * rh + 2, tw - 4, rh - 4)
          const g = x.createLinearGradient(tx, r * rh, tx, r * rh + rh)
          g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.06)')
          x.fillStyle = g; x.fillRect(tx + 2, r * rh + 2, tw - 4, rh - 4)
          y.fillStyle = '#d0d0d0'; y.fillRect(tx + 2, r * rh + 2, tw - 4, rh - 4)
        }
      }
      break
    }
    case 'tile-square': {
      x.fillStyle = '#CFCBC2'; x.fillRect(0, 0, S, S)
      y.fillStyle = '#303030'; y.fillRect(0, 0, S, S)
      for (let cI = 0; cI < 2; cI++) {
        x.fillStyle = adj(color, (rnd() - 0.5) * 0.05); x.fillRect(cI * 256 + 3, 3, 250, 506)
        y.fillStyle = '#d0d0d0'; y.fillRect(cI * 256 + 3, 3, 250, 506)
      }
      break
    }
    case 'concrete': {
      for (let i = 0; i < 14; i++) {
        const cx = rnd() * S, cy = rnd() * S, rad = 60 + rnd() * 180
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad)
        const rgb = rnd() < 0.5 ? '0,0,0' : '255,255,255'
        g.addColorStop(0, `rgba(${rgb},.08)`); g.addColorStop(1, `rgba(${rgb},0)`)
        x.fillStyle = g; x.fillRect(0, 0, S, S)
      }
      for (let i = 0; i < 700; i++) {
        const dark = rnd() < 0.5
        x.fillStyle = dark ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'; x.fillRect(rnd() * S, rnd() * S, 1.5, 1.5)
        y.fillStyle = dark ? '#606060' : '#a0a0a0'; y.fillRect(rnd() * S, rnd() * S, 1.5, 1.5)
      }
      break
    }
    default: { // plaster: ضربات المسطرين
      for (let i = 0; i < 70; i++) {
        const px = rnd() * S, py = rnd() * S, l = 40 + rnd() * 90, a = rnd() * 6.28
        x.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; x.lineWidth = 4 + rnd() * 10
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l, py + Math.sin(a) * l, px + Math.cos(a + 1) * l, py + Math.sin(a + 1) * l); x.stroke()
      }
    }
  }
  return { c, b }
}

const cache = new Map<string, Pair>()
function pair(m: WallMaterial, color: string) {
  const k = m.id + '|' + color
  let v = cache.get(k)
  if (!v) {
    v = paintMat(m, color); cache.set(k, v)
    if (cache.size > 30) cache.delete(cache.keys().next().value as string)
  }
  return v
}

const texCache = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>()
const baseTex = (cv: HTMLCanvasElement) => {
  let t = texCache.get(cv)
  if (!t) { t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(cv, t) }
  return t
}

// خصائص خامة لقطعة حيطة: len/h بالمتر، alongOff/upOff = مكان القطعة عشان النقش يكمّل بين القطع
export function wallParams(m: WallMaterial, color: string, len: number, h: number, alongOff: number, upOff: number, aniso: number): THREE.MeshStandardMaterialParameters {
  const d = pair(m, color)
  const mk = (cv: HTMLCanvasElement) => {
    const t = baseTex(cv).clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(len / m.tile, h / m.tile)
    t.offset.set(alongOff / m.tile, upOff / m.tile)
    t.anisotropy = aniso
    return t
  }
  return { color: '#ffffff', map: mk(d.c), bumpMap: mk(d.b), bumpScale: m.bump, roughness: m.rough, envMapIntensity: 0.15 + 0.5 * (1 - m.rough) }
}

// صورة مصغرة لعرض الخامة في القائمة
const thumbs: Record<string, string> = {}
export function wallThumb(m: WallMaterial): string {
  if (!thumbs[m.id]) {
    const t = document.createElement('canvas'); t.width = t.height = 96
    t.getContext('2d')!.drawImage(pair(m, m.base).c, 0, 0, S, S, 0, 0, 96, 96)
    thumbs[m.id] = t.toDataURL()
  }
  return thumbs[m.id]
}