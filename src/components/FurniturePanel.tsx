import { useState } from 'react'
import { session } from '../state'
import { getRooms } from '../rooms'
import { FABRIC_SW, FURN, HIDDEN, WOOD_SW, autoFurnishAll, blocked, furnishRoom, obstacles, placeNew, removeItem, rotateItem } from '../furniture'
import { fx } from '../three/furnDrag'
import type { RoomView } from '../apartment'

export default function FurniturePanel({ room, onChange }: { room: RoomView; onChange: () => void }) {
  const a = session.apt
  const [msg, setMsg] = useState('')
  const [kind, setKind] = useState('')
  const [drag, setDrag] = useState(fx.enabled)
  const all = getRooms()
  const R = all.find((r) => r.id === room.id) ?? room
  const items = a.furniture[room.id] ?? []
  const kinds = Object.keys(FURN).filter((k) => FURN[k].rooms.includes(room.type) && !HIDDEN.has(k))
  const sel = items.find((i) => i.id === fx.selected) ?? null
  const sd = sel ? FURN[sel.kind] : null
  const swatches = sd && sd.colorRole && sd.colorRole !== 'none' ? sd.colors ?? (sd.colorRole === 'fabric' ? FABRIC_SW : WOOD_SW) : []
  // قطع تانية من نفس النوع تقدر تبدّل بيها القطعة المختارة
  const alts = sd && sel ? Object.values(FURN).filter((x) => (x.role ?? x.kind) === (sd.role ?? sd.kind) && x.kind !== sel.kind && !HIDDEN.has(x.kind)) : []
  const act = (fn: () => string | null | void) => {
    const e = fn()
    setMsg(typeof e === 'string' ? e : '')
    onChange()
  }
  const swap = (to: string) => act(() => {
    if (!sel) return null
    const nd = FURN[to], probe = { ...sel, kind: to }
    if (blocked(R, nd, probe, obstacles(R, all, items, sel.id))) return 'القطعة دي مش هتتسع في مكانها'
    sel.kind = to; sel.color = undefined
    return null
  })

  return (
    <div className="furn-panel">
      <h4>الفرش والأعمدة</h4>
      <div className="seg2">
        <button className={a.furnOn ? 'on' : ''} onClick={() => act(() => { a.furnOn = true })}>مفروشة</button>
        <button className={!a.furnOn ? 'on' : ''} onClick={() => act(() => { a.furnOn = false })}>فاضية</button>
      </div>

      <div className="grp">لون القماش (الافتراضي)</div>
      <div className="pal big">
        {FABRIC_SW.map(({ name, hex }) => (
          <button key={hex} className={'sw2' + (a.fabric.toLowerCase() === hex.toLowerCase() ? ' on' : '')} onClick={() => act(() => { a.fabric = hex })}>
            <i style={{ background: hex }} /><span>{name}</span>
          </button>
        ))}
      </div>
      <div className="grp">لون الخشب (الافتراضي)</div>
      <div className="pal big">
        {WOOD_SW.map(({ name, hex }) => (
          <button key={hex} className={'sw2' + (a.wood.toLowerCase() === hex.toLowerCase() ? ' on' : '')} onClick={() => act(() => { a.wood = hex })}>
            <i style={{ background: hex }} /><span>{name}</span>
          </button>
        ))}
      </div>

      <div className="seg2" style={{ marginTop: 10 }}>
        <button onClick={() => act(() => { a.furnOn = true; furnishRoom(a, R, all) })}>فرش تلقائي للغرفة</button>
        <button onClick={() => act(() => { a.furnOn = true; autoFurnishAll(a, all) })}>فرش الشقة كلها</button>
        <button onClick={() => act(() => { a.furniture[room.id] = []; fx.selected = null })}>مسح فرش الغرفة</button>
      </div>

      <div className="seg2" style={{ marginTop: 10 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">أضف قطعة...</option>
          {kinds.map((k) => <option key={k} value={k}>{FURN[k].name}</option>)}
        </select>
        <button disabled={!kind} onClick={() => act(() => { if (!kind) return null; a.furnOn = true; return placeNew(a, R, all, kind) })}>إضافة</button>
      </div>

      <label className="chk2 fchk">
        <input type="checkbox" checked={drag} onChange={(e) => { fx.enabled = e.target.checked; setDrag(e.target.checked) }} /> تحريك الفرش بالسحب
      </label>
      <p className="hint2">{drag ? 'اسحب أي قطعة. بتلتصق بالحيطة لما تقرّب منها، وبتتلوّن أحمر لو هتخبط. السحب على مكان فاضي بيلف الكاميرا.' : 'فعّل الخيار ده عشان تسحب الفرش بدل ما تلف الكاميرا.'}</p>

      {sel && sd && (
        <div className="furn-sel">
          <b>{sd.name}</b>
          <div className="seg2">
            <button onClick={() => act(() => rotateItem(R, all, items, sel))}>لف 90°</button>
            <button onClick={() => act(() => { removeItem(a, room.id, sel.id); fx.selected = null })}>حذف</button>
          </div>
          {swatches.length > 0 && (
            <>
              <div className="grp">لون القطعة دي</div>
              <div className="pal big">
                {swatches.map(({ name, hex }) => (
                  <button key={hex} className={'sw2' + ((sel.color ?? '').toLowerCase() === hex.toLowerCase() ? ' on' : '')} onClick={() => act(() => { sel.color = hex })}>
                    <i style={{ background: hex }} /><span>{name}</span>
                  </button>
                ))}
              </div>
              {sel.color && <button className="cta ghost" onClick={() => act(() => { sel.color = undefined })}>رجّع اللون الافتراضي</button>}
            </>
          )}
          {alts.length > 0 && (
            <label className="furn-alt">بدّل القطعة بـ
              <select value="" onChange={(e) => { if (e.target.value) swap(e.target.value) }}>
                <option value="">اختار قطعة تانية</option>
                {alts.map((x) => <option key={x.kind} value={x.kind}>{x.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      {msg && <div className="suit warn">{msg}</div>}
      <p className="hint2">{items.length} قطعة في الغرفة دي، و{R.columns.length} عمود. الأعمدة بتتضاف من صفحة التخطيط (الخطوة ٣).</p>
    </div>
  )
}