import { resolveOpenings, sideLen } from './apartment'
import type { Apartment, Column, Side } from './apartment'
import { fitFurniture } from './furniture'

// بيتحقق من العمود: المقاسات، وإنه جوه الحيطة، ومش فوق باب أو شباك أو عمود تاني
export function columnError(a: Apartment, c: Column): string | null {
  const r = a.rooms.find((x) => x.id === c.roomId)
  if (!r) return 'الغرفة مش موجودة'
  if (c.w < 0.15 || c.w > 1) return 'عرض العمود لازم يكون بين 15 و100 سم'
  if (c.d < 0.05 || c.d > 0.6) return 'بروز العمود لازم يكون بين 5 و60 سم'
  const len = sideLen(r, c.side)
  if (c.offset - c.w / 2 < 0.02 || c.offset + c.w / 2 > len - 0.02) return `العمود خارج الحيطة. طولها ${len.toFixed(2)} م`
  const cc = c.offset - len / 2
  const ops = resolveOpenings(r, a.rooms, a.openings).filter((o) => o.side === c.side)
  if (ops.some((o) => Math.abs(cc - o.c) < (c.w + o.width) / 2 + 0.03)) return 'العمود بيتداخل مع باب أو شباك على نفس الحيطة'
  if (a.columns.some((o) => o.id !== c.id && o.roomId === c.roomId && o.side === c.side && Math.abs(o.offset - c.offset) < (o.w + c.w) / 2 + 0.02)) {
    return 'فيه عمود تاني في المكان ده'
  }
  return null
}

// بيضيف عمود 30 × 20 سم في أول ركن فاضي
export function addColumn(a: Apartment, roomId: number): string | null {
  const r = a.rooms.find((x) => x.id === roomId)
  if (!r) return 'اختار غرفة الأول'
  for (const side of ['W', 'E', 'N', 'S'] as Side[]) {
    const len = sideLen(r, side)
    for (const offset of [0.17, len - 0.17]) {
      const col: Column = { id: a.nextId, roomId, side, offset, w: 0.3, d: 0.2 }
      if (!columnError(a, col)) { a.nextId++; a.columns.push(col); fitFurniture(a); return null }
    }
  }
  return 'مفيش ركن فاضي مناسب للعمود في الغرفة دي'
}

export function updateColumn(a: Apartment, id: number, patch: Partial<Pick<Column, 'side' | 'offset' | 'w' | 'd'>>): string | null {
  const c = a.columns.find((x) => x.id === id)
  const r = c && a.rooms.find((x) => x.id === c.roomId)
  if (!c || !r) return null
  const next: Column = { ...c, ...patch }
  if (patch.side && patch.offset === undefined) next.offset = next.w / 2 + 0.02
  const e = columnError(a, next)
  if (e) return e
  Object.assign(c, next)
  fitFurniture(a)
  return null
}

export function removeColumn(a: Apartment, id: number) {
  a.columns = a.columns.filter((x) => x.id !== id)
}