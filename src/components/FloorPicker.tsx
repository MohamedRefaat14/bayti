import { FLOOR_MATERIALS, LAYOUTS, PALETTE, allowedLayouts, byId, defaultLayout, floorGroups, priceOf, suggest, suit, wasteOf } from '../data/catalog'
import type { FloorConfig, FloorMaterial } from '../data/catalog'
import { fmt } from '../data/pricing'
import type { BudgetId } from '../data/options'
import type { RoomView } from '../apartment'
import { floorThumb } from '../three/floorTexture'
import { floorRef } from '../data/pbrMap'
import { hasPbr } from '../three/pbr'

interface Props { room: RoomView; budget: BudgetId; onChange: (c: FloorConfig) => void }

export default function FloorPicker({ room, budget, onChange }: Props) {
  const cfg = room.floor
  const mat = byId(cfg.material)
  const s = suit(mat, room.type)
  const set = (p: Partial<FloorConfig>) => onChange({ ...cfg, ...p })
    const pick = (m: FloorMaterial) =>
    onChange({
      ...cfg, material: m.id, color: m.base,
      layout: allowedLayouts(m).includes(cfg.layout) ? cfg.layout : defaultLayout(m),
      groutMm: m.groutMm ?? cfg.groutMm, groutColor: m.groutColor ?? cfg.groutColor, // مقاسات الفاصل اللي حددتها في لوحة الإدارة
    })
  const pbr = hasPbr(floorRef(mat.id, cfg.color)) // خامة حقيقية: بتيجي بتصميمها الأصلي
  const lays = pbr ? [] : allowedLayouts(mat)

  return (
    <div className="floor-picker">
      <h4>نوع الأرضية</h4>
      {floorGroups().map((g) => (
        <div key={g}>
          <div className="grp">{g}</div>
          <div className="mat-grid">
            {FLOOR_MATERIALS.filter((m) => m.group === g).map((m) => {
              const su = suit(m, room.type)
              return (
                <button key={m.id} className={'mat' + (m.id === cfg.material ? ' on' : '')} onClick={() => pick(m)}>
                  <img src={floorThumb(m)} alt="" />
                  <span>{m.name}</span>
                  <small>{fmt(priceOf(m, budget))} ج/م²</small>
                  {su.level !== 'good' && <em className={su.level}>{su.level === 'bad' ? '⛔ مش مناسبة' : '⚠️ بحذر'}</em>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className={'suit ' + s.level}>
        {s.msg}
        {s.level !== 'good' && (
          <div className="alts">
            البدائل المناسبة:
            {suggest(room.type).slice(0, 5).map((m) => <button key={m.id} onClick={() => pick(m)}>{m.name}</button>)}
          </div>
        )}
      </div>

      <h4>اللون</h4>
      {mat.tint === 'free' && (
        <>
          <div className="pal">
            {PALETTE.map((h) => (
              <i key={h} className={cfg.color.toLowerCase() === h.toLowerCase() ? 'on' : ''} style={{ background: h }} onClick={() => set({ color: h })} />
            ))}
          </div>
          <label className="pick">لون مخصص <input type="color" value={cfg.color} onChange={(e) => set({ color: e.target.value })} /></label>
        </>
      )}
      {mat.tint !== 'free' && mat.swatches && (
        <>
          <div className="pal big">
            {mat.swatches.map((sw) => (
              <button key={sw.hex} className={'sw2' + (cfg.color.toLowerCase() === sw.hex.toLowerCase() ? ' on' : '')} onClick={() => set({ color: sw.hex })}>
                <i style={{ background: sw.hex }} /><span>{sw.name}</span>
              </button>
            ))}
          </div>
          <p className="hint2">{mat.tint === 'wood' ? 'درجات الخشب الحقيقية، عشان الخامة تفضل واقعية.' : 'أنواع طبيعية حقيقية.'}</p>
        </>
      )}

      {lays.length > 1 && (
        <>
          <h4>نمط الفرش</h4>
          <div className="seg2">
            {lays.map((l) => <button key={l} className={cfg.layout === l ? 'on' : ''} onClick={() => set({ layout: l })}>{LAYOUTS[l].name}</button>)}
          </div>
          <p className="hint2">الهدر المتوقع: {Math.round((wasteOf(mat, cfg.layout) - 1) * 100)}%</p>
        </>
      )}

      {pbr && <p className="hint2">خامة حقيقية بتصميمها وفواصلها الأصلية.</p>}
      {mat.grout && !pbr && (
        <>
          <h4>الفوغة</h4>
          <div className="row-g">
            <input type="color" value={cfg.groutColor} onChange={(e) => set({ groutColor: e.target.value })} />
            <select value={cfg.groutMm} onChange={(e) => set({ groutMm: +e.target.value })}>
              {Array.from(new Set([1, 2, 3, 5, 8, 10, cfg.groutMm])).sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v} مم</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  )
}