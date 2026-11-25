import { useReducer } from 'react'
import { CONS_LABELS, FIN, LABOR_LABELS } from '../data/finance'
import type { ConsCat, LaborKey } from '../data/finance'
import { resetFin, saveFin } from '../data/finStore'

const TIERS = ['اقتصادي', 'متوسط', 'فاخر']

export default function FinAdmin() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const setLabor = (k: LaborKey, i: number, v: number) => { FIN.labor[k][i] = Math.max(0, v || 0); saveFin(); bump() }
  const setCons = (k: ConsCat, v: number) => { FIN.cons[k] = Math.max(0, (v || 0) / 100); saveFin(); bump() }

  return (
    <main className="container admin">
      <div className="adm-head">
        <h2>لوحة إدارة: المقايسة والتسعير</h2>
        <div className="btn-row">
          <button className="cta ghost" onClick={() => { if (window.confirm('رجوع كل القيم للافتراضية؟')) { resetFin(); bump() } }}>رجوع للافتراضي</button>
        </div>
      </div>
      <p className="adm-note">
        أسعار الخامات (التوريد) بتتعدل من تبويباتها. هنا بتحدد المصنعية والمواد المساعدة والمصاريف غير المباشرة وهامش الربح.
        سعر الوحدة = توريد + مصنعية + مواد مساعدة. والتغيير بيتطبق فوراً على الشريط والتقرير.
      </p>

      <section className="adm-box">
        <h3>المصنعية للوحدة (جنيه)</h3>
        <div className="fin-grid fin-head"><span>البند</span><span>الوحدة</span>{TIERS.map((t) => <span key={t}>{t}</span>)}</div>
        {(Object.keys(LABOR_LABELS) as LaborKey[]).map((k) => (
          <div className="fin-grid" key={k}>
            <span>{LABOR_LABELS[k].name}</span><span>{LABOR_LABELS[k].unit}</span>
            {[0, 1, 2].map((i) => <input key={i} type="number" min={0} defaultValue={FIN.labor[k][i]} onBlur={(e) => setLabor(k, i, +e.target.value)} />)}
          </div>
        ))}
      </section>

      <section className="adm-box">
        <h3>المواد المساعدة (% من سعر التوريد)</h3>
        {(Object.keys(CONS_LABELS) as ConsCat[]).map((k) => (
          <div className="fin-grid fin-2" key={k}>
            <span>{CONS_LABELS[k]}</span>
            <input type="number" min={0} step={0.5} defaultValue={Math.round(FIN.cons[k] * 1000) / 10} onBlur={(e) => setCons(k, +e.target.value)} />
          </div>
        ))}
      </section>

      <section className="adm-box">
        <h3>المصاريف غير المباشرة وهامش الربح</h3>
        <div className="fin-grid fin-2">
          <span>مصاريف غير مباشرة (إشراف ونقل مخلفات ونثريات) % من التكلفة المباشرة</span>
          <input type="number" min={0} step={0.5} defaultValue={Math.round(FIN.indirect * 1000) / 10} onBlur={(e) => { FIN.indirect = Math.max(0, (+e.target.value || 0) / 100); saveFin(); bump() }} />
        </div>
        <div className="fin-grid fin-2">
          <span>هامش الربح % (على التكلفة، بيتحسب بعد المصاريف غير المباشرة)</span>
          <input type="number" min={0} step={0.5} defaultValue={Math.round(FIN.margin * 1000) / 10} onBlur={(e) => { FIN.margin = Math.max(0, (+e.target.value || 0) / 100); saveFin(); bump() }} />
        </div>
        <p className="adm-note">سعر العقد = (التكلفة المباشرة + المصاريف غير المباشرة) × (1 + الهامش). الشركات عادةً 8 إلى 15% مصاريف، و15 إلى 25% هامش.</p>
      </section>
    </main>
  )
}