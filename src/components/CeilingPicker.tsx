import type { RoomView } from '../apartment'
import { PALETTE } from '../data/catalog'
import {
  CEILING_TYPES, MATERIALS, WOOD_SW, allowedMaterials, safeFor, suitCeiling, supportsCornice, supportsLed, typePrice, withType,
} from '../data/ceilingCatalog'
import type { CeilingConfig, CeilingType, Cornice, LedTone, SpotMode } from '../data/ceilingCatalog'
import type { BudgetId } from '../data/options'
import { fmt } from '../data/pricing'

interface Props { room: RoomView; budget: BudgetId; onChange: (c: CeilingConfig) => void }

// مقطع جانبي صغير يوضح شكل السقف
const PROFILE: Record<CeilingType, string> = {
  flat: 'M4 8 H60',
  cove: 'M4 14 H14 V8 H50 V14 H60',
  stepped: 'M4 16 H12 V12 H20 V8 H44 V12 H52 V16 H60',
  coffered: 'M4 8 H12 V13 H16 V8 H26 V13 H30 V8 H40 V13 H44 V8 H60',
  floating: 'M4 8 H60 M14 14 H50',
  slats: 'M4 8 H60 M10 8 V14 M18 8 V14 M26 8 V14 M34 8 V14 M42 8 V14 M50 8 V14',
}
function Cross({ type }: { type: CeilingType }) {
  return (
    <svg viewBox="0 0 64 30" className="cross" aria-hidden>
      <path d="M4 4V28M60 4V28" stroke="currentColor" strokeWidth="1.5" opacity=".4" fill="none" />
      <path d={PROFILE[type]} stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

const LEDS: [LedTone, string][] = [['off', 'بدون'], ['warm', 'دافئ'], ['neutral', 'محايد'], ['cool', 'بارد']]
const SPOTS: [SpotMode, string][] = [['none', 'بدون'], ['grid', 'شبكة'], ['perimeter', 'محيط']]
const CORNICES: [Cornice, string][] = [['none', 'بدون'], ['simple', 'بسيط'], ['classic', 'كلاسيك']]

export default function CeilingPicker({ room, budget, onChange }: Props) {
  const c = room.ceiling
  const set = (p: Partial<CeilingConfig>) => onChange({ ...c, ...p })
  const s = suitCeiling(c, room.type, room.w * room.d, room.h)
  const mats = allowedMaterials(c.type)

  return (
    <div className="ceiling-picker">
      <h4>نوع السقف</h4>
      <div className="ctype-grid">
        {CEILING_TYPES.map((t) => (
          <button key={t.id} className={'ctype' + (c.type === t.id ? ' on' : '')} onClick={() => onChange(withType(c, t.id))}>
            <Cross type={t.id} />
            <span>{t.name}</span>
            <small>{t.desc}</small>
            <small>{fmt(typePrice(t.id, budget))} ج/م²</small>
          </button>
        ))}
      </div>

      {mats.length > 1 && (
        <>
          <h4>الخامة</h4>
          <div className="seg2">
            {mats.map((m) => <button key={m} className={c.material === m ? 'on' : ''} onClick={() => set({ material: m })}>{MATERIALS[m].name}</button>)}
          </div>
        </>
      )}

      <div className={'suit ' + s.level}>
        {s.msg}
        {s.level !== 'good' && (
          <div className="alts"><button onClick={() => onChange(safeFor(c, room.type))}>طبّق الأنسب</button></div>
        )}
      </div>

      <h4>لون السقف</h4>
      {c.material === 'wood' ? (
        <div className="pal big">
          {WOOD_SW.map((w) => (
            <button key={w.hex} className={'sw2' + (c.color.toLowerCase() === w.hex.toLowerCase() ? ' on' : '')} onClick={() => set({ color: w.hex })}>
              <i style={{ background: w.hex }} /><span>{w.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="pal">
            {PALETTE.map((h) => <i key={h} className={c.color.toLowerCase() === h.toLowerCase() ? 'on' : ''} style={{ background: h }} onClick={() => set({ color: h })} />)}
          </div>
          <label className="pick">لون مخصص <input type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} /></label>
        </>
      )}

      {supportsLed(c.type) && (
        <>
          <h4>إضاءة LED المخفية</h4>
          <div className="seg2">{LEDS.map(([k, n]) => <button key={k} className={c.led === k ? 'on' : ''} onClick={() => set({ led: k })}>{n}</button>)}</div>
        </>
      )}

      <h4>السبوت لايت</h4>
      <div className="seg2">{SPOTS.map(([k, n]) => <button key={k} className={c.spots === k ? 'on' : ''} onClick={() => set({ spots: k })}>{n}</button>)}</div>

      <h4>نجفة</h4>
      <div className="seg2">
        <button className={!c.chandelier ? 'on' : ''} onClick={() => set({ chandelier: false })}>بدون</button>
        <button className={c.chandelier ? 'on' : ''} onClick={() => set({ chandelier: true })}>نجفة في المنتصف</button>
      </div>

      {supportsCornice(c.type) && (
        <>
          <h4>كورنيش</h4>
          <div className="seg2">{CORNICES.map(([k, n]) => <button key={k} className={c.cornice === k ? 'on' : ''} onClick={() => set({ cornice: k })}>{n}</button>)}</div>
        </>
      )}
    </div>
  )
}