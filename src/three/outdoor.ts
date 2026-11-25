import * as THREE from 'three'
import { OUTDOOR_JPG, getTex } from './assets'

let procedural: THREE.CanvasTexture | null = null

export function outdoorTexture(): THREE.Texture {
  const photo = getTex(OUTDOOR_JPG)
  if (photo) return photo
  if (procedural) return procedural
  const W = 1024, H = 512
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')!
  let s = 12345
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const ground = H * 0.72

  const sky = x.createLinearGradient(0, 0, 0, ground)
  sky.addColorStop(0, '#8DB9E8'); sky.addColorStop(1, '#EAF3FB')
  x.fillStyle = sky; x.fillRect(0, 0, W, H)
  const sun = x.createRadialGradient(780, 110, 5, 780, 110, 150)
  sun.addColorStop(0, 'rgba(255,248,220,1)'); sun.addColorStop(1, 'rgba(255,248,220,0)')
  x.fillStyle = sun; x.fillRect(0, 0, W, H)

  // مباني بعيدة
  const cols = ['#D9CDB8', '#C9BDA8', '#E3D9C6', '#BFB5A5', '#D0C6B4']
  let bx = -20
  while (bx < W) {
    const bw = 90 + rnd() * 110, bh = 150 + rnd() * 170, by = ground - bh
    x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.fillRect(bx, by, bw, bh)
    x.fillStyle = 'rgba(70,90,120,.55)'
    for (let wy = by + 18; wy < by + bh - 20; wy += 34) for (let wx = bx + 12; wx < bx + bw - 16; wx += 28) x.fillRect(wx, wy, 14, 20)
    bx += bw + 4
  }
  // شجر
  for (let i = 0; i < 9; i++) {
    const tx = rnd() * W, r = 28 + rnd() * 26
    x.fillStyle = '#6B4F3A'; x.fillRect(tx - 4, ground - 38, 8, 40)
    x.fillStyle = rnd() < 0.5 ? '#5E8A55' : '#78A168'
    x.beginPath(); x.arc(tx, ground - 50 - r * 0.4, r, 0, 7); x.fill()
  }
  // رصيف وشارع
  x.fillStyle = '#B7B3A8'; x.fillRect(0, ground, W, 16)
  x.fillStyle = '#7C7F84'; x.fillRect(0, ground + 16, W, H - ground - 16)
  x.fillStyle = 'rgba(255,255,255,.7)'
  for (let lx = 0; lx < W; lx += 110) x.fillRect(lx, ground + 70, 60, 6)

  procedural = new THREE.CanvasTexture(c)
  return procedural
}