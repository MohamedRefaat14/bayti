import * as THREE from 'three'
import { BASE, BASE_DEFAULTS, DEFAULTS, HIDDEN, OPEN } from '../openings'
import type { FrameDef } from '../openings'
import { session } from '../state'
import { parseModel } from './furnStore'

// تخزين الأبواب والشبابيك: البيانات في localStorage، والموديلات في IndexedDB (داخل المتصفح)
const LS_KEY = 'bayti.open.v1'
const DB = 'bayti-openings', STORE = 'files'

interface Over { name?: string; price?: [number, number, number]; color?: string }
interface Saved { custom: FrameDef[]; hidden: string[]; over: Record<string, Over>; defaults: Record<string, string> }

let saved: Saved = { custom: [], hidden: [], over: {}, defaults: {} }
const models = new Map<string, THREE.Object3D>()

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

const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(saved)) } catch { /* المساحة ممتلئة */ } }

export function applyOpenings() {
  for (const k of Object.keys(OPEN)) delete OPEN[k]
  for (const [k, v] of Object.entries(BASE)) OPEN[k] = { ...v, ...saved.over[k] }
  for (const c of saved.custom) OPEN[c.id] = c
  HIDDEN.clear()
  saved.hidden.forEach((h) => HIDDEN.add(h))
  for (const k of Object.keys(DEFAULTS)) delete DEFAULTS[k]
  Object.assign(DEFAULTS, BASE_DEFAULTS, saved.defaults)
}

// بيتنده مرة واحدة قبل ما الموقع يظهر
export async function initOpenings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) saved = { custom: [], hidden: [], over: {}, defaults: {}, ...JSON.parse(raw) }
  } catch { /* تجاهل */ }
  try {
    for (const [id, blob] of await dbAll()) {
      if (!saved.custom.some((c) => c.id === id)) continue
      try { models.set(id, await parseModel(await blob.arrayBuffer())) } catch { /* ملف تالف */ }
    }
  } catch { /* تجاهل */ }
  applyOpenings()
}

export const storeOpen = () => saved
export const newOpenId = () => 'o' + Date.now().toString(36)
export const openModel = (d: FrameDef): THREE.Object3D | null => (d.glb ? models.get(d.id) ?? null : null)

export async function setDraftModel(buf: ArrayBuffer) { const o = await parseModel(buf); models.set('draft', o); return o }
export const clearDraft = () => { models.delete('draft') }

export async function saveCustom(m: FrameDef, blob?: Blob) {
  if (blob) { await dbPut(m.id, blob); models.set(m.id, await parseModel(await blob.arrayBuffer())) }
  const mm: FrameDef = { ...m, custom: true, v: (m.v ?? 0) + 1 }
  saved.custom = saved.custom.some((x) => x.id === m.id) ? saved.custom.map((x) => (x.id === m.id ? mm : x)) : [...saved.custom, mm]
  persist(); applyOpenings()
}

// بيشيل أي اختيار شغال بنوع اتحذف
function purge(id: string) {
  const a = session.apt
  for (const k of Object.keys(a.openFin)) if (a.openFin[Number(k)].style === id) delete a.openFin[Number(k)].style
  for (const k of Object.keys(a.odef)) if (a.odef[k] === id) delete a.odef[k]
}

export async function removeCustom(id: string) {
  purge(id)
  try { await dbDel(id) } catch { /* تجاهل */ }
  models.delete(id)
  saved.custom = saved.custom.filter((x) => x.id !== id)
  saved.hidden = saved.hidden.filter((x) => x !== id)
  for (const r of Object.keys(saved.defaults)) if (saved.defaults[r] === id) delete saved.defaults[r]
  persist(); applyOpenings()
}

export function setHidden(id: string, hidden: boolean) {
  saved.hidden = hidden ? Array.from(new Set([...saved.hidden, id])) : saved.hidden.filter((x) => x !== id)
  persist(); applyOpenings()
}
export function setOver(id: string, patch: Over) {
  saved.over[id] = { ...saved.over[id], ...patch }
  persist(); applyOpenings()
}
export function setDefault(role: string, id: string | null) {
  if (id) saved.defaults[role] = id; else delete saved.defaults[role]
  persist(); applyOpenings()
}
export async function resetOpen() {
  for (const m of [...saved.custom]) await removeCustom(m.id)
  saved = { custom: [], hidden: [], over: {}, defaults: {} }
  persist(); applyOpenings()
}