import { SIDE_NAMES } from '../apartment'
import type { RoomView, Side } from '../apartment'
import { PALETTE } from '../data/catalog'
import type { BudgetId } from '../data/options'
import { fmt } from '../data/pricing'
import {
  FINISHES, PAINT_GROUPS, WALL_GROUPS, WALL_MATERIALS, suggestWall, suitMaterial, suitPaint, wmById, wmPrice,
} from '../data/wallCatalog'
import type { Finish, WallConfig, WallMaterial } from '../data/wallCatalog'
import { wallThumb } from '../three/wallTexture'

interface Props { room: RoomView; budget: BudgetId; onChange: (w: WallConfig) => void }

function Tint({ m, color, onPick }: { m: WallMaterial; color: string; onPick: (c: string) => void }) {
  if (m.tint === 'fixed' && m.swatches) {
    return (
      <div className="pal big">
        {m.swatches.map((s) => (
          <button key={s.hex} className={'sw2' + (color.toLowerCase() === s.hex.toLowerCase() ? ' on' : '')} onClick={() => onPick(s.hex)}>
            <i style={{ background: s.hex }} /><span>{s.name}</span>
          </button>
        ))}
      </div>
    )
  }
  return (
    <>
      <div className="pal">
        {PALETTE.map((h) => <i key={h} className={color.toLowerCase() === h.toLowerCase() ? 'on' : ''} style={{ background: h }} onClick={() => onPick(h)} />)}
      </div>
      <label className="pick">لون مخصص <input type="color" value={color} onChange={(e) => onPick(e.target.value)} /></label>
    </>
  )
}

function MatGrid({ budget, room, current, onPick }: { budget: BudgetId; room: RoomView; current: string; onPick: (m: WallMaterial) => void }) {
  return (
    <>
      {WALL_GROUPS.map((g) => (
        <div key={g}>
          <div className="grp">{g}</div>
          <div className="mat-grid">
            {WALL_MATERIALS.filter((m) => m.group === g).map((m) => {
              const su = suitMaterial(m, room.type)
              return (
                <button key={m.id} className={'mat' + (m.id === current ? ' on' : '')} onClick={() => onPick(m)}>
                  <img src={wallThumb(m)} alt="" />
                  <span>{m.name}</span>
                  <small>{fmt(wmPrice(m, budget))} ج/م²</small>
                  {su.level !== 'good' && <em className={su.level}>{su.level === 'bad' ? '⛔ مش مناسبة' : '⚠️ بحذر'}</em>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

export default function WallPicker({ room, budget, onChange }: Props) {
  const W = room.wall
  const set = (p: Partial<WallConfig>) => onChange({ ...W, ...p })
  const area = room.w * room.d
  const paintSuit = suitPaint(W.color, W.finish, room.type, area)
  const acc = W.accent.side ? wmById(W.accent.material) : null
  const accSuit = acc ? suitMaterial(acc, room.type) : null
  const dadoMat = W.dado.material ? wmById(W.dado.material) : null
  const dadoSuit = dadoMat ? suitMaterial(dadoMat, room.type) : null

  const pickAccent = (m: WallMaterial) => set({ accent: { side: W.accent.side ?? 'N', material: m.id, color: m.base } })
  const pickDado = (id: string) => {
    if (!id) return set({ dado: { ...W.dado, material: '' } })
    const m = wmById(id)
    set({ dado: { ...W.dado, material: id, color: m.base } })
  }

  return (
    <div className="wall-picker">
      <h4>لون الدهان</h4>
      {PAINT_GROUPS.map((g) => (
        <div key={g.name}>
          <div className="grp">{g.name}</div>
          <div className="pal">
            {g.colors.map((h) => <i key={h} className={W.color.toLowerCase() === h.toLowerCase() ? 'on' : ''} style={{ background: h }} onClick={() => set({ color: h })} />)}
          </div>
        </div>
      ))}
      <label className="pick">لون مخصص <input type="color" value={W.color} onChange={(e) => set({ color: e.target.value })} /></label>

      <h4>اللمعة</h4>
      <div className="seg2">
        {(Object.keys(FINISHES) as Finish[]).map((f) => <button key={f} className={W.finish === f ? 'on' : ''} onClick={() => set({ finish: f })}>{FINISHES[f].name}</button>)}
      </div>
      <p className="hint2">{FINISHES[W.finish].note}</p>
      <div className={'suit ' + paintSuit.level}>{paintSuit.msg}</div>

      <h4>حيطة ديكور</h4>
      <label>الحيطة
        <select value={W.accent.side ?? ''} onChange={(e) => set({ accent: { ...W.accent, side: (e.target.value || null) as Side | null } })}>
          <option value="">بدون</option>
          {(Object.keys(SIDE_NAMES) as Side[]).map((s) => <option key={s} value={s}>{SIDE_NAMES[s]}</option>)}
        </select>
      </label>
      {acc && (
        <>
          <MatGrid budget={budget} room={room} current={W.accent.material} onPick={pickAccent} />
          <h4>لون الخامة</h4>
          <Tint m={acc} color={W.accent.color} onPick={(c) => set({ accent: { ...W.accent, color: c } })} />
          {accSuit && (
            <div className={'suit ' + accSuit.level}>
              {accSuit.msg}
              {accSuit.level !== 'good' && (
                <div className="alts">البدائل المناسبة:{suggestWall(room.type).slice(0, 4).map((m) => <button key={m.id} onClick={() => pickAccent(m)}>{m.name}</button>)}</div>
              )}
            </div>
          )}
        </>
      )}

      <h4>دادو (الجزء السفلي من الحيطان)</h4>
      <div className="seg2">
        <button className={!W.dado.on ? 'on' : ''} onClick={() => set({ dado: { ...W.dado, on: false } })}>بدون</button>
        <button className={W.dado.on ? 'on' : ''} onClick={() => set({ dado: { ...W.dado, on: true } })}>مفعّل</button>
      </div>
      {W.dado.on && (
        <>
          <label>الارتفاع
            <select value={W.dado.height} onChange={(e) => set({ dado: { ...W.dado, height: +e.target.value } })}>
              {[0.9, 1.2, 1.5, 2.1].map((v) => <option key={v} value={v}>{v} م</option>)}
            </select>
          </label>
          <label>الخامة
            <select value={W.dado.material} onChange={(e) => pickDado(e.target.value)}>
              <option value="">دهان</option>
              {WALL_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          {dadoMat
            ? <Tint m={dadoMat} color={W.dado.color} onPick={(c) => set({ dado: { ...W.dado, color: c } })} />
            : <label className="pick">لون الدهان <input type="color" value={W.dado.color} onChange={(e) => set({ dado: { ...W.dado, color: e.target.value } })} /></label>}
          {dadoSuit && <div className={'suit ' + dadoSuit.level}>{dadoSuit.msg}</div>}
        </>
      )}

      <h4>الوزرة</h4>
      <div className="row-g">
        <select value={W.skirt.height} onChange={(e) => set({ skirt: { ...W.skirt, height: +e.target.value } })}>
          {[0.07, 0.1, 0.15, 0.2].map((v) => <option key={v} value={v}>{Math.round(v * 100)} سم</option>)}
        </select>
        <input type="color" value={W.skirt.color} onChange={(e) => set({ skirt: { ...W.skirt, color: e.target.value } })} />
      </div>
    </div>
  )
}