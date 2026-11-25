import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { FurnDef } from '../furniture'
import { furnModel } from '../data/furnStore'
import { buildItem } from '../three/furniture3d'
import { RENDER, configureRenderer } from '../three/render'

interface St {
  r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera
  group: THREE.Group | null; yaw: number; pit: number; dist: number; th: number; raf: number; drag: boolean
}

// معاينة 3D للقطعة: بتلف لوحدها، وتقدر تسحبها بالماوس
export default function FurnPreview({ def, ver, color }: { def: FurnDef; ver: number; color?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const st = useRef<St | null>(null)

  useEffect(() => {
    const el = host.current!, H = 300
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
    sun.position.set(2, 4, 3); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 })
    scene.add(sun)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: '#d8d3ca', roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
    const cam = new THREE.PerspectiveCamera(40, el.clientWidth / H, 0.05, 60)
    const S: St = { r, scene, cam, group: null, yaw: 0.6, pit: 0.35, dist: 3, th: 0.5, raf: 0, drag: false }
    st.current = S

    let last: [number, number] | null = null
    r.domElement.style.touchAction = 'none'
    r.domElement.onpointerdown = (e) => { last = [e.clientX, e.clientY]; S.drag = true; r.domElement.setPointerCapture(e.pointerId) }
    r.domElement.onpointermove = (e) => {
      if (!last) return
      S.yaw -= (e.clientX - last[0]) * 0.01
      S.pit = Math.max(0.05, Math.min(1.3, S.pit + (e.clientY - last[1]) * 0.008))
      last = [e.clientX, e.clientY]
    }
    r.domElement.onpointerup = () => { last = null; S.drag = false }
    r.domElement.onwheel = (e) => { e.preventDefault(); S.dist = Math.max(0.6, Math.min(12, S.dist * (1 + e.deltaY * 0.001))) }

    const tick = () => {
      if (!S.drag) S.yaw += 0.006
      cam.position.set(Math.sin(S.yaw) * Math.cos(S.pit) * S.dist, S.th + Math.sin(S.pit) * S.dist, Math.cos(S.yaw) * Math.cos(S.pit) * S.dist)
      cam.lookAt(0, S.th, 0)
      r.render(scene, cam)
      S.raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(S.raf); r.dispose(); el.removeChild(r.domElement); st.current = null }
  }, [])

  const key = JSON.stringify(def) + '|' + ver + '|' + (color ?? '')
  useEffect(() => {
    const S = st.current
    if (!S) return
    if (S.group) S.scene.remove(S.group)
    const it = { id: 0, kind: def.kind, x: 0, z: 0, rot: 0, y: 0, color }
    const g = buildItem(it, def, { fabric: '#CDBFA6', wood: '#A9784F', aniso: 4 }, furnModel(def))
    S.scene.add(g); S.group = g
    S.dist = Math.max(def.w, def.d, def.h) * 2.4 + 0.4
    S.th = def.h / 2
  }, [key])

  return <div ref={host} className="fprev" />
}