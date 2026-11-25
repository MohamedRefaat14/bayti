import { useState } from 'react'
import { SIDE_NAMES } from '../apartment'
import type { RoomView } from '../apartment'
import { session } from '../state'
import { getRooms } from '../rooms'
import { OPEN, ROLE_NAMES, openRole, pickStyle, styleList } from '../openings'

export default function OpeningsPanel({ room, onChange }: { room: RoomView; onChange: () => void }) {
  const a = session.apt
  const [msg, setMsg] = useState('')
  const all = getRooms()
  const R = all.find((r) => r.id === room.id) ?? room
  const list = R.openings.filter((o) => o.kind !== 'pass')
  const nameOf = (id: number | null) => all.find((r) => r.id === id)?.name ?? ''
  const act = (fn: () => void) => { fn(); setMsg(''); onChange() }
  if (!list.length) return null

  return (
    <div className="open-panel">
      <h4>الأبواب والشبابيك</h4>
      {list.map((o) => {
        const role = openRole(R.type, o)
        const fs = pickStyle(o.kind as 'door' | 'window', role, a.openFin, a.odef, o.id)
        const cur = fs.def
        const opts = styleList(o.kind as 'door' | 'window', role)
        if (!opts.some((x) => x.id === cur.id)) opts.push(cur)
        const label = o.kind === 'window' ? `شباك (${SIDE_NAMES[o.side]}) ${Math.round(o.width * 100)} سم` : o.to == null ? 'باب الشقة' : `باب ← ${nameOf(o.to)}`
        const setFin = (p: { style?: string; color?: string }) => act(() => { a.openFin[o.id] = { ...a.openFin[o.id], ...p } })
        return (
          <div className="open-item" key={o.id}>
            <b>{label}</b>
            <select value={cur.id} onChange={(e) => setFin({ style: e.target.value, color: OPEN[e.target.value]?.color })}>
              {opts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <div className="pal big">
              {cur.colors.map((c) => (
                <button key={c.hex} className={'sw2' + (fs.color.toLowerCase() === c.hex.toLowerCase() ? ' on' : '')} onClick={() => setFin({ color: c.hex })}>
                  <i style={{ background: c.hex }} /><span>{c.name}</span>
                </button>
              ))}
            </div>
            <button className="cta ghost" onClick={() => act(() => {
              a.odef[role] = cur.id
              for (const r of all) for (const x of r.openings) {
                if (x.own && x.kind !== 'pass' && openRole(r.type, x) === role && a.openFin[x.id]) delete a.openFin[x.id].style
              }
              setMsg(`اتطبّق على كل ${ROLE_NAMES[role]} في الشقة.`)
            })}>اجعله الافتراضي لكل {ROLE_NAMES[role]}</button>
          </div>
        )
      })}
      {msg && <p className="hint2">{msg}</p>}
    </div>
  )
}