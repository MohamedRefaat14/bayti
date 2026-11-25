import { ALL_FLOORS, BUILTIN_FLOORS, FLOOR_MATERIALS } from './catalog'
import type { FloorMaterial } from './catalog'

// تخزين الخامات: بيانات الخامات في localStorage، والصور في IndexedDB (داخل المتصفح)
const LS_KEY = 'bayti.floors.v1'
const DB = 'bayti-materials', STORE = 'photos'

interface Override { name?: string; group?: string; price?: [number, number, number] }
interface Saved { custom: FloorMaterial[]; hidden: string[]; over: Record<string, Override> }

let saved: Saved = { custom: [], hidden: [], over: {} }
const photos = new Map<string, HTMLImageElement>()

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

function toImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image'))
    img.src = URL.createObjectURL(blob)
  })
}

const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(saved)) } catch { /* المساحة ممتلئة */ } }

// بيبني القوائم اللي بيشوفها العميل من (الأساسية + المضافة) بعد الإخفاء والتعديلات
export function applyMaterials() {
  const all = [...BUILTIN_FLOORS.map((m) => ({ ...m, ...saved.over[m.id] })), ...saved.custom]
  ALL_FLOORS.length = 0
  ALL_FLOORS.push(...all)
  FLOOR_MATERIALS.length = 0
  FLOOR_MATERIALS.push(...all.filter((m) => !saved.hidden.includes(m.id)))
}

// بيتنده مرة واحدة قبل ما الموقع يظهر
export async function initMaterials() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) saved = { custom: [], hidden: [], over: {}, ...JSON.parse(raw) }
  } catch { /* تجاهل */ }
  try {
    for (const [id, blob] of await dbAll()) {
      try { photos.set(id, await toImage(blob)) } catch { /* صورة تالفة */ }
    }
  } catch { /* تجاهل */ }
  applyMaterials()
}

export const getPhoto = (id: string) => photos.get(id) ?? null
export const storeState = () => saved
export const newId = () => 'c' + Date.now().toString(36)

export async function registerPhoto(id: string, blob: Blob) { photos.set(id, await toImage(blob)) }

// بيصغّر الصورة (لحد 1024 بكسل) ويحوّلها JPEG عشان تخف
export async function fileToBlob(file: File, maxSide = 1024): Promise<Blob> {
  const img = await toImage(file)
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k)
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.9))
}

export function setHidden(id: string, hidden: boolean) {
  saved.hidden = hidden ? Array.from(new Set([...saved.hidden, id])) : saved.hidden.filter((x) => x !== id)
  persist(); applyMaterials()
}
export function setOverride(id: string, patch: Override) {
  saved.over[id] = { ...saved.over[id], ...patch }
  persist(); applyMaterials()
}

export async function saveCustom(m: FloorMaterial, blob?: Blob) {
  if (blob) { await dbPut(m.id, blob); photos.set(m.id, await toImage(blob)) }
  const mm: FloorMaterial = { ...m, custom: true, v: (m.v ?? 0) + 1 }
  saved.custom = saved.custom.some((x) => x.id === m.id) ? saved.custom.map((x) => (x.id === m.id ? mm : x)) : [...saved.custom, mm]
  persist(); applyMaterials()
}

export async function removeCustom(id: string) {
  try { await dbDel(id) } catch { /* تجاهل */ }
  photos.delete(id)
  saved.custom = saved.custom.filter((x) => x.id !== id)
  saved.hidden = saved.hidden.filter((x) => x !== id)
  persist(); applyMaterials()
}

export async function resetAll() {
  for (const m of saved.custom) { try { await dbDel(m.id) } catch { /* تجاهل */ } photos.delete(m.id) }
  saved = { custom: [], hidden: [], over: {} }
  persist(); applyMaterials()
}