import { go } from '../router'

const STEPS = [
  { id: 'plan', label: '١ التخطيط 2D' },
  { id: 'viewer', label: '٢ التشطيب والفرش 360°' },
  { id: 'summary', label: '٣ ملخص التكلفة' },
]

export default function StepBar({ route }: { route: string }) {
  return (
    <nav className="stepbar">
      {STEPS.map((s) => (
        <button key={s.id} className={route === s.id || (s.id === 'viewer' && route === 'style') ? 'on' : ''} onClick={() => go(s.id === 'viewer' ? 'style' : s.id)}>
          {s.label}
        </button>
      ))}
    </nav>
  )
}