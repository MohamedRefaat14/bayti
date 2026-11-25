import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { FrameDef } from '../openings'
import { buildPreview } from '../three/openings3d'
import { RENDER, configureRenderer } from '../three/render'

interface St { r: THREE.WebGLRenderer; scene: THREE.Scene; group: THREE.Group | null; yaw: number; pit: number; dist: number; ty: number; raf: number; drag: boolean }

// معاينة 3D لباب أو شباك داخل حيطة: بتلف لوحدها، وتقدر تسحبها
export default function OpeningPreview({ def, color, ver }: { def: FrameDef; color: string; ver: number }) {
  const host = useRef<HTMLDivElement>(null)
  const st = useRef<St | null>(null)

  useEffect(() => {
    const el = host.current!, H = 320
    const r = new THREE.WebGLRenderer({ antialias: true })
    configureRenderer(r)
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(el.clientWidth, H); r.shadowMap.enabled = true
    el.appendChild(r.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xe9edf2)
    const pm = new THREE.PMREMGenerator(r)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
    const k = RENDER.filmic ? RENDER.lightK : 1
    scene.add(new THREE.HemisphereLight(0xffffff, 0x99a0aa, 0.9 * k))
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.1 * k)
    sun.position.set(2, 4, 4); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 })
    scene.add(sun)
    const cam = new THREE.PerspectiveCamera(38, el.clientWidth / H, 0.05, 60)
    const S: St = { r, scene, group: null, yaw: 0.5, pit: 0.12, dist: 4, ty: 1.2, raf: 0, drag: false }
    st.current = S

    let last: [number, number] | null = null
    r.domElement.style.touchAction = 'none'
    r.domElement.onpointerdown = (e) => { last = [e.clientX, e.clientY]; S.drag = true; r.domElement.setPointerCapture(e.pointerId) }
    r.domElement.onpointermove = (e) => {
      if (!last) return
      S.yaw -= (e.clientX - last[0]) * 0.01
      S.pit = Math.max(-0.2, Math.min(0.9, S.pit + (e.clientY - last[1]) * 0.006))
      last = [e.clientX, e.clientY]
    }
    r.domElement.onpointerup = () => { last = null; S.drag = false }
    r.domElement.onwheel = (e) => { e.preventDefault(); S.dist = Math.max(1.2, Math.min(9, S.dist * (1 + e.deltaY * 0.001))) }
    const tick = () => {
      if (!S.drag) S.yaw = Math.max(-1.1, Math.min(1.1, S.yaw + Math.sin(performance.now() / 2200) * 0.002))
      cam.position.set(Math.sin(S.yaw) * Math.cos(S.pit) * S.dist, S.ty + Math.sin(S.pit) * S.dist, Math.cos(S.yaw) * Math.cos(S.pit) * S.dist)
      cam.lookAt(0, S.ty, 0)
      r.render(scene, cam)
      S.raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(S.raf); r.dispose(); el.removeChild(r.domElement); st.current = null }
  }, [])

  const key = JSON.stringify(def) + '|' + color + '|' + ver
  useEffect(() => {
    const S = st.current
    if (!S) return
    if (S.group) S.scene.remove(S.group)
    const g = buildPreview(def, color)
    S.scene.add(g); S.group = g
    S.ty = def.kind === 'door' ? 1.15 : 1.5
    S.dist = def.kind === 'door' ? 4.2 : 3.6
  }, [key])

  return <div ref={host} className="fprev" />
}