import { useState } from 'react'
import { go } from '../router'
import { session } from '../state'
import { resetFinish } from '../apartment'
import { BUDGETS, STYLES } from '../data/options'
import StyleThumb from '../components/StyleThumb'

export default function Style() {
  const [style, setStyle] = useState(session.style)
  const [budget, setBudget] = useState(session.budget)

  const apply = () => {
    session.style = style
    session.budget = budget
    resetFinish(session.apt) // تطبيق تشطيب الستايل الجديد على كل الغرف
    go('viewer')
  }

  return (
    <main className="container style-page">
      <h2 className="sec-title">اختر الستايل المفضل</h2>
      <div className="opt-grid">
        {STYLES.map((s) => (
          <button key={s.id} className={'opt' + (style === s.id ? ' on' : '')} onClick={() => setStyle(s.id)}>
            <StyleThumb id={s.id} />
            <b>{s.label}</b>
          </button>
        ))}
      </div>

      <h2 className="sec-title">حدد فئة الميزانية</h2>
      <div className="opt-grid">
        {BUDGETS.map((b) => (
          <button key={b.id} className={'opt budget' + (budget === b.id ? ' on' : '')} onClick={() => setBudget(b.id)}>
            <b>{b.label}</b>
            <small>{b.text}</small>
          </button>
        ))}
      </div>

      <div className="apply-wrap">
        <button className="cta" onClick={apply}>تطبيق الاقتراحات التلقائية</button>
      </div>
    </main>
  )
}