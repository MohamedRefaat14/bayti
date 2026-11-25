import { useEffect, useReducer, useState } from 'react'
import { go } from '../router'
import { session } from '../state'
import PlanSvg from '../components/PlanSvg'
import {
  SHAPE_NAMES, SIDE_NAMES, TYPE_NAMES, addDefaultOpening, addWish, analyze, autoOpenings, bounds, buildViews, builtArea,
  moveRoom, moveWall, placeBeside, removeOpening, removeRoom, removeWish, resizeRoom, setArea, setBlind, setFootprint,
  setHeight, setKitchen, setMode, setRatio, setTemplate, swapRooms, updateOpening, updateRoomInfo, updateWish, setWalls,
} from '../apartment'
import type { RoomType, ShapeId, Side } from '../apartment'
import { TEMPLATES, suggest, tplById } from '../templates'
import type { KitchenMode } from '../templates'
import { addColumn, removeColumn, updateColumn } from '../columns'

// حقل رقم بيطبّق القيمة لما تخرج منه أو تضغط Enter (عشان الكتابة متتقطعش)
function Num({ value, onCommit, step = 0.1 }: { value: number; onCommit: (v: number) => void; step?: number }) {
  const [t, setT] = useState(String(value))
  useEffect(() => { setT(String(value)) }, [value])
  const commit = () => {
    const v = parseFloat(t)
    if (isFinite(v)) onCommit(v); else setT(String(value))
  }
  return (
    <input
      type="number" step={step} value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

const STEP_NAMES = ['', '١ النموذج والغرف', '٢ الأبعاد والترتيب', '٣ الفتحات والأعمدة']
const TYPES = Object.keys(TYPE_NAMES) as RoomType[]
const typeOpts = (all: boolean) => TYPES.filter((t) => all || t !== 'hall').map((t) => <option key={t} value={t}>{TYPE_NAMES[t]}</option>)
const sideOpts = (Object.keys(SIDE_NAMES) as Side[]).map((s) => <option key={s} value={s}>{SIDE_NAMES[s]}</option>)
const FRONT_OPTS: [Side, string][] = [['S', 'تحت'], ['N', 'فوق'], ['W', 'يسار'], ['E', 'يمين']]
const WHERE: [Side, string][] = [['E', 'على يمين'], ['W', 'على يسار'], ['N', 'فوق'], ['S', 'تحت']]
const KITCHENS: [KitchenMode, string][] = [['closed', 'مقفول (باب)'], ['bar', 'بار رخام (نصف مفتوح)'], ['open', 'أمريكان (مفتوح + جزيرة)']]
const round2 = (v: number) => Math.round(v * 100) / 100

export default function Plan() {
  const a = session.apt
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [sel, setSel] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [newType, setNewType] = useState<RoomType>('bed')
  const [absorb, setAbsorb] = useState(true)
  const [nudge, setNudge] = useState(0.25)
  const [snapT, setSnapT] = useState<number | ''>('')
  const [snapW, setSnapW] = useState<Side>('E')
  const [snapA, setSnapA] = useState<'start' | 'center' | 'end'>('start')
  const [wantBeds, setWantBeds] = useState(() => tplById(a.tpl).beds)
  const [showAll, setShowAll] = useState(false)

  const views = buildViews(a, session.style)
  const cur = a.rooms.find((r) => r.id === sel) ?? null
  const ops = cur ? a.openings.filter((o) => o.roomId === cur.id) : []
  const rep = analyze(a)
  const bb = bounds(a.rooms)
  const total = builtArea(a.rooms)
  const tpl = tplById(a.tpl)
  const list = showAll ? suggest(a.area, wantBeds) : suggest(a.area, wantBeds).slice(0, 3)

  // بينفّذ تعديل، وبيعرض رسالة لو فيه، وبيحدّث الصفحة
  const act = (fn: () => string | null | void) => {
    const e = fn()
    setMsg(typeof e === 'string' ? e : '')
    bump()
  }
  const dirs = (dx: number, dy: number) => cur && act(() => moveRoom(a, cur.id, dx, dy))
  const kindName = (k: string) => (k === 'door' ? 'باب' : k === 'window' ? 'شباك' : 'فتحة مفتوحة')

  return (
    <main className="container plan-page">
      <div className="plan-grid">
        <aside className="plan-form">
          <div className="steps">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={step === n ? 'on' : ''} onClick={() => { setStep(n); setMsg('') }}>{STEP_NAMES[n]}</button>
            ))}
          </div>

          {step === 1 && (
            <>
              <div className="seg2">
                <button className={a.mode === 'template' ? 'on' : ''} onClick={() => act(() => setMode(a, 'template'))}>نموذج جاهز</button>
                <button className={a.mode === 'custom' ? 'on' : ''} onClick={() => act(() => setMode(a, 'custom'))}>شكل مخصص</button>
              </div>

              {a.mode === 'template' && (
                <>
                  <h3>اختار مساحة شقتك</h3>
                  <label>المساحة الكلية (م²)<Num value={a.area} step={5} onCommit={(v) => act(() => setArea(a, v))} /></label>
                  <input type="range" min={60} max={380} step={5} value={a.area} onChange={(e) => act(() => setArea(a, +e.target.value))} />
                  <label>عدد غرف النوم
                    <select value={wantBeds} onChange={(e) => setWantBeds(+e.target.value)}>
                      {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} غرف</option>)}
                    </select>
                  </label>

                  <h4>النماذج المقترحة</h4>
                  <div className="tplist">
                    {list.map((t) => (
                      <button key={t.id} className={'tpl' + (a.tpl === t.id ? ' on' : '')} onClick={() => act(() => setTemplate(a, t.id))}>
                        <b>{t.name}</b>
                        <small>{t.min}–{t.max} م² • {t.beds} غرف نوم • {t.baths} حمامات</small>
                        <small>{t.desc}</small>
                      </button>
                    ))}
                  </div>
                  <button className="cta ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'عرض الأنسب بس' : `عرض كل النماذج (${TEMPLATES.length})`}</button>

                  <h4>تفاصيل التصميم</h4>
                  <label>المطبخ</label>
                  <div className="seg2">
                    {KITCHENS.map(([k, n]) => <button key={k} className={a.kitchen === k ? 'on' : ''} onClick={() => act(() => setKitchen(a, k))}>{n}</button>)}
                  </div>
                  <div className="row2">
                    <label>الشارع في ناحية
                      <select value={a.front} onChange={(e) => act(() => setFootprint(a, { front: e.target.value as Side }))}>
                        {FRONT_OPTS.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
                      </select>
                    </label>
                    <label>ارتفاع السقف (م)<Num value={a.height} step={0.05} onCommit={(v) => act(() => setHeight(a, v))} /></label>
                  </div>
                                    <div className="row2">
                    <label>سمك الحيطة الخارجية (سم)<Num value={Math.round(a.wallExt * 100)} step={1} onCommit={(v) => act(() => setWalls(a, v / 100, a.wallInt))} /></label>
                    <label>سمك الحيطة الداخلية (سم)<Num value={Math.round(a.wallInt * 100)} step={1} onCommit={(v) => act(() => setWalls(a, a.wallExt, v / 100))} /></label>
                  </div>
                  <label>شكل الشقة (عرض ÷ عمق): {a.ratio.toFixed(2)}</label>
                  <input type="range" min={tpl.rmin} max={tpl.rmax} step={0.05} value={a.ratio} onChange={(e) => act(() => setRatio(a, +e.target.value))} />
                  <label className="chk2"><input type="checkbox" checked={a.blind} onChange={(e) => act(() => setBlind(a, e.target.checked))} /> الجانبين ملاصقين لعمارات (من غير شبابيك)</label>
                  <p className="stat">{tpl.name}: المساحة <b>{total.toFixed(0)}</b> م² | الإطار <b>{(bb.x1 - bb.x0).toFixed(1)}×{(bb.y1 - bb.y0).toFixed(1)}</b> م</p>
                  <p className="hint">أي تغيير هنا بيعيد التوزيع، وبيمسح تعديلات الخطوة ٢ و٣. لما التوزيع يعجبك كمّل للخطوة اللي بعدها لتعديل الأبعاد وتحريك الحيطان.</p>
                </>
              )}

              {a.mode === 'custom' && (
                <>
                  <h3>شكل الشقة</h3>
                  <div className="seg2">
                    {(Object.keys(SHAPE_NAMES) as ShapeId[]).map((s) => (
                      <button key={s} className={a.shape === s ? 'on' : ''} onClick={() => act(() => setFootprint(a, { shape: s }))}>{SHAPE_NAMES[s]}</button>
                    ))}
                  </div>
                  <div className="row2">
                    <label>{a.shape === 'square' ? 'ضلع المربع (م)' : 'عرض الواجهة (م)'}<Num value={a.width} onCommit={(v) => act(() => setFootprint(a, { width: v }))} /></label>
                    {a.shape !== 'square' && <label>العمق (م)<Num value={a.length} onCommit={(v) => act(() => setFootprint(a, { length: v }))} /></label>}
                  </div>
                  {(a.shape === 'L' || a.shape === 'U') && (
                    <>
                      <div className="row2">
                        <label>{a.shape === 'L' ? 'عرض الجزء الناقص (م)' : 'عرض الفتحة (م)'}<Num value={a.notchW} onCommit={(v) => act(() => setFootprint(a, { notchW: v }))} /></label>
                        <label>{a.shape === 'L' ? 'عمق الجزء الناقص (م)' : 'عمق الفتحة (م)'}<Num value={a.notchD} onCommit={(v) => act(() => setFootprint(a, { notchD: v }))} /></label>
                      </div>
                      {a.shape === 'L' && (
                        <label className="chk2"><input type="checkbox" checked={a.mirror} onChange={(e) => act(() => setFootprint(a, { mirror: e.target.checked }))} /> اقلب الجزء الناقص على الناحية التانية</label>
                      )}
                    </>
                  )}
                  <div className="row2">
                    <label>الشارع في ناحية
                      <select value={a.front} onChange={(e) => act(() => setFootprint(a, { front: e.target.value as Side }))}>
                        {FRONT_OPTS.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
                      </select>
                    </label>
                    <label>ارتفاع السقف (م)<Num value={a.height} step={0.05} onCommit={(v) => act(() => setHeight(a, v))} /></label>
                  </div>

                  <div className="row2">
                    <label>سمك الحيطة الخارجية (سم)<Num value={Math.round(a.wallExt * 100)} step={1} onCommit={(v) => act(() => setWalls(a, v / 100, a.wallInt))} /></label>
                    <label>سمك الحيطة الداخلية (سم)<Num value={Math.round(a.wallInt * 100)} step={1} onCommit={(v) => act(() => setWalls(a, a.wallExt, v / 100))} /></label>
                  </div>
                  <h4>الغرف المطلوبة</h4>
                  <div className="rhead"><span>الاسم</span><span>النوع</span><span>العرض</span><span>الطول</span><span /></div>
                  {a.wishes.map((w) => (
                    <div className="rrow2" key={w.id}>
                      <input value={w.name} onChange={(e) => act(() => updateWish(a, w.id, { name: e.target.value }))} />
                      <select value={w.type} onChange={(e) => act(() => updateWish(a, w.id, { type: e.target.value as RoomType }))}>{typeOpts(false)}</select>
                      <Num value={w.w} onCommit={(v) => act(() => updateWish(a, w.id, { w: v }))} />
                      <Num value={w.d} onCommit={(v) => act(() => updateWish(a, w.id, { d: v }))} />
                      <button className="x" aria-label="حذف" onClick={() => act(() => removeWish(a, w.id))}>×</button>
                    </div>
                  ))}
                  <div className="add-row">
                    <select value={newType} onChange={(e) => setNewType(e.target.value as RoomType)}>{typeOpts(false)}</select>
                    <button className="cta" onClick={() => act(() => addWish(a, newType))}>+ إضافة غرفة</button>
                  </div>
                  <p className="stat">المساحة المبنية <b>{total.toFixed(0)}</b> م² | الإطار <b>{(bb.x1 - bb.x0).toFixed(1)}×{(bb.y1 - bb.y0).toFixed(1)}</b> م</p>
                  {rep.fit && <p className="warn">{rep.fit}</p>}
                  <p className="hint">أي تغيير هنا بيعيد توزيع الشقة، وبيمسح تعديلات الخطوة ٢ و٣.</p>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h3>الأبعاد والترتيب</h3>
              <label>الغرفة
                <select value={sel ?? ''} onChange={(e) => { setSel(e.target.value === '' ? null : +e.target.value); setMsg('') }}>
                  <option value="">اختار غرفة (أو اضغط عليها في المخطط)</option>
                  {a.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              {cur ? (
                <>
                  <label>الاسم<input value={cur.name} onChange={(e) => act(() => updateRoomInfo(a, cur.id, { name: e.target.value }))} /></label>
                  <label>النوع
                    <select value={cur.type} onChange={(e) => act(() => updateRoomInfo(a, cur.id, { type: e.target.value as RoomType }))}>{typeOpts(true)}</select>
                  </label>
                  <div className="row2">
                    <label>العرض (م)<Num value={round2(cur.w)} onCommit={(v) => act(() => resizeRoom(a, cur.id, v, cur.d, absorb))} /></label>
                    <label>الطول (م)<Num value={round2(cur.d)} onCommit={(v) => act(() => resizeRoom(a, cur.id, cur.w, v, absorb))} /></label>
                  </div>
                  <label className="chk2"><input type="checkbox" checked={absorb} onChange={(e) => setAbsorb(e.target.checked)} /> عدّل الغرف المجاورة تلقائي (من غير فراغات)</label>

                  <label>خطوة التحريك
                    <select value={nudge} onChange={(e) => setNudge(+e.target.value)}>
                      {[0.05, 0.1, 0.25, 0.5, 1].map((v) => <option key={v} value={v}>{v} م</option>)}
                    </select>
                  </label>

                  <h4>حرّك الحيطة</h4>
                  {(['N', 'E', 'S', 'W'] as Side[]).map((s) => (
                    <div className="wallrow" key={s}>
                      <span>حيطة {SIDE_NAMES[s]}</span>
                      <button onClick={() => act(() => moveWall(a, cur.id, s, -nudge))}>تصغير</button>
                      <button onClick={() => act(() => moveWall(a, cur.id, s, nudge))}>تكبير</button>
                    </div>
                  ))}
                  <p className="hint">تكبير الغرفة من ناحية حيطة بيصغّر الغرفة اللي ملاصقة للحيطة دي بنفس القدر.</p>

                  <h4>تحريك الغرفة</h4>
                  <div className="nudge">
                    <button style={{ gridColumn: 2, gridRow: 1 }} onClick={() => dirs(0, -nudge)} aria-label="فوق">▲</button>
                    <button style={{ gridColumn: 1, gridRow: 2 }} onClick={() => dirs(-nudge, 0)} aria-label="يسار">◀</button>
                    <button style={{ gridColumn: 3, gridRow: 2 }} onClick={() => dirs(nudge, 0)} aria-label="يمين">▶</button>
                    <button style={{ gridColumn: 2, gridRow: 3 }} onClick={() => dirs(0, nudge)} aria-label="تحت">▼</button>
                  </div>

                  <h4>ألصق الغرفة بغرفة تانية</h4>
                  <div className="row2">
                    <select value={snapT} onChange={(e) => setSnapT(e.target.value === '' ? '' : +e.target.value)}>
                      <option value="">اختار غرفة</option>
                      {a.rooms.filter((r) => r.id !== cur.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={snapW} onChange={(e) => setSnapW(e.target.value as Side)}>
                      {WHERE.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
                    </select>
                  </div>
                  <div className="row2">
                    <select value={snapA} onChange={(e) => setSnapA(e.target.value as 'start' | 'center' | 'end')}>
                      <option value="start">من البداية</option><option value="center">في النص</option><option value="end">من النهاية</option>
                    </select>
                    <button className="cta ghost" onClick={() => snapT !== '' && act(() => placeBeside(a, cur.id, snapT, snapW, snapA))}>ألصق</button>
                  </div>

                  <label>بدّل مكانها مع
                    <select value="" onChange={(e) => { if (e.target.value) act(() => swapRooms(a, cur.id, +e.target.value)) }}>
                      <option value="">اختار غرفة</option>
                      {a.rooms.filter((r) => r.id !== cur.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  <button className="cta ghost" onClick={() => act(() => { const e = removeRoom(a, cur.id); if (!e) setSel(null); return e })}>حذف الغرفة دي</button>
                </>
              ) : (
                <p className="hint">اضغط على غرفة في المخطط، أو اختارها من القائمة. تقدر تغيّر أبعادها وتحرك حيطانها وتلصقها بغرفة تانية.</p>
              )}
              {rep.narrow.map((t) => <p className="warn" key={t}>{t}</p>)}
            </>
          )}

          {step === 3 && (
            <>
              <h3>الأبواب والشبابيك</h3>
              <label>الغرفة
                <select value={sel ?? ''} onChange={(e) => { setSel(e.target.value === '' ? null : +e.target.value); setMsg('') }}>
                  <option value="">اختار غرفة (أو اضغط عليها في المخطط)</option>
                  {a.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              {cur ? (
                <>
                  <p className="hint">البُعد بيتقاس من الركن اليسار للحيطتين فوق وتحت، ومن الركن العلوي للحيطتين يمين ويسار. الشباك لازم يكون على جزء خارجي من الحيطة، والباب على حيطة مشتركة مع غرفة. الأبواب اللي جاية من الغرف المجاورة بتتعدل من الغرفة التانية.</p>
                  {ops.length === 0 && <p className="hint">مفيش أبواب أو شبابيك متسجلة على الغرفة دي.</p>}
                  {ops.map((o) => (
                    <div className="op" key={o.id}>
                      <div className="op-head"><b>{kindName(o.kind)}</b><button className="x" aria-label="حذف" onClick={() => act(() => removeOpening(a, o.id))}>×</button></div>
                      <label>الحيطة
                        <select value={o.side} onChange={(e) => act(() => updateOpening(a, o.id, { side: e.target.value as Side }))}>{sideOpts}</select>
                      </label>
                      <div className="row2">
                        <label>البُعد (م)<Num value={round2(o.offset)} onCommit={(v) => act(() => updateOpening(a, o.id, { offset: v }))} /></label>
                        <label>العرض (م)<Num value={o.width} onCommit={(v) => act(() => updateOpening(a, o.id, { width: v }))} /></label>
                      </div>
                      {o.kind === 'window' && (
                        <label>ارتفاع الجلسة عن الأرض (م)<Num value={o.sill} onCommit={(v) => act(() => updateOpening(a, o.id, { sill: v }))} /></label>
                      )}
                      {o.kind === 'pass' && (
                        <label>ارتفاع البار (م، 0 = فتحة من الأرض)<Num value={o.sill} onCommit={(v) => act(() => updateOpening(a, o.id, { sill: v }))} /></label>
                      )}
                    </div>
                  ))}
                  <div className="btn-row">
                    <button className="cta ghost" onClick={() => act(() => addDefaultOpening(a, cur.id, 'door'))}>+ باب</button>
                    <button className="cta ghost" onClick={() => act(() => addDefaultOpening(a, cur.id, 'window'))}>+ شباك</button>
                  </div>
                                    <h4>الأعمدة</h4>
                  <p className="hint">العمود بيبرز من الحيطة (غالباً 10 لـ25 سم). المقاسات بالسنتي، والبُعد بالمتر زي الفتحات. دهانه زي دهان الحيطة والوزرة بتلف حواليه.</p>
                  {a.columns.filter((c) => c.roomId === cur.id).map((c) => (
                    <div className="op" key={c.id}>
                      <div className="op-head"><b>عمود</b><button className="x" aria-label="حذف" onClick={() => act(() => removeColumn(a, c.id))}>×</button></div>
                      <label>الحيطة
                        <select value={c.side} onChange={(e) => act(() => updateColumn(a, c.id, { side: e.target.value as Side }))}>{sideOpts}</select>
                      </label>
                      <div className="row2">
                        <label>البُعد (م)<Num value={round2(c.offset)} onCommit={(v) => act(() => updateColumn(a, c.id, { offset: v }))} /></label>
                        <label>العرض (سم)<Num value={Math.round(c.w * 100)} step={5} onCommit={(v) => act(() => updateColumn(a, c.id, { w: v / 100 }))} /></label>
                      </div>
                      <label>البروز (سم)<Num value={Math.round(c.d * 100)} step={5} onCommit={(v) => act(() => updateColumn(a, c.id, { d: v / 100 }))} /></label>
                    </div>
                  ))}
                  <button className="cta ghost" onClick={() => act(() => addColumn(a, cur.id))}>+ عمود</button>
                </>
              ) : (
                <p className="hint">اختار غرفة عشان تعدّل أبوابها وشبابيكها.</p>
              )}
              <button className="cta ghost" style={{ marginTop: 12 }} onClick={() => act(() => { autoOpenings(a) })}>أعد توزيع كل الأبواب والشبابيك تلقائي</button>
              {[...rep.isolated, ...rep.noWindow].map((t) => <p className="warn" key={t}>{t}</p>)}
            </>
          )}

          {msg && <p className="msg">{msg}</p>}
          <div className="btn-row nav-row">
            {step > 1 && <button className="cta ghost" onClick={() => { setStep((step - 1) as 1 | 2); setMsg('') }}>السابق</button>}
            {step < 3
              ? <button className="cta" onClick={() => { setStep((step + 1) as 2 | 3); setMsg('') }}>التالي</button>
              : <button className="cta" onClick={() => go('style')}>التالي: الستايل ←</button>}
          </div>
        </aside>

        <section className="plan-board">
          <PlanSvg rooms={views} front={a.front} selId={sel} onSelect={(id) => { setSel(id); setMsg('') }} />
          <span className="chip">مخطط معماري مبدئي استرشادي</span>
        </section>
      </div>
    </main>
  )
}