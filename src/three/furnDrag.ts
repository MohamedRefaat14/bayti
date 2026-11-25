import * as THREE from 'three'
import { session } from '../state'
import { moveItem } from '../furniture'
import type { RoomView } from '../apartment'

// حالة تحريك الفرش (بيتحكم فيها زرار "تحريك الفرش بالسحب" في اللوحة)
export const fx = {
  enabled: false,
  selected: null as number | null,
  draw: () => {},      // إعادة رسم المشهد
  commit: () => {},    // بعد التحريك: إعادة بناء المشهد وتحديث التكلفة
  onSelect: () => {},  // تغيير الاختيار: تحديث اللوحة بس
}

let room: RoomView | null = null
let all: RoomView[] = []
let objs = new Map<number, THREE.Object3D>()
let drag: { id: number; dx: number; dz: number; bad: boolean; moved: boolean } | null = null
const ray = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

const list = () => (room ? session.apt.furniture[room.id] ?? [] : [])

function tint(o: THREE.Object3D, hex: number, k: number) {
  o.traverse((n) => {
    const m = (n as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m && m.isMeshStandardMaterial) { m.emissive.setHex(hex); m.emissiveIntensity = k }
  })
}
function paintAll() {
  objs.forEach((o, id) => {
    if (drag && drag.id === id && drag.bad) tint(o, 0xd83a3a, 0.5)
    else if (id === fx.selected) tint(o, 0x3a6fd8, 0.25)
    else tint(o, 0x000000, 0)
  })
}

// بيتنده عليها buildRoom بعد كل بناء للمشهد
export function fxSetScene(R: RoomView, A: RoomView[], m: Map<number, THREE.Object3D>) {
  room = R; all = A; objs = m
  paintAll()
}

function aim(e: PointerEvent, cv: HTMLCanvasElement, cam: THREE.PerspectiveCamera) {
  const b = cv.getBoundingClientRect()
  ray.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), cam)
}
function floorPoint(y: number) {
  plane.constant = -y
  return ray.ray.intersectPlane(plane, new THREE.Vector3())
}

export function fxBegin(e: PointerEvent, cv: HTMLCanvasElement, cam: THREE.PerspectiveCamera): boolean {
  if (!fx.enabled || !room) return false
  aim(e, cv, cam)
  const h = ray.intersectObjects([...objs.values()], true)[0]
  if (!h) {
    if (fx.selected !== null) { fx.selected = null; paintAll(); fx.draw(); fx.onSelect() }
    return false
  }
  let o: THREE.Object3D | null = h.object
  while (o && o.userData.furnId === undefined) o = o.parent
  if (!o) return false
  const id = o.userData.furnId as number
  const it = list().find((i) => i.id === id)
  if (!it) return false
  const p = floorPoint(it.y)
  fx.selected = id
  drag = { id, dx: p ? p.x - it.x : 0, dz: p ? p.z - it.z : 0, bad: false, moved: false }
  paintAll(); fx.draw(); fx.onSelect()
  return true
}

export function fxMove(e: PointerEvent, cv: HTMLCanvasElement, cam: THREE.PerspectiveCamera): boolean {
  if (!drag || !room) return false
  const items = list(), it = items.find((i) => i.id === drag!.id)
  if (!it) return true
  aim(e, cv, cam)
  const p = floorPoint(it.y)
  if (!p) return true
  const res = moveItem(room, all, items, it, p.x - drag.dx, p.z - drag.dz)
  drag.bad = !res.ok
  if (res.ok) drag.moved = true
  const place = (i: typeof it) => {
    const ob = objs.get(i.id)
    if (ob) { ob.position.set(i.x, i.y, i.z); ob.rotation.y = i.rot }
  }
  place(it)
  items.forEach((ch) => { if (ch.host === it.id) place(ch) })
  paintAll(); fx.draw()
  return true
}

export function fxEnd(): boolean {
  if (!drag) return false
  const had = drag
  drag = null
  paintAll(); fx.draw()
  if (had.moved) fx.commit(); else fx.onSelect()
  return true
}