import { useReducer, useState } from 'react'
import * as THREE from 'three'
import { TYPE_NAMES } from '../apartment'
import type { RoomType } from '../apartment'
import { BASE, FURN, PREF } from '../furniture'
import type { ColorRole, FurnDef } from '../furniture'
import { clearDraft, newFurnId, removeCustom, resetFurn, saveCustom, setDraftImage, setDraftModel, setHidden, setOver, setPref, storeFurn } from '../data/furnStore'
import { fileToBlob } from '../data/matStore'
import FurnPreview from '../components/FurnPreview'

interface Draft {
  name: string; mode: 'model' | 'rug'
  wcm: number; dcm: number; hcm: number
  rooms: RoomType[]; role: string; wall: boolean; acc: boolean; surfOn: boolean
  colorRole: ColorRole; matMatch: string; colors: { name: string; hex: string }[]
  modelRot: number; fit: 'stretch' | 'contain'
  price: [number, number, number]; pref: boolean
}
const EMPTY: Draft = {
  name: '', mode: 'model', wcm: 100, dcm: 60, hcm: 80, rooms: ['living'], role: '', wall: false, acc: false, surfOn: false,
  colorRole: 'none', matMatch: '', colors: [], modelRot: 0, fit: 'stretch', price: [3000, 6000, 12000], pref: false,
}
const ROOM_TYPES = Object.keys(TYPE_NAMES) as RoomType[]

function toDef(d: Draft, id: string, v: number): FurnDef {
  const rug = d.mode === 'rug'
  const w = d.wcm / 100, dp = d.dcm / 100, h = rug ? 0.02 : d.hcm / 100
  return {
    kind: id, name: d.name || 'قطعة جديدة', w, d: dp, h, rooms: d.rooms, price: d.price, glb: `custom:${id}`, custom: true, v,
    role: d.role || undefined, wall: rug ? false : d.wall, acc: !rug && d.acc ? true : undefined, rug: rug || undefined,
    surf: !rug && d.surfOn && !d.acc ? [w, dp, h] : undefined,
    colorRole: rug ? 'none' : d.colorRole, matMatch: d.matMatch, colors: d.colors.length ? d.colors : undefined,
    modelRot: d.modelRot, fit: d.fit, mode: d.mode,
  }
}

export default function FurnAdmin() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [d, setD] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [ver, setVer] = useState(0)
  const [nat, setNat] = useState<[number, number, number] | null>(null)
  const [pcolor, setPcolor] = useState<string | undefined>(undefined)
  const [msg, setMsg] = useState('')
  const st = storeFurn()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const previewKind = blob ? 'draft' : editing ?? 'draft'
  const def = toDef(d, previewKind, ver)

  const reset = () => { setD(EMPTY); setEditing(null); setBlob(null); setNat(null); setPcolor(undefined); setMsg(''); clearDraft() }

  const onFile = async (f?: File | null) => {
    if (!f) return
    if (f.size > 30_000_000) return setMsg('الملف أكبر من 30 ميجا. ضغّطه الأول.')
    try {
      if (d.mode === 'model') {
        const buf = await f.arrayBuffer()
        const obj = await setDraftModel(buf)
        const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3())
        setNat([s.x, s.y, s.z]); setBlob(new Blob([buf]))
        setMsg(f.size > 6_000_000 ? 'الموديل تقيل (أكتر من 6 ميجا)، ممكن يبطّأ الموقع على الموبايل. ضغّطه لو أمكن.' : '')
      } else {
        const b = await fileToBlob(f, 1024)
        await setDraftImage(b); setBlob(b); setMsg('')
      }
      setVer((v) => v + 1)
    } catch {
      setMsg('الملف مش مقبول. للموديل استخدم .glb، وللسجادة صورة JPG أو PNG.')
    }
  }

  const useNat = () => {
    if (!nat) return
    const r = (v: number) => Math.max(1, Math.round(v * 100))
    setD((x) => ({ ...x, wcm: r(nat[0]), hcm: r(nat[1]), dcm: r(nat[2]) }))
  }

  const toggleRoom = (t: RoomType) => set('rooms', d.rooms.includes(t) ? d.rooms.filter((x) => x !== t) : [...d.rooms, t])
  const setPrice = (i: number, v: number) => { const p: [number, number, number] = [...d.price]; p[i] = v; set('price', p) }
  const setColor = (i: number, patch: Partial<{ name: string; hex: string }>) => set('colors', d.colors.map((c, k) => (k === i ? { ...c, ...patch } : c)))

  const save = async () => {
    if (!d.name.trim()) return setMsg('اكتب اسم القطعة.')
    if (!d.rooms.length) return setMsg('اختار غرفة واحدة على الأقل.')
    if (d.wcm < 3 || d.dcm < 3 || (d.mode === 'model' && d.hcm < 3)) return setMsg('المقاسات مش مظبوطة.')
    if (!editing && !blob) return setMsg(d.mode === 'model' ? 'ارفع الموديل الأول (.glb).' : 'ارفع صورة السجادة الأول.')
    const id = editing ?? newFurnId()
    try {
      await saveCustom(toDef(d, id, FURN[id]?.v ?? 0), blob ?? undefined)
      if (d.role) {
        if (d.pref) setPref(d.role, id)
        else if (PREF[d.role] === id) setPref(d.role, null)
      }
      reset(); bump()
      setMsg('اتحفظت. هتلاقيها في قايمة الفرش للعميل.')
    } catch {
      setMsg('حصل خطأ في الحفظ. جرّب ملف أصغر.')
    }
  }

  const edit = (m: FurnDef) => {
    setD({
      name: m.name, mode: m.mode ?? 'model', wcm: Math.round(m.w * 100), dcm: Math.round(m.d * 100), hcm: Math.round(m.h * 100),
      rooms: m.rooms, role: m.role ?? '', wall: !!m.wall, acc: !!m.acc, surfOn: !!m.surf,
      colorRole: m.colorRole ?? 'none', matMatch: m.matMatch ?? '', colors: m.colors ?? [],
      modelRot: m.modelRot ?? 0, fit: m.fit ?? 'stretch', price: m.price, pref: !!m.role && PREF[m.role] === m.kind,
    })
    setEditing(m.kind); setBlob(null); setNat(null); setMsg(''); clearDraft(); window.scrollTo(0, 0)
  }

  const del = async (m: FurnDef) => {
    if (!window.confirm(`حذف "${m.name}" نهائياً؟ هتتشال من أي شقة مفروشة بيها.`)) return
    await removeCustom(m.kind)
    if (editing === m.kind) reset()
    bump()
  }

  const customs = st.custom
  const baseKinds = Object.keys(BASE)
  const overPrice = (k: string, i: number, v: number) => { const p: [number, number, number] = [...FURN[k].price]; p[i] = v; setOver(k, { price: p }); bump() }

  return (
    <main className="container admin">
      <div className="adm-head">
        <h2>لوحة إدارة الخامات: الفرش</h2>
        <div className="btn-row">
          <button className="cta ghost" onClick={async () => { if (window.confirm('مسح كل القطع المضافة والتعديلات؟')) { await resetFurn(); reset(); bump() } }}>مسح الكل</button>
        </div>
      </div>
      <p className="adm-note">الموديلات بتتحفظ في المتصفح ده بس. الفرش بيتحط من الموديل (.glb)، والسجاد من صورة.</p>

      <section className="adm-box">
        <h3>{editing ? 'تعديل قطعة' : 'إضافة قطعة جديدة'}</h3>
        <div className="adm-cols">
          <div>
            <label>الاسم اللي هيظهر للعميل<input value={d.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>النوع
              <select value={d.mode} onChange={(e) => { set('mode', e.target.value as 'model' | 'rug'); setBlob(null); setNat(null); clearDraft() }}>
                <option value="model">قطعة فرش (موديل 3D بصيغة glb)</option>
                <option value="rug">سجادة (من صورة)</option>
              </select>
            </label>
            <label>{d.mode === 'model' ? 'ملف الموديل (.glb)' : 'صورة السجادة (من فوق، مقصوصة على حوافها)'}
              <input type="file" accept={d.mode === 'model' ? '.glb,model/gltf-binary' : 'image/*'} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <div className="row3">
              <label>العرض (سم)<input type="number" min={3} value={d.wcm} onChange={(e) => set('wcm', +e.target.value)} /></label>
              <label>العمق (سم)<input type="number" min={3} value={d.dcm} onChange={(e) => set('dcm', +e.target.value)} /></label>
              {d.mode === 'model' && <label>الارتفاع (سم)<input type="number" min={3} value={d.hcm} onChange={(e) => set('hcm', +e.target.value)} /></label>}
            </div>
            {nat && d.mode === 'model' && (
              <p className="adm-note">
                مقاسات الموديل الأصلية: {nat.map((v) => Math.round(v * 100)).join(' × ')} (عرض × ارتفاع × عمق، لو الموديل بالمتر).{' '}
                <button className="cta ghost" style={{ width: 'auto', padding: '2px 10px' }} onClick={useNat}>استخدمها</button>
              </p>
            )}
            {d.mode === 'model' && (
              <div className="row2">
                <label>تدوير الموديل (لو وشه مش للأمام)
                  <select value={d.modelRot} onChange={(e) => set('modelRot', +e.target.value)}>
                    <option value={0}>0°</option><option value={Math.PI / 2}>90°</option><option value={Math.PI}>180°</option><option value={-Math.PI / 2}>270°</option>
                  </select>
                </label>
                <label>التحجيم
                  <select value={d.fit} onChange={(e) => set('fit', e.target.value as 'stretch' | 'contain')}>
                    <option value="stretch">على المقاسات بالظبط</option>
                    <option value="contain">حافظ على النسب</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div>
            <label>الغرف المناسبة</label>
            <div className="seg2">
              {ROOM_TYPES.map((t) => <button key={t} className={d.rooms.includes(t) ? 'on' : ''} onClick={() => toggleRoom(t)}>{TYPE_NAMES[t]}</button>)}
            </div>
            <label>بديلة لقطعة أساسية في الفرش التلقائي
              <select value={d.role} onChange={(e) => set('role', e.target.value)}>
                <option value="">بدون (بتظهر في قايمة الإضافة بس)</option>
                {baseKinds.map((k) => <option key={k} value={k}>{BASE[k].name}</option>)}
              </select>
            </label>
            {d.role && <label className="chk"><input type="checkbox" checked={d.pref} onChange={(e) => set('pref', e.target.checked)} /> استخدمها في الفرش التلقائي بدل الأساسية</label>}
            {d.mode === 'model' && (
              <>
                <label className="chk"><input type="checkbox" checked={d.wall} onChange={(e) => set('wall', e.target.checked)} /> بتلتصق بالحيطة (ضهرها على الحيطة)</label>
                <label className="chk"><input type="checkbox" checked={d.acc} onChange={(e) => set('acc', e.target.checked)} /> إكسسوار (بيتحط على أسطح)</label>
                {!d.acc && <label className="chk"><input type="checkbox" checked={d.surfOn} onChange={(e) => set('surfOn', e.target.checked)} /> فوقها سطح يستقبل إكسسوارات (ترابيزة، كونسول)</label>}
                <label>الألوان
                  <select value={d.colorRole} onChange={(e) => set('colorRole', e.target.value as ColorRole)}>
                    <option value="none">من غير ألوان بديلة</option>
                    <option value="fabric">القماش يتلوّن</option>
                    <option value="wood">الخشب يتلوّن</option>
                  </select>
                </label>
                {d.colorRole !== 'none' && (
                  <>
                    <label>اسم الخامة اللي تتلوّن جوه الموديل (جزء من الاسم، فاضي = كل الخامات)
                      <input value={d.matMatch} placeholder="مثلاً fabric" onChange={(e) => set('matMatch', e.target.value)} />
                    </label>
                    <label>ألوان العميل (فاضي = ألوان الموقع العامة)</label>
                    {d.colors.map((c, i) => (
                      <div className="row-g" key={i}>
                        <input value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} />
                        <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} />
                        <button className="x" onClick={() => set('colors', d.colors.filter((_, k) => k !== i))}>×</button>
                      </div>
                    ))}
                    <button className="cta ghost" style={{ marginTop: 6 }} onClick={() => set('colors', [...d.colors, { name: 'لون ' + (d.colors.length + 1), hex: '#8C9096' }])}>+ لون</button>
                  </>
                )}
              </>
            )}
            <label>السعر للقطعة (اقتصادي / متوسط / فاخر)</label>
            <div className="row3">
              {[0, 1, 2].map((i) => <input key={i} type="number" min={0} value={d.price[i]} onChange={(e) => setPrice(i, +e.target.value)} />)}
            </div>
          </div>

          <div>
            <label>معاينة (اسحب للف، وعجلة الماوس للتقريب)</label>
            <FurnPreview def={def} ver={ver} color={pcolor} />
            {d.colorRole !== 'none' && d.mode === 'model' && <label className="pick">لون المعاينة <input type="color" value={pcolor ?? '#8C9096'} onChange={(e) => setPcolor(e.target.value)} /></label>}
          </div>
        </div>
        {msg && <p className="msg">{msg}</p>}
        <div className="btn-row">
          <button className="cta" onClick={save}>{editing ? 'حفظ التعديلات' : 'إضافة القطعة'}</button>
          {editing && <button className="cta ghost" onClick={reset}>إلغاء</button>}
        </div>
      </section>

      <section className="adm-box">
        <h3>القطع المضافة ({customs.length})</h3>
        {customs.length === 0 && <p className="adm-note">لسه ما أضفتش قطع.</p>}
        {customs.map((m) => (
          <div className="fadm-row" key={m.kind}>
            <label className="chk"><input type="checkbox" checked={!st.hidden.includes(m.kind)} onChange={(e) => { setHidden(m.kind, !e.target.checked); bump() }} /> ظاهرة</label>
            <b>{m.name}</b>
            <small>{Math.round(m.w * 100)}×{Math.round(m.d * 100)}×{Math.round(m.h * 100)} سم • {m.rooms.map((r) => TYPE_NAMES[r]).join('، ')}{m.role ? ' • بديلة: ' + BASE[m.role]?.name : ''}{m.role && PREF[m.role] === m.kind ? ' (الافتراضية)' : ''}</small>
            <button className="cta ghost" onClick={() => edit(m)}>تعديل</button>
            <button className="cta ghost" onClick={() => del(m)}>حذف</button>
          </div>
        ))}
      </section>

      <section className="adm-box">
        <h3>القطع الأساسية (تعديل الاسم والسعر والمقاس والإخفاء)</h3>
        {baseKinds.map((k) => {
          const m = FURN[k]
          return (
            <div className="fadm-row" key={k}>
              <label className="chk"><input type="checkbox" checked={!st.hidden.includes(k)} onChange={(e) => { setHidden(k, !e.target.checked); bump() }} /> ظاهرة</label>
              <input className="nm" defaultValue={m.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) { setOver(k, { name: v }); bump() } }} />
              {[0, 1, 2].map((i) => <input key={i} type="number" className="pr" defaultValue={m.price[i]} onBlur={(e) => overPrice(k, i, +e.target.value)} />)}
              <input type="number" className="pr" title="العرض سم" defaultValue={Math.round(m.w * 100)} onBlur={(e) => { setOver(k, { w: +e.target.value / 100 }); bump() }} />
              <input type="number" className="pr" title="العمق سم" defaultValue={Math.round(m.d * 100)} onBlur={(e) => { setOver(k, { d: +e.target.value / 100 }); bump() }} />
              <input type="number" className="pr" title="الارتفاع سم" defaultValue={Math.round(m.h * 100)} onBlur={(e) => { setOver(k, { h: +e.target.value / 100 }); bump() }} />
            </div>
          )
        })}
        <p className="adm-note">الأعمدة: السعر (اقتصادي / متوسط / فاخر) ثم العرض والعمق والارتفاع بالسنتي. القطع الأساسية بتاخد موديلها من public/models/furniture لو موجود.</p>
      </section>
    </main>
  )
}