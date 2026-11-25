import { useReducer, useRef, useState } from 'react'
import { go } from '../router'
import { session } from '../state'
import { deleteSlot, duplicateSlot, exportFileName, importText, listSlots, newProject, notice, openSlot, saveSlot, snapshot } from '../project'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Projects() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [name, setName] = useState(session.name)
  const [msg, setMsg] = useState(notice.text)
  const [warns, setWarns] = useState<string[]>(notice.warnings)
  const file = useRef<HTMLInputElement>(null)
  const slots = listSlots()
  const clearNotice = () => { notice.text = ''; notice.warnings = [] }

  const onImport = async (f?: File | null) => {
    if (!f) return
    if (f.size > 8_000_000) return setMsg('الملف أكبر من 8 ميجا.')
    const r = importText(await f.text())
    if (!r.ok) { setMsg(r.error ?? 'الملف مش سليم'); setWarns([]) }
    if (file.current) file.current.value = ''
  }
  const note = (e: string | null, ok: string) => { setMsg(e ?? ok); setWarns([]); bump() }

  return (
    <main className="container admin">
      <div className="adm-head"><h2>مشاريعي</h2></div>
      {(msg || warns.length > 0) && (
        <div className="adm-box proj-note">
          {msg && <p style={{ margin: 0 }}>{msg}</p>}
          {warns.map((w, i) => <p className="warn" key={i}>{w}</p>)}
          <button className="cta ghost" onClick={() => { clearNotice(); setMsg(''); setWarns([]) }}>إخفاء</button>
        </div>
      )}

      <section className="adm-box">
        <h3>المشروع الحالي</h3>
        <p className="adm-note">بيتحفظ تلقائياً في المتصفح، وبيتفتح لوحده لما ترجع.</p>
        <label>اسم المشروع<input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { session.name = name.trim() || 'مشروع بدون اسم' }} /></label>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <button className="cta" onClick={() => note(saveSlot(name.trim() || 'مشروع بدون اسم'), 'اتحفظ في مشاريعي.')}>حفظ في مشاريعي</button>
          <button className="cta ghost" onClick={() => { session.name = name.trim() || session.name; download(exportFileName(session.name), JSON.stringify(snapshot(), null, 1)) }}>تنزيل ملف</button>
          <button className="cta ghost" onClick={() => file.current?.click()}>فتح ملف مشروع</button>
          <button className="cta ghost" onClick={() => { if (window.confirm('تبدأ مشروع جديد؟ المشروع الحالي هيتمسح من الحفظ التلقائي (احفظه الأول لو عايزه).')) newProject() }}>مشروع جديد</button>
          <button className="cta ghost" onClick={() => go('plan')}>كمّل التصميم</button>
        </div>
        <input ref={file} type="file" accept=".json,application/json" className="hide" onChange={(e) => onImport(e.target.files?.[0])} />
      </section>

      <section className="adm-box">
        <h3>المشاريع المحفوظة ({slots.length})</h3>
        {slots.length === 0 && <p className="adm-note">لسه ما حفظتش مشاريع.</p>}
        {slots.map((s) => (
          <div className="fadm-row" key={s.id}>
            <b>{s.name}</b>
            <small>{s.summary.rooms} غرفة • {s.summary.area} م² • {new Date(s.savedAt).toLocaleString('ar-EG')}</small>
            <button className="cta ghost" onClick={() => { const e = openSlot(s.id); if (e) note(e, '') }}>فتح</button>
            <button className="cta ghost" onClick={() => note(saveSlot(name.trim() || s.name, s.id), 'اتحدّث المشروع المحفوظ.')}>حفظ فوقه</button>
            <button className="cta ghost" onClick={() => note(duplicateSlot(s.id), 'اتعملت نسخة.')}>نسخ</button>
            <button className="cta ghost" onClick={() => download(exportFileName(s.name), JSON.stringify(s.file, null, 1))}>تنزيل</button>
            <button className="cta ghost" onClick={() => { if (window.confirm(`حذف "${s.name}"؟`)) { deleteSlot(s.id); bump() } }}>حذف</button>
          </div>
        ))}
        <p className="adm-note">الملفات والمشاريع المحفوظة هنا بتفضل على المتصفح ده. للنقل لجهاز تاني نزّل ملف. الصور والموديلات اللي بتضيفها من الداشبورد مش بتتنقل مع الملف.</p>
      </section>
    </main>
  )
}