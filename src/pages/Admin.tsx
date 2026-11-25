import { useEffect, useReducer, useRef, useState } from 'react'
import { go } from '../router'
import { ALL_FLOORS, LAYOUTS, floorGroups } from '../data/catalog'
import type { FloorConfig, FloorMaterial, Layout, Wet } from '../data/catalog'
import { fileToBlob, getPhoto, newId, registerPhoto, removeCustom, resetAll, saveCustom, setHidden, setOverride, storeState } from '../data/matStore'
import { floorCanvas } from '../three/floorTexture'
import FurnAdmin from './FurnAdmin'
import OpenAdmin from './OpenAdmin'
import FinAdmin from './FinAdmin'

const PIN = '1234' // غيّر الرقم ده قبل العرض (حماية بسيطة فقط، مش حماية حقيقية)

interface Draft {
  id: string; name: string; group: string; mode: 'tile' | 'seamless'
  wcm: number; lcm: number; groutMm: number; groutColor: string; rough: number
  colorable: boolean; rotate: boolean; wet: Wet; antiSlip: boolean; price: [number, number, number]
}
const EMPTY: Draft = {
  id: '', name: '', group: 'بورسلين', mode: 'tile', wcm: 60, lcm: 60, groutMm: 3, groutColor: '#C9C5BC',
  rough: 0.5, colorable: false, rotate: false, wet: 'ok', antiSlip: false, price: [300, 520, 900],
}

function toMaterial(d: Draft, photoId: string, v: number): FloorMaterial {
  const w = d.wcm / 100, l = d.lcm / 100
  const seamless = d.mode === 'seamless'
  const ratio = Math.max(w, l) / Math.min(w, l)
  return {
    id: d.id || 'draft', name: d.name || 'خامة جديدة', group: d.group || 'خامات أخرى',
    pattern: seamless ? 'plain' : ratio >= 2 ? 'plank' : 'tile',
    tint: d.colorable ? 'free' : 'fixed', base: d.colorable ? '#D8D3CA' : '#FFFFFF',
    rough: d.rough, size: [w, l], price: d.price, wet: d.wet, antiSlip: d.antiSlip,
    grout: !seamless && d.groutMm > 0, groutMm: d.groutMm, groutColor: d.groutColor,
    photo: { id: photoId, mode: seamless ? 'seamless' : 'tile', rotate: d.rotate, colorable: d.colorable }, v, custom: true,
  }
}

export default function Admin() {
  const [ok, setOk] = useState(() => sessionStorage.getItem('bayti.admin') === '1')
  const [pin, setPin] = useState('')
  const enter = () => { if (pin === PIN) { sessionStorage.setItem('bayti.admin', '1'); setOk(true) } }
  if (!ok) {
    return (
      <main className="container admin">
        <div className="adm-box narrow">
          <h3>لوحة إدارة الخامات</h3>
          <input type="password" placeholder="الرقم السري" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enter() }} />
          <button className="cta" onClick={enter}>دخول</button>
        </div>
      </main>
    )
  }
  return <Tabs />
}

function FloorsPanel() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [d, setD] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, setPending] = useState<Blob | null>(null)
  const [dv, setDv] = useState(1)
  const [layout, setLayout] = useState<Layout>('straight')
  const [pcolor, setPcolor] = useState('#D8D3CA')
  const [msg, setMsg] = useState('')
  const cvRef = useRef<HTMLCanvasElement>(null)
  const st = storeState()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const photoId = pending ? 'draft' : editing ?? 'draft'

  // معاينة مباشرة للخامة قبل الحفظ
  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const x = cv.getContext('2d')!
    if (!getPhoto(photoId)) { x.clearRect(0, 0, cv.width, cv.height); return }
    const m = toMaterial(d, photoId, dv)
    const cfg: FloorConfig = { material: m.id, color: d.colorable ? pcolor : m.base, layout, groutColor: d.groutColor, groutMm: d.groutMm }
    const src = floorCanvas(cfg, m).color
    cv.width = 360; cv.height = Math.round((360 * src.height) / src.width)
    cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height)
  }, [d, photoId, dv, layout, pcolor])

  const onFile = async (f?: File | null) => {
    if (!f) return
    try {
      const blob = await fileToBlob(f)
      await registerPhoto('draft', blob)
      setPending(blob); setDv((v) => v + 1); setMsg('')
    } catch { setMsg('الصورة دي مش مقبولة. جرّب JPG أو PNG.') }
  }

  const reset = () => { setD(EMPTY); setEditing(null); setPending(null); setMsg('') }

  const save = async () => {
    if (!d.name.trim()) return setMsg('اكتب اسم الخامة.')
    if (!editing && !pending) return setMsg('ارفع صورة الخامة الأول.')
    if (d.wcm < 5 || d.lcm < 5) return setMsg('المقاس لازم يكون 5 سم على الأقل.')
    const id = editing ?? newId()
    const old = ALL_FLOORS.find((x) => x.id === id)?.v ?? 0
    try {
      await saveCustom(toMaterial({ ...d, id }, id, old), pending ?? undefined)
      reset(); bump()
      setMsg('اتحفظت. هتلاقيها في صفحة العميل.')
    } catch { setMsg('حصل خطأ في الحفظ. جرّب صورة أصغر.') }
  }

  const edit = (m: FloorMaterial) => {
    const p = m.photo
    if (!p) return
    setD({
      id: m.id, name: m.name, group: m.group, mode: p.mode, wcm: Math.round(m.size[0] * 100), lcm: Math.round(m.size[1] * 100),
      groutMm: m.groutMm ?? 3, groutColor: m.groutColor ?? '#C9C5BC', rough: m.rough, colorable: p.colorable, rotate: p.rotate,
      wet: m.wet, antiSlip: !!m.antiSlip, price: m.price,
    })
    setEditing(m.id); setPending(null); setMsg(''); window.scrollTo(0, 0)
  }

  const del = async (m: FloorMaterial) => {
    if (!window.confirm(`حذف "${m.name}" نهائياً؟`)) return
    await removeCustom(m.id); if (editing === m.id) reset(); bump()
  }

  const setPrice = (i: number, v: number) => { const p: [number, number, number] = [...d.price]; p[i] = v; set('price', p) }
  const overPrice = (m: FloorMaterial, i: number, v: number) => { const p: [number, number, number] = [...m.price]; p[i] = v; setOverride(m.id, { price: p }); bump() }

  return (
    <main className="container admin">
      <div className="adm-head">
        <h2>لوحة إدارة الخامات: الأرضيات</h2>
        <div className="btn-row">
          <button className="cta ghost" onClick={() => go('plan')}>فتح صفحة العميل</button>
          <button className="cta ghost" onClick={async () => { if (window.confirm('مسح كل الخامات المضافة والتعديلات؟')) { await resetAll(); reset(); bump() } }}>مسح الكل</button>
        </div>
      </div>
      <p className="adm-note">الخامات بتتحفظ في المتصفح ده بس.</p>

      <section className="adm-box">
        <h3>{editing ? 'تعديل خامة' : 'إضافة خامة جديدة'}</h3>
        <div className="adm-cols">
          <div>
            <label>الاسم اللي هيظهر للعميل<input value={d.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>القسم
              <input list="grp" value={d.group} onChange={(e) => set('group', e.target.value)} />
              <datalist id="grp">{floorGroups().map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <label>طريقة الفرش
              <select value={d.mode} onChange={(e) => set('mode', e.target.value as 'tile' | 'seamless')}>
                <option value="tile">بلاطة أو لوح (صورة واحدة بتتفرش بفواصل)</option>
                <option value="seamless">خامة متصلة (صورة بتتكرر)</option>
              </select>
            </label>
            <label>صورة الخامة{d.mode === 'tile' ? ' (بلاطة واحدة، مقصوصة على حوافها)' : ' (صورة قابلة للتكرار)'}
              <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <div className="row2">
              <label>{d.mode === 'tile' ? 'عرض البلاطة (سم)' : 'العرض اللي بتغطيه الصورة (سم)'}<input type="number" min={5} value={d.wcm} onChange={(e) => set('wcm', +e.target.value)} /></label>
              <label>{d.mode === 'tile' ? 'طول البلاطة (سم)' : 'الطول اللي بتغطيه الصورة (سم)'}<input type="number" min={5} value={d.lcm} onChange={(e) => set('lcm', +e.target.value)} /></label>
            </div>
            {d.mode === 'tile' && (
              <div className="row2">
                <label>سمك الفاصل (مم، 0 = من غير فاصل)<input type="number" min={0} max={20} value={d.groutMm} onChange={(e) => set('groutMm', +e.target.value)} /></label>
                <label>لون الفاصل<input type="color" value={d.groutColor} onChange={(e) => set('groutColor', e.target.value)} /></label>
              </div>
            )}
          </div>
          <div>
            <label>اللمعة: {d.rough < 0.3 ? 'لامعة' : d.rough < 0.7 ? 'نصف لامعة' : 'مطفية'}
              <input type="range" min={0.05} max={1} step={0.05} value={d.rough} onChange={(e) => set('rough', +e.target.value)} />
            </label>
            <label className="chk"><input type="checkbox" checked={d.colorable} onChange={(e) => set('colorable', e.target.checked)} /> العميل يقدر يغيّر لونها</label>
            {d.mode === 'tile' && <label className="chk"><input type="checkbox" checked={d.rotate} onChange={(e) => set('rotate', e.target.checked)} /> تدوير عشوائي للبلاطات (للحجر الطبيعي)</label>}
            <label>تتحمل المياه؟
              <select value={d.wet} onChange={(e) => set('wet', e.target.value as Wet)}>
                <option value="ok">أيوه (مناسبة للحمام والمطبخ)</option>
                <option value="avoid">بحذر (بتتأثر بالمياه)</option>
                <option value="no">لأ (بتتلف مع المياه)</option>
              </select>
            </label>
            <label className="chk"><input type="checkbox" checked={d.antiSlip} onChange={(e) => set('antiSlip', e.target.checked)} /> ضد الانزلاق</label>
            <label>السعر للمتر (اقتصادي / متوسط / فاخر)</label>
            <div className="row3">
              {[0, 1, 2].map((i) => <input key={i} type="number" min={0} value={d.price[i]} onChange={(e) => setPrice(i, +e.target.value)} />)}
            </div>
          </div>
          <div>
            <label>معاينة</label>
            <canvas ref={cvRef} className="adm-prev" width={360} height={360} />
            <div className="seg2">
              {(Object.keys(LAYOUTS) as Layout[]).map((l) => <button key={l} className={layout === l ? 'on' : ''} onClick={() => setLayout(l)}>{LAYOUTS[l].name}</button>)}
            </div>
            {d.colorable && <label className="pick">لون المعاينة <input type="color" value={pcolor} onChange={(e) => setPcolor(e.target.value)} /></label>}
            {!getPhoto(photoId) && <p className="adm-note">ارفع صورة عشان تظهر المعاينة.</p>}
          </div>
        </div>
        {msg && <p className="msg">{msg}</p>}
        <div className="btn-row">
          <button className="cta" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة الخامة'}</button>
          {editing && <button className="cta ghost" onClick={reset}>إلغاء</button>}
        </div>
      </section>

      <section className="adm-box">
        <h3>كل الخامات ({ALL_FLOORS.length})</h3>
        <div className="adm-list">
          {ALL_FLOORS.map((m) => (
            <div className="adm-row" key={m.id + m.name}>
              <label className="chk"><input type="checkbox" checked={!st.hidden.includes(m.id)} onChange={(e) => { setHidden(m.id, !e.target.checked); bump() }} /> ظاهرة</label>
              {m.custom
                ? <b>{m.name} <small>({m.group}) مضافة</small></b>
                : <input defaultValue={m.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== m.name) { setOverride(m.id, { name: e.target.value.trim() }); bump() } }} />}
              {!m.custom && [0, 1, 2].map((i) => (
                <input key={i} type="number" className="pr" defaultValue={m.price[i]} onBlur={(e) => overPrice(m, i, +e.target.value)} />
              ))}
              {m.custom && (
                <div className="btn-row">
                  <button className="cta ghost" onClick={() => edit(m)}>تعديل</button>
                  <button className="cta ghost" onClick={() => del(m)}>حذف</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
function Tabs() {
  const [tab, setTab] = useState<'floors' | 'furn' | 'open' | 'fin'>('floors')
  return (
    <>
      <div className="container admin-tabs">
        <button className={tab === 'floors' ? 'on' : ''} onClick={() => setTab('floors')}>الأرضيات</button>
        <button className={tab === 'furn' ? 'on' : ''} onClick={() => setTab('furn')}>الفرش</button>
        <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>الأبواب والشبابيك</button>
        <button className={tab === 'fin' ? 'on' : ''} onClick={() => setTab('fin')}>المقايسة والتسعير</button>
      </div>
      {tab === 'floors' ? <FloorsPanel /> : tab === 'furn' ? <FurnAdmin /> : tab === 'open' ? <OpenAdmin /> : <FinAdmin />}
    </>
  )
}