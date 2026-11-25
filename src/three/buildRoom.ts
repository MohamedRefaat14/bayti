import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { RoomType, RoomView, Side } from '../apartment'
import { CLOSED, LAMP_HEX, SUN } from '../data/lighting'
import type { Lighting, Lit } from '../data/lighting'
import { WALL_PBR, floorRef } from '../data/pbrMap'
import { wmById } from '../data/wallCatalog'
import { DOOR_GLB, getGlb } from './assets'
import { buildCeiling } from './ceiling'
import { floorTextures } from './floorTexture'
import { outdoorTexture } from './outdoor'
import { addBlob, addContactShadows, addEdgeShading, paintParams } from './paint'
import { hasPbr, pbrParams } from './pbr'
import { HDR_YAW, SKY_ROT } from './sky'
import { wallParams } from './wallTexture'
import { FURN } from '../furniture'
import { buildItem } from './furniture3d'
import { fxSetScene } from './furnDrag'
import { furnModel } from '../data/furnStore'
import { doorRole, pickStyle } from '../openings'
import { drawDoor, drawWindow } from './openings3d'

const T = 0.12 // سمك الحيطة
const RY: Record<Side, number> = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }

// علامة الانتقال: دايرة زجاجية شفافة بسهم رفيع واسم الغرفة
function hotspotTexture(name: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320
  const x = c.getContext('2d')!
  const glow = x.createRadialGradient(128, 110, 30, 128, 110, 120)
  glow.addColorStop(0, 'rgba(255,255,255,.35)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = glow; x.beginPath(); x.arc(128, 110, 120, 0, 7); x.fill()
  const disc = x.createRadialGradient(128, 90, 10, 128, 110, 66)
  disc.addColorStop(0, 'rgba(255,255,255,.42)'); disc.addColorStop(1, 'rgba(255,255,255,.14)')
  x.fillStyle = disc; x.beginPath(); x.arc(128, 110, 64, 0, 7); x.fill()
  x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 5; x.stroke()
  x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round'
  x.beginPath(); x.moveTo(104, 126); x.lineTo(128, 96); x.lineTo(152, 126); x.stroke()
  x.font = 'bold 28px Tajawal, sans-serif'; x.textAlign = 'center'
  const w = Math.min(236, x.measureText(name).width + 36)
  x.fillStyle = 'rgba(15,20,30,.55)'; x.beginPath(); x.roundRect(128 - w / 2, 206, w, 46, 23); x.fill()
  x.fillStyle = '#fff'; x.fillText(name, 128, 238)
  return new THREE.CanvasTexture(c)
}

// خامة الشيش: ألواح أفقية بخط ضلّ بينها
let shutterTex: THREE.CanvasTexture | null = null
function shutterTexture() {
  if (shutterTex) return shutterTex
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 64
  const x = cv.getContext('2d')!
  x.fillStyle = '#B4B8BF'; x.fillRect(0, 0, 8, 64)
  x.fillStyle = '#6C7078'; x.fillRect(0, 0, 8, 6)
  x.fillStyle = '#D0D3D8'; x.fillRect(0, 6, 8, 5)
  shutterTex = new THREE.CanvasTexture(cv)
  shutterTex.wrapS = shutterTex.wrapT = THREE.RepeatWrapping
  return shutterTex
}

type Params = THREE.MeshStandardMaterialParameters
type Kind = 'main' | 'dado' | 'accent'
interface Op { c: number; w: number; top: number; sill?: number; glass?: boolean; pass?: boolean; to?: number | null; isDoor?: boolean; oid?: number; tt?: RoomType }
interface Cx { aniso: number; open: boolean; tod: (typeof SUN)['day']; lit: Lit; sky: THREE.Texture | null }
interface Anchor { R: RoomView; side: Side; c: number; ox: number; oz: number }
interface Out { hotspots: THREE.Sprite[]; windows: Anchor[]; placed: { R: RoomView; ox: number; oz: number }[]; items: Map<number, THREE.Object3D> }

// موضع على حيطة غرفة: c = المسافة على طول الحيطة من المنتصف، inset = البعد عن الحيطة للداخل
const pos = (R: { w: number; d: number }, side: Side, c: number, inset: number): [number, number] =>
  side === 'N' ? [c, -R.d / 2 + inset] : side === 'S' ? [c, R.d / 2 - inset] : side === 'W' ? [-R.w / 2 + inset, c] : [R.w / 2 - inset, c]

const SOFT_WHITE = '#EFECE6' // أبيض الإطارات والوزرات (مش أبيض صريح)

// بيبني غرفة كاملة جوه مجموعة بتتحرك لمكانها الحقيقي (ox, oz) بالنسبة للغرفة اللي واقف فيها
function addRoom(parent: THREE.Object3D, R: RoomView, ox: number, oz: number, primary: boolean, cx: Cx, out: Out) {
  const { aniso, open, tod, lit, sky } = cx
  const W = R.w, L = R.d, H = R.h, WC = R.wall
  const g = new THREE.Group()
  g.position.set(ox, 0, oz)
  parent.add(g)
  out.placed.push({ R, ox, oz })

  const mat = (c: string | number, o: Params = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, envMapIntensity: 0.15, ...o })
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: string | number, o?: Params) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(c, o))
    mesh.position.set(x, y, z); mesh.castShadow = !o?.transparent; mesh.receiveShadow = true
    g.add(mesh); return mesh
  }
  // صندوق بحواف مشطوفة خفيفة (للإطارات والبارات): الحافة بتلقط لمعة الضوء
  const rbox = (sx: number, sy: number, sz: number, x: number, y: number, z: number, c: string | number, o?: Params, r = 0.012) => {
    const rr = Math.max(0.002, Math.min(r, sx / 2 - 0.001, sy / 2 - 0.001, sz / 2 - 0.001))
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 2, rr), mat(c, o))
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    g.add(mesh); return mesh
  }
  const glass: Params = { transparent: true, opacity: 0.28, roughness: 0.05, envMapIntensity: 0.9 }
  const P = (side: Side, c: number, inset: number) => pos(R, side, c, inset)
  const alongX = (s: Side) => s === 'N' || s === 'S'
  // صندوق على حيطة: a = موضع على طول الحيطة، la = الطول عليها، dp = السُمك، y = مركز الارتفاع
  const wbox = (side: Side, a: number, inset: number, la: number, hh: number, dp: number, y: number, c: string, o?: Params) => {
    const [x, z] = P(side, a, inset)
    return alongX(side) ? box(la, hh, dp, x, y, z, c, o) : box(dp, hh, la, x, y, z, c, o)
  }
  const wrbox = (side: Side, a: number, inset: number, la: number, hh: number, dp: number, y: number, c: string, o?: Params, r = 0.01) => {
    const [x, z] = P(side, a, inset)
    return alongX(side) ? rbox(la, hh, dp, x, y, z, c, o, r) : rbox(dp, hh, la, x, y, z, c, o, r)
  }

  // لمبة السقف (الغرف المجاورة بلمبة أضعف عشان الأداء)
  if (lit.on) {
    const lamp = new THREE.PointLight(lit.hex, (primary ? 0.55 : 0.4) * lit.level, primary ? 14 : 12)
    lamp.position.set(0, H - 0.4, 0); g.add(lamp)
  }

  // الأرضية: خامة حقيقية لو موجودة، وإلا المرسومة بالكود
  const fref = floorRef(R.floor.material, R.floor.color)
  const fpb = hasPbr(fref) ? pbrParams(fref, R.floor.color, W, L, 0, 0, aniso) : null
  if (fpb) box(W, 0.1, L, 0, -0.05, 0, '#ffffff', fpb)
  else {
    const ft = floorTextures(R.floor, W, L, aniso)
    box(W, 0.1, L, 0, -0.05, 0, '#ffffff', { map: ft.map, bumpMap: ft.bump, bumpScale: 1.2, roughness: ft.rough, envMapIntensity: 0.1 + 0.8 * (1 - ft.rough) })
  }
  buildCeiling(g, R, aniso, lit, primary)

  // ===== أنماط الحيطان: دهان / دادو / حيطة ديكور =====
  const wallMat = (id: string, color: string, len: number, off: number, y0: number, y1: number): Params => {
    const ref = WALL_PBR[id]
    return (hasPbr(ref) && pbrParams(ref, color, len, y1 - y0, off, y0, aniso)) || wallParams(wmById(id), color, len, y1 - y0, off, y0, aniso)
  }
  const styleOf = (kind: Kind, len: number, off: number, y0: number, y1: number): Params => {
    if (kind === 'accent') return wallMat(WC.accent.material, WC.accent.color, len, off, y0, y1)
    if (kind === 'dado') return WC.dado.material ? wallMat(WC.dado.material, WC.dado.color, len, off, y0, y1) : paintParams(WC.dado.color, 'satin', len, y1 - y0, off, y0, aniso)
    return paintParams(WC.color, WC.finish, len, y1 - y0, off, y0, aniso)
  }

  const wall = (side: Side, axis: 'x' | 'z', fixed: number, a0: number, a1: number, ops: Op[], o: { hh?: number; th?: number; plain?: string } = {}) => {
    const hh = o.hh ?? H, th = o.th ?? T
    const acc = !o.plain && WC.accent.side === side
    const dado = !o.plain && !acc && WC.dado.on ? Math.min(WC.dado.height, hh) : 0
    const emit = (s0: number, s1: number, y0: number, y1: number, kind: Kind) => {
      const len = s1 - s0, mid = (s0 + s1) / 2, h2 = y1 - y0
      const par: Params = o.plain ? paintParams(o.plain, 'satin', len, h2, s0 - a0, y0, aniso) : styleOf(kind, len, s0 - a0, y0, y1)
      if (axis === 'x') box(len, h2, th, mid, y0 + h2 / 2, fixed, '#ffffff', par); else box(th, h2, len, fixed, y0 + h2 / 2, mid, '#ffffff', par)
    }
    const seg = (s0: number, s1: number, y0: number, y1: number, isGlass = false) => {
      y1 = Math.min(y1, hh); if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return
      if (isGlass) {
        const len = s1 - s0, mid = (s0 + s1) / 2, h2 = y1 - y0
        if (axis === 'x') box(len, h2, th, mid, y0 + h2 / 2, fixed, '#BFE3FF', glass); else box(th, h2, len, fixed, y0 + h2 / 2, mid, '#BFE3FF', glass)
        return
      }
      if (acc || !dado) { emit(s0, s1, y0, y1, acc ? 'accent' : 'main'); return }
      if (y0 < dado && y1 > dado) { emit(s0, s1, y0, dado, 'dado'); emit(s0, s1, dado, y1, 'main') }
      else emit(s0, s1, y0, y1, y1 <= dado ? 'dado' : 'main')
    }
    let p = a0
    ;[...ops].sort((a, b) => a.c - b.c).forEach((q) => {
      const o0 = q.c - q.w / 2, o1 = q.c + q.w / 2, sill = q.sill ?? 0
      seg(p, o0, 0, hh); if (sill) seg(o0, o1, 0, sill); seg(o0, o1, q.top, hh); if (q.glass) seg(o0, o1, sill, q.top, true); p = o1
    })
    seg(p, a1, 0, hh)
  }
  // إطار الشباك: قطع مشطوفة بلون أبيض ناعم
  const piece = (side: Side, along: number, len: number, cy: number, hh: number) => wrbox(side, along, T / 2, len, hh, 0.08, cy, SOFT_WHITE, undefined, 0.01)

  // كرسي بار عالي مع ظل تلامس تحته
  const stool = (side: Side, a: number, inset: number) => {
    const [x, z] = P(side, a, inset)
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 18), mat('#CDBFA6', { roughness: 0.6 }))
    seat.position.set(x, 0.66, z); seat.castShadow = true; g.add(seat)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.63, 8), mat('#3B3B3F', { metalness: 0.6, roughness: 0.4 }))
    leg.position.set(x, 0.315, z); g.add(leg)
    addBlob(g, x, z, 0.3, 0.3, 0.5)
  }

    // الباب والشباك: النوع واللون من اختيار العميل أو الافتراضي (مجسم مرسوم أو موديل glb)
  const place = (side: Side, c: number, y: number) => {
    const [x, z] = P(side, c, T / 2)
    const dg = new THREE.Group(); dg.position.set(x, y, z); dg.rotation.y = RY[side]; g.add(dg)
    return dg
  }
  const placeDoor = (side: Side, q: Op) => {
    const role = doorRole(R.type, q.to ?? null, q.tt)
    const fs = pickStyle('door', role, R.ofin, R.odef, q.oid ?? -1)
    drawDoor(place(side, q.c, 0), fs.def, fs.color, q.w, T)
  }
  const placeWindow = (side: Side, q: Op, sill: number, hh: number) => {
    const fs = pickStyle('window', 'interior', R.ofin, R.odef, q.oid ?? -1)
    drawWindow(place(side, q.c, sill), fs.def, fs.color, q.w, hh, T)
  }

  const openSides = new Set<Side>() // الحيطان المفتوحة بالكامل (من غير عتب) عشان نلغي تظليل الأركان عليها

  ;(['N', 'S', 'W', 'E'] as Side[]).forEach((side) => {
    const ops: Op[] = R.openings
      .filter((o) => o.side === side)
      .map((o): Op => {
        if (o.kind === 'door') return { c: o.c, w: o.width, top: 2.1, isDoor: true, to: o.to, oid: o.id, tt: o.tt }
        if (o.kind === 'pass') {
          const full = o.sill < 0.01 && o.width >= 2.4 // فتحة واسعة: من غير عتب
          if (full) openSides.add(side)
          return { c: o.c, w: o.width, sill: o.sill, top: full ? H : 2.1, pass: true, to: o.to }
        }
        return { c: o.c, w: o.width, sill: o.sill, top: 2.1, glass: true, oid: o.id }
      })
    const axis = alongX(side) ? 'x' : 'z'
    const fixed = side === 'N' ? -L / 2 + T / 2 : side === 'S' ? L / 2 - T / 2 : side === 'W' ? -W / 2 + T / 2 : W / 2 - T / 2
    const span: [number, number] = axis === 'x' ? [-W / 2, W / 2] : [-L / 2 + T, L / 2 - T]
    wall(side, axis, fixed, span[0], span[1], ops)
    // وزرة بارتفاعها ولونها
    wall(side, axis, fixed + (side === 'N' || side === 'W' ? 0.01 : -0.01), span[0], span[1], ops.filter((q) => q.isDoor || q.pass),
      { hh: WC.skirt.height, th: T + 0.02, plain: WC.skirt.color })

    ops.forEach((q) => {
      if (q.isDoor) {
        placeDoor(side, q)
        const target = q.to == null ? null : roomById(q.to)
        if (primary && target) hot(side, q.c, target.id, target.name)
      } else if (q.pass) {
        const sillH = q.sill ?? 0
        // بطانة مشطوفة بلون الحيطة على جانبي الفتحة: بتكسر حدة القطع
        const trim = paintParams(WC.color, 'satin', 0.07, q.top, 0, 0, aniso)
        ;[-1, 1].forEach((s) => wrbox(side, q.c + s * (q.w / 2 + 0.035), T / 2, 0.07, q.top, T + 0.04, q.top / 2, '#ffffff', trim, 0.012))
        if (sillH > 0.01) {
          // بار رخام: سطح أعرض ناحية الريسبشن + كراسي عالية
          const kit = R.type === 'kitchen'
          wrbox(side, q.c, kit ? 0.1 : 0.225, q.w + 0.04, 0.05, kit ? 0.2 : 0.45, sillH, '#ECE9E2', { roughness: 0.2 }, 0.02)
          if (!kit) {
            const n = Math.max(2, Math.min(4, Math.floor(q.w / 0.7)))
            for (let i = 0; i < n; i++) stool(side, q.c + (i - (n - 1) / 2) * 0.7, 0.85)
          }
        } else {
          if (R.type === 'kitchen' && q.w >= 2.4) {
            // مطبخ أمريكان: جزيرة رخام قدام الفتحة وكراسي من ناحية الريسبشن
            const li = Math.min(3.2, q.w - 0.5)
            wrbox(side, q.c, 0.6, li, 0.86, 0.8, 0.43, '#A88460', undefined, 0.015)
            wrbox(side, q.c, 0.35, li + 0.1, 0.04, 1.3, 0.88, '#F3F1EC', { roughness: 0.18 }, 0.015)
            const [bx, bz] = P(side, q.c, 0.55)
            addBlob(g, bx, bz, alongX(side) ? li / 2 + 0.3 : 0.75, alongX(side) ? 0.75 : li / 2 + 0.3, 0.55)
            const n = Math.max(2, Math.min(4, Math.floor(li / 0.7)))
            for (let i = 0; i < n; i++) stool(side, q.c + (i - (n - 1) / 2) * 0.7, -0.55)
          }
          const target = q.to == null ? null : roomById(q.to)
          if (primary && target) hot(side, q.c, target.id, target.name)
        }
      } else if (q.glass) {
        const sill = q.sill ?? 0.9, hh = q.top - sill, mid = sill + hh / 2
        placeWindow(side, q, sill, hh)
        out.windows.push({ R, side, c: q.c, ox, oz })
        if (open) {
          if (!sky) { // مفيش بانوراما: نرجع للمنظر القديم
            const [px, pz] = P(side, q.c, -3)
            const view = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: outdoorTexture(), color: tod.outdoor, toneMapped: false }))
            view.position.set(px, 2.4, pz); view.rotation.y = RY[side]; g.add(view)
          }
          if (primary) {
            const wl = new THREE.PointLight(0xdfeeff, 0.3 * (tod.env + 0.2), 9); const [lx, lz] = P(side, q.c, 0.5)
            wl.position.set(lx, 1.5, lz); g.add(wl)
          }
        } else {
          // شيش مقفول: خطوط أفقية، ومفيش ضوء ولا منظر
          const st = shutterTexture().clone(); st.needsUpdate = true; st.repeat.set(1, hh / 0.06)
          wbox(side, q.c, T + 0.015, q.w, hh, 0.03, mid, '#ffffff', { map: st, roughness: 0.7 })
        }
      }
    })
  })

  // علامة انتقال زجاجية فوق الباب أو الفتحة (للغرفة اللي واقف فيها بس)
  function hot(side: Side, c: number, id: number, name: string) {
    const [hx, hz] = P(side, c, 0.6)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hotspotTexture(name), depthTest: false, transparent: true, toneMapped: false }))
    sp.position.set(hx, 1.3, hz); sp.scale.set(0.34, 0.425, 1); sp.userData = { to: id }
    g.add(sp); out.hotspots.push(sp)
  }

    // ===== الأعمدة: بتبرز من الحيطة، ودهانها زي الحيطة، والوزرة بتلف حواليها كحزام متناسق =====
  R.columns.forEach((c) => {
    const cc = c.offset - (alongX(c.side) ? W : L) / 2
    const par = paintParams(WC.color, WC.finish, c.w, H, 0, 0, aniso)
    wrbox(c.side, cc, T + c.d / 2, c.w, H, c.d, H / 2, '#ffffff', par, 0.012)
    // حزام وزرة مشطوف الحواف يلتف حول العمود بالكامل بدون بروز شاذ في الزوايا
    const sh = WC.skirt.height
    wrbox(c.side, cc, T + (c.d + 0.016) / 2, c.w + 0.032, sh, c.d + 0.016, sh / 2, WC.skirt.color, undefined, 0.014)
  })

  // ===== الفرش: للغرفة اللي واقف فيها (قابل للتحريك) وللغرف المجاورة (للعرض بس) =====
  if (R.fon) {
    R.furniture.forEach((it) => {
      const fd = FURN[it.kind]
      const obj = buildItem(it, fd, { fabric: R.fabric, wood: R.wood, aniso }, furnModel(fd))
      g.add(obj)
      if (primary) out.items.set(it.id, obj)
    })
  }

  addEdgeShading(g, W, L, H, T, [...openSides])
  addContactShadows(g, W, L, T, [...openSides])
}

let allRooms: RoomView[] = []
const roomById = (id: number) => allRooms.find((r) => r.id === id) ?? null

export function buildRoom(R: RoomView, all: RoomView[], env: THREE.Texture | null, aniso: number, LT: Lighting, sky: THREE.Texture | null) {
  allRooms = all
  const tod = SUN[LT.time], open = LT.window === 'open'
  const lit: Lit = { on: LT.lamps !== 'off', hex: LAMP_HEX[LT.lamps], level: LT.level }
  const cx: Cx = { aniso, open, tod, lit, sky }
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(open ? tod.bg : CLOSED.bg)
  scene.environment = env
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2efe9, open ? tod.hemi * 1.15 : CLOSED.hemi * 1.15))
  const out: Out = { hotspots: [], windows: [], placed: [], items: new Map() }

  addRoom(scene, R, 0, 0, true, cx, out)

  // الغرف المفتوحة على الغرفة دي (ريسبشن وسفرة وركن جلوس ومطبخ): بتتبني جنبها في نفس المشهد عشان تظهر من الفتحة
  const c0x = R.x + R.w / 2, c0z = R.y + R.d / 2
  const done = new Set<number>([R.id])
  const queue: { r: RoomView; depth: number }[] = [{ r: R, depth: 0 }]
  while (queue.length && done.size < 12) {
    const cur = queue.shift() as { r: RoomView; depth: number }
    if (cur.depth >= 3) continue
    for (const o of cur.r.openings) {
      if (o.kind !== 'pass' || o.to == null || done.has(o.to) || done.size >= 12) continue
      const n = all.find((x) => x.id === o.to)
      if (!n) continue
      done.add(n.id)
      addRoom(scene, n, n.x + n.w / 2 - c0x, n.y + n.d / 2 - c0z, false, cx, out)
      queue.push({ r: n, depth: cur.depth + 1 })
    }
  }

  // شمس (أو قمر) جاية من برّه أول شباك: بتعمل مربع الظل الحقيقي على الأرضية وبتغطي كل الغرف المبنية
  const wa = out.windows[0]
  if (wa && open) {
    const half = (wa.side === 'N' || wa.side === 'S' ? wa.R.d : wa.R.w) / 2
    const [sx, sz] = pos(wa.R, wa.side, wa.c + 1.5, -8)
    const sun = new THREE.DirectionalLight(tod.color, tod.intensity)
    sun.position.set(sx + wa.ox, (tod.hit * (half + 8)) / half, sz + wa.oz); sun.target.position.set(0, 0, 0)
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048)
    const e = Math.max(...out.placed.map((p) => Math.max(Math.abs(p.ox) + p.R.w / 2, Math.abs(p.oz) + p.R.d / 2))) + 2
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 0.5, far: 80 })
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03
    scene.add(sun, sun.target)
  }

  // بانوراما حقيقية برّه الشبابيك: كرة كبيرة بتظهر من خلال الزجاج بس
  if (open && sky && wa) {
    const sph = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24).scale(-1, 1, 1), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }))
    sph.rotation.y = SKY_ROT[wa.side] + HDR_YAW
    sph.position.y = 1.6
    scene.add(sph)
  }

  // انعكاسات البيئة بتتخفف حسب الوقت وقفل الشباك
  const envK = open ? tod.env : CLOSED.env
  scene.traverse((o) => {
    const mt = (o as THREE.Mesh).material as THREE.Material | undefined
    if (mt && (mt as THREE.MeshStandardMaterial).isMeshStandardMaterial) (mt as THREE.MeshStandardMaterial).envMapIntensity *= envK
  })

  fxSetScene(R, all, out.items)

  return { scene, hotspots: out.hotspots }
}