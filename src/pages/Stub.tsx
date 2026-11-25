import { go } from '../router'
export default function Stub({ route }: { route: string }) {
  const names: Record<string, string> = { plan: 'التخطيط المعماري 2D', style: 'الستايل والميزانية', viewer: 'المعاينة 360°', summary: 'ملخص المقايسة' }
  const name = names[route.split('?')[0]] ?? 'الصفحة'
  return (
    <div className="stub">
      <h2>{name}</h2>
      <p>الصفحة دي هي الخطوة الجاية في البناء.</p>
      <a href="#" onClick={(e) => { e.preventDefault(); go('') }}>← رجوع للرئيسية</a>
    </div>
  )
}
