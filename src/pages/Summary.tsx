import { SHAPE_NAMES } from '../apartment'
import { session } from '../state'
import { getRooms } from '../rooms'
import { BUDGETS, STYLES } from '../data/options'
import { tplById } from '../templates'
import { CAT_NAMES, fmt, projectTotals, roomLines } from '../report'
import type { Cat, Line } from '../report'

const n2 = (v: number) => v.toLocaleString('ar-EG', { maximumFractionDigits: 2 })

export default function Summary() {
  const a = session.apt, rooms = getRooms(), b = session.budget
  const budget = BUDGETS.find((x) => x.id === b)!
  const style = STYLES.find((x) => x.id === session.style)
  const blocks = rooms.map((r) => ({ r, lines: roomLines(r, b) }))
  const all: Line[] = blocks.flatMap((x) => x.lines)
  const T = projectTotals(rooms, b)
  const cats = (Object.keys(CAT_NAMES) as Cat[]).map((c) => {
    const ls = all.filter((l) => l.cat === c)
    return { c, cost: ls.reduce((s, l) => s + l.cost, 0), supply: ls.reduce((s, l) => s + l.qty * l.parts.supply, 0), labor: ls.reduce((s, l) => s + l.qty * l.parts.labor, 0), cons: ls.reduce((s, l) => s + l.qty * l.parts.cons, 0) }
  }).filter((x) => x.cost > 0)
  const sum = (cat: Cat, unit: string, key: 'net' | 'qty', label?: string) =>
    all.filter((l) => l.cat === cat && l.unit === unit && (!label || l.label === label)).reduce((s, l) => s + l[key], 0)
  const packs = (unit: string) => all.filter((l) => l.packs?.unit === unit).reduce((s, l) => s + (l.packs?.n ?? 0), 0)
  const built = rooms.reduce((s, r) => s + r.w * r.d, 0)

  const qrows: [string, number, string][] = [
    ['الأرضيات (صافي)', sum('floor', 'م²', 'net'), 'م²'],
    ['الأرضيات (بعد الهدر)', sum('floor', 'م²', 'qty'), 'م²'],
    ['كراتين الأرضيات (تقريباً)', packs('كرتونة'), 'كرتونة'],
    ['دهان الحيطان', sum('wall', 'م²', 'net'), 'م²'],
    ['بستلات الدهان', packs('بستلة'), 'بستلة'],
    ['حيطة الديكور (بعد الهدر)', sum('accent', 'م²', 'qty'), 'م²'],
    ['الدادو (بعد الهدر)', sum('dado', 'م²', 'qty'), 'م²'],
    ['الوزرات', sum('skirt', 'م.ط', 'net'), 'م.ط'],
    ['قطع الوزرة', packs('قطعة وزرة'), 'قطعة'],
    ['الأسقف', sum('ceiling', 'م²', 'net'), 'م²'],
    ['السبوت لايت', sum('light', 'نقطة', 'net'), 'نقطة'],
    ['شريط LED', sum('light', 'م.ط', 'net', 'شريط LED مخفي'), 'م.ط'],
    ['الكورنيش', sum('light', 'م.ط', 'net', 'كورنيش'), 'م.ط'],
  ]
  const pc = (v: number) => `${Math.round(v * 1000) / 10}%`

  return (
    <main className="container report-page">
      <div className="report">
        <div className="no-print rep-actions">
          <button className="cta" onClick={() => window.print()}>طباعة / حفظ PDF</button>
        </div>
        <h2>تقرير تشطيب الشقة</h2>
        <div className="rep-info">
          <span>التاريخ: <b>{new Date().toLocaleDateString('ar-EG')}</b></span>
          <span>{a.mode === 'template' ? 'النموذج' : 'الشكل'}: <b>{a.mode === 'template' ? tplById(a.tpl).name : SHAPE_NAMES[a.shape]}</b></span>
          <span>المساحة المبنية: <b>{n2(built)} م²</b></span>
          <span>المساحة الصافية: <b>{n2(rooms.reduce((s, r) => s + (r.cw ?? r.w) * (r.cd ?? r.d), 0))} م²</b></span>
          <span>سمك الحيطان: <b>خارجي {Math.round(a.wallExt * 100)} سم، داخلي {Math.round(a.wallInt * 100)} سم</b></span>
          <span>عدد الغرف: <b>{rooms.length}</b></span>
          <span>ارتفاع السقف: <b>{n2(a.height)} م</b></span>
          <span>الستايل: <b>{style?.label}</b></span>
          <span>فئة الميزانية: <b>{budget.label}</b></span>
        </div>

        <h3>ملخص التكاليف المباشرة</h3>
        <table className="rt">
          <thead><tr><th>القسم</th><th>توريد</th><th>مصنعية</th><th>مواد مساعدة</th><th>الإجمالي (ج.م)</th><th>النسبة</th></tr></thead>
          <tbody>
            {cats.map((x) => (
              <tr key={x.c}><td>{CAT_NAMES[x.c]}</td><td>{fmt(x.supply)}</td><td>{fmt(x.labor)}</td><td>{fmt(x.cons)}</td><td>{fmt(x.cost)}</td><td>{T.dc ? Math.round((x.cost / T.dc) * 100) : 0}%</td></tr>
            ))}
            <tr className="rtot"><td>التكلفة المباشرة</td><td>{fmt(T.supply)}</td><td>{fmt(T.labor)}</td><td>{fmt(T.cons)}</td><td>{fmt(T.dc)}</td><td>100%</td></tr>
          </tbody>
        </table>

        <h3>سعر العقد</h3>
        <table className="rt">
          <tbody>
            <tr><td>التكلفة المباشرة</td><td>{fmt(T.dc)}</td></tr>
            <tr><td>مصاريف غير مباشرة ({pc(T.indirect)}: إشراف ونقل مخلفات ونثريات)</td><td>{fmt(T.ic)}</td></tr>
            <tr><td>الإجمالي قبل الهامش</td><td>{fmt(T.sub)}</td></tr>
            <tr><td>هامش الربح ({pc(T.margin)} على التكلفة)</td><td>{fmt(T.mg)}</td></tr>
            <tr className="rtot"><td>سعر العقد الإجمالي (ج.م)</td><td>{fmt(T.price)}</td></tr>
          </tbody>
        </table>

        <h3>إجمالي الكميات</h3>
        <table className="rt">
          <thead><tr><th>البند</th><th>الكمية</th><th>الوحدة</th></tr></thead>
          <tbody>
            {qrows.filter((x) => x[1] > 0).map((x) => <tr key={x[0]}><td>{x[0]}</td><td>{n2(x[1])}</td><td>{x[2]}</td></tr>)}
          </tbody>
        </table>

        <h3>تفاصيل كل غرفة</h3>
        {blocks.map(({ r, lines }) => (
          <div className="rep-room" key={r.id}>
            <h4>{r.name} <small>({n2(r.w)}×{n2(r.d)} م = {n2(r.w * r.d)} م²، صافي {n2((r.cw ?? r.w) * (r.cd ?? r.d))} م²)</small></h4>
            <table className="rt">
              <thead><tr><th>البند</th><th>المواصفات</th><th>الصافي</th><th>الهدر</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>التكلفة</th></tr></thead>
              <tbody>
                {lines.map((l, k) => (
                  <>
                    <tr key={k}>
                      <td>{l.label}</td><td>{l.spec}</td><td>{n2(l.net)}</td>
                      <td>{l.waste > 1 ? `${Math.round((l.waste - 1) * 100)}%` : '-'}</td>
                      <td>{n2(l.qty)}</td><td>{l.unit}</td><td>{fmt(l.price)}</td><td>{fmt(l.cost)}</td>
                    </tr>
                    <tr key={k + 'n'} className="rnote">
                      <td colSpan={8}>سعر الوحدة = توريد {fmt(l.parts.supply)} + مصنعية {fmt(l.parts.labor)} + مواد مساعدة {fmt(l.parts.cons)}{l.note ? ` | ${l.note}` : ''}</td>
                    </tr>
                  </>
                ))}
                <tr className="rsub"><td colSpan={7}>إجمالي {r.name}</td><td>{fmt(lines.reduce((s, l) => s + l.cost, 0))}</td></tr>
              </tbody>
            </table>
            {r.columns.length > 0 && <p className="rnote2">الأعمدة: {r.columns.length} (مقاطعها اتخصمت من الأرضية، وجنباها اتحسبوا مع الدهان والوزرة).</p>}
          </div>
        ))}

        <div className="rep-total">سعر العقد الإجمالي: {fmt(T.price)} ج.م</div>

        <h3>ملاحظات</h3>
        <ul className="rep-notes">
          <li>الأسعار افتراضية حسب فئة الميزانية، وتحتاج مراجعتها مع الموردين قبل التنفيذ. الضرائب والنقل الخارجي غير مفصولة هنا.</li>
          <li>سعر الوحدة = توريد + مصنعية + مواد مساعدة. المصاريف غير المباشرة بتتحسب كنسبة من التكلفة المباشرة، وهامش الربح كنسبة على الإجمالي قبل الهامش.</li>
          <li>الكميات من الأبعاد الصافية (بين وش الحيطان). هدر الأرضية حسب نمط الفرش، والوزرة 5%، وخامات الحيطان غير الدهان 10%. الدهان بلا هدر.</li>
          <li>لترات الدهان تقديرية: تغطية 10 م² للتر الواحد في الوجه، ووجهين، وبستلة 9 لتر.</li>
          <li>المقاسات من المخطط المدخل، وتتراجع مع مهندس مرخّص قبل التنفيذ.</li>
        </ul>
      </div>
    </main>
  )
}