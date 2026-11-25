import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { go } from '../router'
import { session } from '../state'
import { BUDGETS } from '../data/options'
import { fmt, grandTotal } from '../data/pricing'
import { roomPbrUrls } from '../data/pbrMap'
import { setFinish } from '../apartment'
import type { Side } from '../apartment'
import type { FloorConfig } from '../data/catalog'
import type { WallConfig } from '../data/wallCatalog'
import type { CeilingConfig } from '../data/ceilingCatalog'
import CustomizePanel from '../components/CustomizePanel'
import { getRooms } from '../rooms'
import { buildRoom } from '../three/buildRoom'
import { DOOR_GLB, HDR_URL, OUTDOOR_JPG, getGlb, hasTex, loadHdr, preload, preloadGlb } from '../three/assets'
import LightingBar from '../components/LightingBar'
import { DEFAULT_LIGHTING } from '../data/lighting'
import type { Lighting } from '../data/lighting'
import { getSky, loadSky } from '../three/sky'
import { configureRenderer, finalizeScene } from '../three/render'
import { fx, fxBegin, fxEnd, fxMove } from '../three/furnDrag'
import { FURN } from '../furniture'
// لما تدخل غرفة من باب، بتبص ناحية جوه الغرفة (عكس الحيطة اللي فيها الباب)
const FACE: Record<Side, number> = { N: Math.PI, S: 0, W: -Math.PI / 2, E: Math.PI / 2 }

interface GL {
  r: THREE.WebGLRenderer; cam: THREE.PerspectiveCamera; scene: THREE.Scene | null; hot: THREE.Sprite[]
  env: THREE.Texture; pm: THREE.PMREMGenerator; aniso: number
}

export default function Viewer() {
  const rooms = getRooms()
  const mount = useRef<HTMLDivElement>(null)
  const gl = useRef<GL | null>(null)
  const view = useRef({ yaw: 0, pit: 0, fov: 80 })
  const [cur, setCur] = useState(() => (rooms.find((r) => r.type === 'living') ?? rooms[0]).id)
  const curRef = useRef(cur)
  const [hint, setHint] = useState(true)
  const [ver, setVer] = useState(0)   // بيزيد كل ما التشطيب أو البيئة تتغير عشان المشهد يتبني من جديد
  const [, setTick] = useState(0)     // بيعيد رسم اللوحة بعد تحميل الخامات الحقيقية
  const [lt, setLt] = useState<Lighting>(DEFAULT_LIGHTING) // إعدادات الإضاءة

  const draw = () => {
    const g = gl.current; if (!g || !g.scene) return
    const v = view.current
    g.cam.rotation.set(v.pit, v.yaw, 0, 'YXZ'); g.cam.fov = v.fov; g.cam.updateProjectionMatrix()
    g.r.render(g.scene, g.cam)
  }

  // 1) إنشاء الـrenderer مرة واحدة + الظلال + بيئة الإضاءة + التحكم بالسحب
  useEffect(() => {
    const el = mount.current!
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    configureRenderer(r)
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.setPixelRatio(Math.min(devicePixelRatio, 2))
    const cam = new THREE.PerspectiveCamera(80, 1, 0.05, 100); cam.position.set(0, 1.6, 0)
    const pm = new THREE.PMREMGenerator(r)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    el.appendChild(r.domElement)
    gl.current = { r, cam, scene: null, hot: [], env, pm, aniso: Math.min(8, r.capabilities.getMaxAnisotropy()) }
    let dead = false

    // لو حطيت public/hdri/room.hdr بيتفعّل كبيئة إضاءة وانعكاسات
    loadHdr(HDR_URL).then((t) => {
      if (!t || dead || !gl.current) return
      t.mapping = THREE.EquirectangularReflectionMapping
      gl.current.env = gl.current.pm.fromEquirectangular(t).texture
      t.dispose()
      setVer((v) => v + 1)
    })

    const fit = () => { const w = el.clientWidth, h = Math.round(Math.min(640, Math.max(380, w * 0.58))); r.setSize(w, h); cam.aspect = w / h; draw() }
    fit(); const ro = new ResizeObserver(fit); ro.observe(el)

    const cv = r.domElement; cv.style.touchAction = 'none'
    let last: [number, number] | null = null, moved = 0
    fx.draw = draw; fx.commit = () => setVer((v) => v + 1); fx.onSelect = () => setTick((t) => t + 1)
    cv.onpointerdown = (e) => {
      setHint(false)
      if (fxBegin(e, cv, cam)) { cv.setPointerCapture(e.pointerId); return } // ضغطت على قطعة فرش: هتتحرك
      last = [e.clientX, e.clientY]; moved = 0; cv.setPointerCapture(e.pointerId)
    }
    cv.onpointermove = (e) => {
      if (fxMove(e, cv, cam)) return
      if (!last) return
      const dx = e.clientX - last[0], dy = e.clientY - last[1]; moved += Math.abs(dx) + Math.abs(dy); last = [e.clientX, e.clientY]
      const v = view.current, k = v.fov / 80
      v.yaw -= dx * 0.005 * k; v.pit = Math.max(-1.3, Math.min(1.3, v.pit - dy * 0.004 * k)); draw()
    }
    cv.onpointerup = (e) => {
      if (fxEnd()) { last = null; return }
      last = null
      if (moved > 6) return
      const b = cv.getBoundingClientRect(), g = gl.current!, rc = new THREE.Raycaster()
      rc.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), g.cam)
      const hit = rc.intersectObjects(g.hot)[0]
      if (!hit) return
      const to = hit.object.userData.to as number
      const dest = getRooms().find((x) => x.id === to)
      if (!dest) return
      const back = dest.openings.find((o) => (o.kind === 'door' || o.kind === 'pass') && o.to === curRef.current)
      view.current.yaw = back ? FACE[back.side] : 0; view.current.pit = 0
      setCur(to)
    }
    cv.onwheel = (ev) => { ev.preventDefault(); view.current.fov = Math.min(95, Math.max(40, view.current.fov + ev.deltaY * 0.05)); draw() }
    return () => { dead = true; ro.disconnect(); pm.dispose(); r.dispose(); el.removeChild(r.domElement) }
  }, [])

  // 2) بناء مشهد الغرفة فوراً بالخامات المتاحة، وبعدين تحميل الخامات الحقيقية وإعادة البناء لو وصلت
  useEffect(() => {
    curRef.current = cur
    let dead = false
    const room = rooms.find((x) => x.id === cur)!
    const g = gl.current!
        const build = () => {
      const sky = lt.window === 'open' ? getSky(lt.time) : null // بانوراما حقيقية لو الملف موجود
      const b = buildRoom(room, rooms, sky ? sky.env : g.env, g.aniso, lt, sky ? sky.pano : null)
      finalizeScene(b.scene)
      g.scene = b.scene; g.hot = b.hotspots; draw()
    }
    build()
        if (lt.window === 'open' && !getSky(lt.time)) loadSky(lt.time, g.pm).then((s) => { if (s && !dead) build() })
    const urls = [...roomPbrUrls(room), OUTDOOR_JPG]
    const before = urls.filter(hasTex).length
    const fg = Array.from(new Set(rooms.flatMap((r) => r.furniture.map((i) => FURN[i.kind]?.glb ?? '')))).filter((u) => u && !u.startsWith('custom:'))
    Promise.all([preload(urls), preloadGlb(DOOR_GLB), ...fg.map(preloadGlb)]).then(() => {
      if (dead) return
      if (urls.filter(hasTex).length !== before || getGlb(DOOR_GLB) || fg.some((u) => getGlb(u))) { build(); setTick((t) => t + 1) }
    })
    return () => { dead = true }
  }, [cur, ver, lt])

  // 3) نبض هادي لعلامات الانتقال
  useEffect(() => {
    let raf = 0
    const loop = (t: number) => {
      const g = gl.current
      if (g && g.scene && g.hot.length) {
        const s = 1 + 0.07 * Math.sin(t / 450)
        g.hot.forEach((h) => h.scale.set(0.34 * s, 0.425 * s, 1))
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const room = rooms.find((x) => x.id === cur) ?? rooms[0]
  const setFloor = (c: FloorConfig) => { setFinish(session.apt, room, { floor: c }); setVer((v) => v + 1) }
  const setWall = (w: WallConfig) => { setFinish(session.apt, room, { wall: w }); setVer((v) => v + 1) }
  const setCeiling = (c: CeilingConfig) => { setFinish(session.apt, room, { ceiling: c }); setVer((v) => v + 1) }
  const jump = (id: number) => { view.current.yaw = 0; view.current.pit = 0; setCur(id) }

  const budget = BUDGETS.find((b) => b.id === session.budget)!
  return (
    <main className="viewer-page">
      <div className="viewer-bar">
        <span className="here">أنت الآن في: <b>{room.name}</b> ({room.w.toFixed(1)}×{room.d.toFixed(1)} م)</span>
        <span className="stage-pill">المرحلة ٣: التشطيب والفرش (معاينة 360° تفاعلية)</span>
        <span className="cost-box">التكلفة التقديرية ({budget.label}): <b>{fmt(grandTotal(rooms, session.budget))}</b> ج.م</span>
        <button className="ghost-btn" onClick={() => go('summary')}>تفاصيل الميزانية</button>
      </div>
      <div className="viewer-grid">
                <CustomizePanel room={room} budget={session.budget} onFloor={setFloor} onWall={setWall} onCeiling={setCeiling} onFurn={() => setVer((v) => v + 1)} />
        <div className="viewer-main">
          <div className="room-chips">
            {rooms.map((r) => <button key={r.id} className={r.id === cur ? 'on' : ''} onClick={() => jump(r.id)}>{r.name}</button>)}
          </div>
              <LightingBar value={lt} hasWindow={room.openings.some((o) => o.kind === 'window')} onChange={setLt} />
          <div className="gl-wrap">
            <div ref={mount} />
            {hint && <div className="gl-badge"><b>360°</b>اسحب للالتفاف</div>}
            <div className="gl-tip">اضغط على أيقونات الأبواب للتنقل بين الغرف | اسحب لرؤية الغرفة كاملة</div>
          </div>
        </div>
      </div>
    </main>
  )
}