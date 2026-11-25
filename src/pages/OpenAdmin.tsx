import { useReducer, useState } from 'react'
import * as THREE from 'three'
import { BASE, DEFAULTS, DOOR_COLORS, DOOR_DESIGNS, METAL_NAMES, OPEN, ROLE_NAMES, WIN_COLORS, WIN_DESIGNS } from '../openings'
import type { DoorRole, FrameDef, Metal } from '../openings'
import { clearDraft, newOpenId, removeCustom, resetOpen, saveCustom, setDefault, setDraftModel, setHidden, setOver, storeOpen } from '../data/openStore'
import OpeningPreview from '../components/OpeningPreview'

interface Draft {
  name: string; kind: 'door' | 'window'; design: string; roles: DoorRole[]
  price: [number, number, number]; color: string; colors: { name: string; hex: string }[]; metal: Metal
  modelRot: number; matMatch: string; fit: 'stretch' | 'contain'; defFor: string
}
const EMPTY: Draft = {
  name: '', kind: 'door', design: 'panel', roles: ['interior'], price: [3500, 7000, 15000], color: '#A9784F', colors: [],
  metal: 'chrome', modelRot: 0, matMatch: '', fit: 'stretch', defFor: '',
}
const ROLES: DoorRole[] = ['entrance', 'interior', 'bath']

export default function OpenAdmin() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [d, setD] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [hadModel, setHadModel] = useState(false)
  const [ver, setVer] = useState(0)
  const [pcolor, setPcolor] = useState('')
  const [msg, setMsg] = useState('')
  const st = storeOpen()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const hasModel = !!blob || hadModel
  const pid = blob ? 'draft' : editing ?? 'draft'
  const colors = d.colors.length ? d.colors : d.kind === 'door' ? DOOR_COLORS : WIN_COLORS
  const toDef = (id: string, v: number): FrameDef => ({
    id, kind: d.kind, name: d.name || 'بدون اسم', design: d.design, roles: d.kind === 'door' ? d.roles : undefined,
    price: d.price, color: d.color, colors, metal: d.metal, custom: true, v, glb: hasModel, modelRot: d.modelRot, matMatch: d.matMatch, fit: d.fit,
  })
  const preview = toDef(pid, ver)

  const reset = () => { setD(EMPTY); setEditing(null); setBlob(null); setHadModel(false); setPcolor(''); setMsg(''); clearDraft() }

  const onFile = async (f?: File | null) => {
    if (!f) return
    if (f.size > 30_000_000) return setMsg('الملف أكبر من 30 ميجا. ضغّطه الأول.')
    try {
      const buf = await f.arrayBuffer()
      await setDraftModel(buf)
      setBlob(new Blob([buf])); setVer((v) => v + 1)
      setMsg(f.size > 6_000_000 ? 'الموديل تقيل (أكتر من 6 ميجا)، ممكن يبطّأ الموقع. ضغّطه لو أمكن.' : '')
    } catch { setMsg('الملف مش مقبول. استخدم موديل .glb') }
  }

  const toggleRole = (r: DoorRole) => set('roles', d.roles.includes(r) ? d.roles.filter((x) => x !== r) : [...d.roles, r])
  const setPrice = (i: number, v: number) => { const p: [number, number, number] = [...d.price]; p[i] = v; set('price', p) }
  const setCol = (i: number, p: Partial<{ name: string; hex: string }>) => set('colors', colors.map((c, k) => (k === i ? { ...c, ...p } : c)))

  const save = async () => {
    if (!d.name.trim()) return setMsg('اكتب الاسم اللي هيظهر للعميل.')
    if (d.kind === 'door' && !d.roles.length) return setMsg('اختار نوع باب واحد على الأقل.')
    const id = editing ?? newOpenId()
    try {
      await saveCustom(toDef(id, OPEN[id]?.v ?? 0), blob ?? undefined)
      if (d.defFor) setDefault(d.defFor, id)
      else for (const r of Object.keys(DEFAULTS)) if (DEFAULTS[r] === id) setDefault(r, null)
      reset(); bump(); setMsg('اتحفظ. هتلاقيه في قايمة العميل.')
    } catch { setMsg('حصل خطأ في الحفظ. جرّب ملف أصغر.') }
  }

  const edit = (m: FrameDef) => {
    const defFor = Object.keys(DEFAULTS).find((r) => DEFAULTS[r] === m.id) ?? ''
    setD({
      name: m.name, kind: m.kind, design: m.design, roles: m.roles ?? [], price: m.price, color: m.color, colors: m.colors,
      metal: m.metal, modelRot: m.modelRot ?? 0, matMatch: m.matMatch ?? '', fit: m.fit ?? 'stretch', defFor,
    })
    setEditing(m.id); setBlob(null); setHadModel(!!m.glb); setMsg(''); clearDraft(); window.scrollTo(0, 0)
  }

  const del = async (m: FrameDef) => {
    if (!window.confirm(`حذف "${m.name}" نهائياً؟`)) return
    await removeCustom(m.id)
    if (editing === m.id) reset()
    bump()
  }

  const customs = st.custom
  const bases = Object.keys(BASE)
  const overPrice = (id: string, i: number, v: number) => { const p: [number, number, number] = [...OPEN[id].price]; p[i] = v; setOver(id, { price: p }); bump() }
  const designs = d.kind === 'door' ? DOOR_DESIGNS : WIN_DESIGNS

  return (
    <main className="container admin">
      <div className="adm-head">
        <h2>لوحة إدارة الخامات: الأبواب والشبابيك</h2>
        <div className="btn-row">
          <button className="cta ghost" onClick={async () => { if (window.confirm('مسح كل الأنواع المضافة والتعديلات؟')) { await resetOpen(); reset(); bump() } }}>مسح الكل</button>
        </div>
      </div>
      <p className="adm-note">الأنواع بتتحفظ في المتصفح ده بس. لو رفعت موديل .glb بيحل محل المجسم المرسوم.</p>

      <section className="adm-box">
        <h3>{editing ? 'تعديل نوع' : 'إضافة نوع جديد'}</h3>
        <div className="adm-cols">
          <div>
            <label>الاسم اللي هيظهر للعميل<input value={d.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>النوع
              <select value={d.kind} onChange={(e) => { const k = e.target.value as 'door' | 'window'; setD((x) => ({ ...x, kind: k, design: k === 'door' ? 'panel' : 'sliding', color: k === 'door' ? '#A9784F' : '#F2F2F0', colors: [], defFor: '' })) }}>
                <option value="door">باب</option><option value="window">شباك</option>
              </select>
            </label>
            <label>التصميم (المجسم المرسوم)
              <select value={d.design} onChange={(e) => set('design', e.target.value)}>
                {Object.entries(designs).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            {d.kind === 'door' && (
              <>
                <label>بيناسب</label>
                <div className="seg2">{ROLES.map((r) => <button key={r} className={d.roles.includes(r) ? 'on' : ''} onClick={() => toggleRole(r)}>{ROLE_NAMES[r]}</button>)}</div>
              </>
            )}
            <label>افتراضي لـ
              <select value={d.defFor} onChange={(e) => set('defFor', e.target.value)}>
                <option value="">مش افتراضي</option>
                {(d.kind === 'door' ? ROLES : ['window']).map((r) => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}
              </select>
            </label>
            <label>موديل 3D حقيقي (.glb) اختياري<input type="file" accept=".glb,model/gltf-binary" onChange={(e) => onFile(e.target.files?.[0])} /></label>
            {hasModel && (
              <div className="row2">
                <label>تدوير الموديل
                  <select value={d.modelRot} onChange={(e) => set('modelRot', +e.target.value)}>
                    <option value={0}>0°</option><option value={Math.PI / 2}>90°</option><option value={Math.PI}>180°</option><option value={-Math.PI / 2}>270°</option>
                  </select>
                </label>
                <label>التحجيم
                  <select value={d.fit} onChange={(e) => set('fit', e.target.value as 'stretch' | 'contain')}>
                    <option value="stretch">على مقاس الفتحة بالظبط</option><option value="contain">حافظ على النسب</option>
                  </select>
                </label>
              </div>
            )}
          </div>
          <div>
            <label>اللون الافتراضي<input type="color" value={d.color} onChange={(e) => set('color', e.target.value)} /></label>
            <label>ألوان العميل (فاضي = الألوان العامة)</label>
            {d.colors.map((c, i) => (
              <div className="row-g" key={i}>
                <input value={c.name} onChange={(e) => setCol(i, { name: e.target.value })} />
                <input type="color" value={c.hex} onChange={(e) => setCol(i, { hex: e.target.value })} />
                <button className="x" onClick={() => set('colors', d.colors.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
            <button className="cta ghost" style={{ marginTop: 6 }} onClick={() => set('colors', [...colors, { name: 'لون ' + (colors.length + 1), hex: '#8C9096' }])}>+ لون</button>
            {hasModel && (
              <label>اسم الخامة اللي تتلوّن جوه الموديل (فاضي = كل الخامات)
                <input value={d.matMatch} onChange={(e) => set('matMatch', e.target.value)} />
              </label>
            )}
            <label>ملمس المعدن (المقابض)
              <select value={d.metal} onChange={(e) => set('metal', e.target.value as Metal)}>
                {(Object.keys(METAL_NAMES) as Metal[]).map((m) => <option key={m} value={m}>{METAL_NAMES[m]}</option>)}
              </select>
            </label>
            <label>{d.kind === 'door' ? 'السعر للباب (اقتصادي / متوسط / فاخر)' : 'السعر للمتر المربع (اقتصادي / متوسط / فاخر)'}</label>
            <div className="row3">{[0, 1, 2].map((i) => <input key={i} type="number" min={0} value={d.price[i]} onChange={(e) => setPrice(i, +e.target.value)} />)}</div>
          </div>
          <div>
            <label>معاينة (اسحب للف، وعجلة الماوس للتقريب)</label>
            <OpeningPreview def={preview} color={pcolor || d.color} ver={ver} />
            <label className="pick">لون المعاينة <input type="color" value={pcolor || d.color} onChange={(e) => setPcolor(e.target.value)} /></label>
          </div>
        </div>
        {msg && <p className="msg">{msg}</p>}
        <div className="btn-row">
          <button className="cta" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة'}</button>
          {editing && <button className="cta ghost" onClick={reset}>إلغاء</button>}
        </div>
      </section>

      <section className="adm-box">
        <h3>الأنواع المضافة ({customs.length})</h3>
        {customs.length === 0 && <p className="adm-note">لسه ما أضفتش أنواع.</p>}
        {customs.map((m) => (
          <div className="fadm-row" key={m.id}>
            <label className="chk"><input type="checkbox" checked={!st.hidden.includes(m.id)} onChange={(e) => { setHidden(m.id, !e.target.checked); bump() }} /> ظاهر</label>
            <b>{m.name}</b>
            <small>{m.kind === 'door' ? 'باب' : 'شباك'} • {(m.kind === 'door' ? DOOR_DESIGNS : WIN_DESIGNS)[m.design]}{m.glb ? ' • موديل 3D' : ''}</small>
            <button className="cta ghost" onClick={() => edit(m)}>تعديل</button>
            <button className="cta ghost" onClick={() => del(m)}>حذف</button>
          </div>
        ))}
      </section>

      <section className="adm-box">
        <h3>الأنواع الأساسية (تعديل الاسم والسعر والإخفاء)</h3>
        {bases.map((id) => {
          const m = OPEN[id]
          return (
            <div className="fadm-row" key={id}>
              <label className="chk"><input type="checkbox" checked={!st.hidden.includes(id)} onChange={(e) => { setHidden(id, !e.target.checked); bump() }} /> ظاهر</label>
              <input className="nm" defaultValue={m.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) { setOver(id, { name: v }); bump() } }} />
              {[0, 1, 2].map((i) => <input key={i} type="number" className="pr" defaultValue={m.price[i]} onBlur={(e) => overPrice(id, i, +e.target.value)} />)}
              <small>{m.kind === 'door' ? 'باب (للقطعة)' : 'شباك (للمتر²)'}</small>
            </div>
          )
        })}
      </section>
    </main>
  )
}