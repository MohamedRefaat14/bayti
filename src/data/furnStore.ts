import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BASE, FURN, HIDDEN, PREF } from '../furniture'
import type { FurnDef } from '../furniture'
import { session } from '../state'
import { getGlb } from '../three/assets'

// تخزين الفرش: بيانات القطع في localStorage، والموديلات والصور في IndexedDB (داخل المتصفح)
const LS_KEY = 'bayti.furn.v1'
const DB = 'bayti-furniture', STORE = 'files'

export interface Over { name?: string; price?: [number, number, number]; w?: number; d?: number; h?: number }
interface Saved { custom: FurnDef[]; hidden: string[]; over: Record<string, Over>; pref: Record<string, string> }

let saved: Saved = { custom: [], hidden: [], over: {}, pref: {} }
const models = new Map<string, THREE.Object3D>()
const images = new Map<string, HTMLImageElement>()

const idb = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1)
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE)
    rq.onsuccess = () => res(rq.result)
    rq.onerror = () => rej(rq.error)
  })
async function dbPut(id: string, blob: Blob) {
  const db = await idb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}
async function dbDel(id: string) {
  const db = await idb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}
async function dbAll(): Promise<[string, Blob][]> {
  const db = await idb()
  const out = await new Promise<[string, Blob][]>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly')
    const st = tx.objectStore(STORE)
    const keys = st.getAllKeys(), vals = st.getAll()
    tx.oncomplete = () => res((keys.result as string[]).map((k, i) => [k, vals.result[i] as Blob]))
    tx.onerror = () => rej(tx.error)
  })
  db.close()
  return out
}

export function parseModel(buf: ArrayBuffer): Promise<THREE.Object3D> {
  return new Promise((res, rej) => new GLTFLoader().parse(buf, '', (g) => res(g.scene), (e) => rej(e)))
}
function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image'))
    img.src = URL.createObjectURL(blob)
  })
}

const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(saved)) } catch { /* المساحة ممتلئة */ } }

// بيبني القوائم اللي بيشوفها العميل من (الأساسية + التعديلات + المضافة)
export function applyFurniture() {
  for (const k of Object.keys(FURN)) delete FURN[k]
  for (const [k, v] of Object.entries(BASE)) FURN[k] = { ...v, ...saved.over[k] } as FurnDef
  for (const c of saved.custom) FURN[c.kind] = c
  HIDDEN.clear()
  saved.hidden.forEach((h) => HIDDEN.add(h))
  for (const k of Object.keys(PREF)) delete PREF[k]
  Object.assign(PREF, saved.pref)
}

// بيتنده مرة واحدة قبل ما الموقع يظهر
export async function initFurniture() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) saved = { custom: [], hidden: [], over: {}, pref: {}, ...JSON.parse(raw) }
  } catch { /* تجاهل */ }
  try {
    for (const [id, blob] of await dbAll()) {
      const d = saved.custom.find((c) => c.kind === id)
      if (!d) continue
      try {
        if (d.mode === 'rug') images.set(id, await imageFromBlob(blob))
        else models.set(id, await parseModel(await blob.arrayBuffer()))
      } catch { /* ملف تالف */ }
    }
  } catch { /* تجاهل */ }
  applyFurniture()
}

export const storeFurn = () => saved
export const newFurnId = () => 'c' + Date.now().toString(36)

// موديل القطعة: المضافة من لوحة الإدارة، أو ملف public/models/furniture للأساسية
export const furnModel = (d: FurnDef): THREE.Object3D | null => (d.custom ? models.get(d.kind) ?? null : getGlb(d.glb))
export const furnImage = (kind: string) => images.get(kind) ?? null

// المعاينة قبل الحفظ (القطعة 'draft')
export async function setDraftModel(buf: ArrayBuffer) { const o = await parseModel(buf); models.set('draft', o); return o }
export async function setDraftImage(blob: Blob) { images.set('draft', await imageFromBlob(blob)) }
export function clearDraft() { models.delete('draft'); images.delete('draft') }

export async function saveCustom(m: FurnDef, blob?: Blob) {
  if (blob) {
    await dbPut(m.kind, blob)
    if (m.mode === 'rug') images.set(m.kind, await imageFromBlob(blob))
    else models.set(m.kind, await parseModel(await blob.arrayBuffer()))
  }
  const mm: FurnDef = { ...m, custom: true, v: (m.v ?? 0) + 1 }
  saved.custom = saved.custom.some((x) => x.kind === m.kind) ? saved.custom.map((x) => (x.kind === m.kind ? mm : x)) : [...saved.custom, mm]
  persist(); applyFurniture()
}

// بيشيل القطعة المحذوفة (وإكسسواراتها) من أي شقة مفروشة
function purge(kind: string) {
  const f = session.apt.furniture
  for (const k of Object.keys(f)) {
    const id = Number(k)
    const gone = new Set(f[id].filter((i) => i.kind === kind).map((i) => i.id))
    f[id] = f[id].filter((i) => i.kind !== kind && !(i.host !== undefined && gone.has(i.host)))
  }
}

export async function removeCustom(id: string) {
  purge(id)
  try { await dbDel(id) } catch { /* تجاهل */ }
  models.delete(id); images.delete(id)
  saved.custom = saved.custom.filter((x) => x.kind !== id)
  saved.hidden = saved.hidden.filter((x) => x !== id)
  for (const r of Object.keys(saved.pref)) if (saved.pref[r] === id) delete saved.pref[r]
  persist(); applyFurniture()
}

export function setHidden(kind: string, hidden: boolean) {
  saved.hidden = hidden ? Array.from(new Set([...saved.hidden, kind])) : saved.hidden.filter((x) => x !== kind)
  persist(); applyFurniture()
}
export function setOver(kind: string, patch: Over) {
  saved.over[kind] = { ...saved.over[kind], ...patch }
  persist(); applyFurniture()
}
export function setPref(role: string, kind: string | null) {
  if (kind) saved.pref[role] = kind; else delete saved.pref[role]
  persist(); applyFurniture()
}
export async function resetFurn() {
  for (const m of saved.custom) await removeCustom(m.kind)
  saved = { custom: [], hidden: [], over: {}, pref: {} }
  persist(); applyFurniture()
}