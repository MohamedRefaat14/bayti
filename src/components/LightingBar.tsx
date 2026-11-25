import type { LampTone, Lighting, TimeOfDay } from '../data/lighting'

interface Props { value: Lighting; hasWindow: boolean; onChange: (l: Lighting) => void }

const LAMPS: [LampTone, string][] = [['warm', '💡 أصفر دافئ'], ['white', '💡 أبيض'], ['off', 'مطفي']]
const TIMES: [TimeOfDay, string][] = [['day', '☀️ نهار'], ['sunset', '🌇 غروب'], ['night', '🌙 ليل']]

export default function LightingBar({ value, hasWindow, onChange }: Props) {
  const set = (p: Partial<Lighting>) => onChange({ ...value, ...p })
  const closed = value.window === 'closed'
  return (
    <div className="light-bar">
      <div className="lg">
        <b>الإنارة</b>
        {LAMPS.map(([k, n]) => <button key={k} className={value.lamps === k ? 'on' : ''} onClick={() => set({ lamps: k })}>{n}</button>)}
      </div>
      <div className="lg">
        <b>السطوع</b>
        <input type="range" min={30} max={150} step={5} value={Math.round(value.level * 100)} disabled={value.lamps === 'off'}
          onChange={(e) => set({ level: +e.target.value / 100 })} />
        <span>{Math.round(value.level * 100)}%</span>
      </div>
      <div className="lg">
        <b>الشباك</b>
        <button disabled={!hasWindow} className={!closed ? 'on' : ''} onClick={() => set({ window: 'open' })}>مفتوح</button>
        <button disabled={!hasWindow} className={closed ? 'on' : ''} onClick={() => set({ window: 'closed' })}>مقفول</button>
        {!hasWindow && <span className="nw">مفيش شباك في الغرفة دي</span>}
      </div>
      <div className="lg">
        <b>الوقت</b>
        {TIMES.map(([k, n]) => (
          <button key={k} disabled={!hasWindow || closed} className={value.time === k ? 'on' : ''} onClick={() => set({ time: k })}>{n}</button>
        ))}
      </div>
    </div>
  )
}