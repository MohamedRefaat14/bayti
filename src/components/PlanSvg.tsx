import { bounds, wallLine } from '../apartment'
import type { RoomView, Side } from '../apartment'

const COLORS: Record<string, string> = {
  bed: '#F4A6A6', bath: '#A9D3F0', living: '#A8E6A1', kitchen: '#A9C7F0', hall: '#F3DDA0', other: '#D9D9E3',
}

interface Props { rooms: RoomView[]; front: Side; selId: number | null; onSelect?: (id: number | null) => void }

export default function PlanSvg({ rooms, front, selId, onSelect }: Props) {
  const b = bounds(rooms)
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0
  const U = Math.min(620 / bw, 440 / bh) // بكسل لكل متر
  const m = 48
  const W = bw * U + 2 * m, H = bh * U + 2 * m
  const X = (x: number) => m + (x - b.x0) * U
  const Y = (y: number) => m + (y - b.y0) * U
  let bedIdx = 0
  const mx = (X(b.x0) + X(b.x1)) / 2, my = (Y(b.y0) + Y(b.y1)) / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} className="plan-svg" role="img" aria-label="المخطط المعماري">
      {rooms.map((r) => {
        if (r.type === 'bed') bedIdx++
        const x = X(r.x), y = Y(r.y), rw = r.w * U, rh = r.d * U
        const fill = r.type === 'bed' && bedIdx % 2 === 0 ? '#C9A6E8' : COLORS[r.type]
        const sel = r.id === selId
        const fs = Math.max(9, Math.min(16, Math.min(rw / 7.5, rh / 3)))
        return (
          <g key={r.id}>
            <rect
              x={x} y={y} width={rw} height={rh} fill={fill}
              stroke={sel ? '#1F5FBF' : '#172033'} strokeWidth={sel ? 5 : 3}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onClick={() => onSelect && onSelect(sel ? null : r.id)}
            />
            <text x={x + rw / 2} y={y + rh / 2 - 2} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#172033" pointerEvents="none">{r.name}</text>
            <text x={x + rw / 2} y={y + rh / 2 + 14} textAnchor="middle" fontSize={11} fill="#172033" pointerEvents="none">{r.w.toFixed(1)}×{r.d.toFixed(1)} م</text>

            {/* جزيرة المطبخ الأمريكان: بتظهر قدام الفتحة الواسعة */}
            {r.type === 'kitchen' && r.openings.filter((o) => o.kind === 'pass' && o.sill < 0.01 && o.width >= 2.4).map((o) => {
              const l = wallLine(r, o.side)
              const mid = (l.from + l.to) / 2 + o.c
              const li = Math.min(3.2, o.width - 0.5)
              const near = 0.2, far = 1.0
              let ix: number, iy: number, iw: number, ih: number
              if (l.axis === 'h') {
                ix = X(mid - li / 2); iw = li * U
                iy = o.side === 'N' ? Y(l.fixed + near) : Y(l.fixed - far); ih = (far - near) * U
              } else {
                iy = Y(mid - li / 2); ih = li * U
                ix = o.side === 'W' ? X(l.fixed + near) : X(l.fixed - far); iw = (far - near) * U
              }
              return <rect key={'is' + o.id} x={ix} y={iy} width={iw} height={ih} fill="#F3F1EC" stroke="#8B6B4A" strokeWidth={1.5} pointerEvents="none" />
            })}

            {r.openings.map((o) => {
              const l = wallLine(r, o.side)
              const mid = (l.from + l.to) / 2 + o.c
              const half = o.width / 2
              const p = l.axis === 'h'
                ? [X(mid - half), Y(l.fixed), X(mid + half), Y(l.fixed)]
                : [X(l.fixed), Y(mid - half), X(l.fixed), Y(mid + half)]
              // باب: بني فاتح | شباك: أزرق | فتحة مفتوحة: أبيض | بار: بني غامق متقطع
              const bar = o.kind === 'pass' && o.sill > 0.01
              const stroke = o.kind === 'door' ? '#D9A25F' : o.kind === 'window' ? '#3FA0F0' : bar ? '#8B6B4A' : '#ffffff'
              const sw = o.kind === 'door' ? 7 : o.kind === 'window' ? 5 : 8
              return (
                <line key={r.id + '-' + o.id} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]}
                  stroke={stroke} strokeWidth={sw} strokeDasharray={bar ? '5 3' : undefined} pointerEvents="none" />
              )
            })}
                        {r.columns.map((c) => {
              const l = wallLine(r, c.side)
              const mid = l.from + c.offset
              const horiz = l.axis === 'h'
              const rx = horiz ? mid - c.w / 2 : c.side === 'W' ? l.fixed : l.fixed - c.d
              const ry = horiz ? (c.side === 'N' ? l.fixed : l.fixed - c.d) : mid - c.w / 2
              const rw = horiz ? c.w : c.d, rh = horiz ? c.d : c.w
              return <rect key={'col' + c.id} x={X(rx)} y={Y(ry)} width={rw * U} height={rh * U} fill="#4A5160" stroke="#172033" strokeWidth={1.5} pointerEvents="none" />
            })}
          </g>
        )
      })}

      {/* الشارع على الناحية المختارة */}
      {front === 'S' && <><rect x={X(b.x0)} y={Y(b.y1) + 12} width={bw * U} height={8} fill="#9AA6B8" /><text x={mx} y={Y(b.y1) + 38} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1F5FBF">الشارع</text></>}
      {front === 'N' && <><rect x={X(b.x0)} y={Y(b.y0) - 20} width={bw * U} height={8} fill="#9AA6B8" /><text x={mx} y={Y(b.y0) - 28} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1F5FBF">الشارع</text></>}
      {front === 'W' && <><rect x={X(b.x0) - 20} y={Y(b.y0)} width={8} height={bh * U} fill="#9AA6B8" /><text transform={`translate(${X(b.x0) - 28},${my}) rotate(-90)`} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1F5FBF">الشارع</text></>}
      {front === 'E' && <><rect x={X(b.x1) + 12} y={Y(b.y0)} width={8} height={bh * U} fill="#9AA6B8" /><text transform={`translate(${X(b.x1) + 38},${my}) rotate(90)`} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1F5FBF">الشارع</text></>}

      {/* الأبعاد الكلية */}
      {front !== 'N' && <text x={mx} y={Y(b.y0) - 12} textAnchor="middle" fontSize={11} fill="#5B6578">{bw.toFixed(1)} م</text>}
      {front !== 'W' && <text transform={`translate(${X(b.x0) - 12},${my}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#5B6578">{bh.toFixed(1)} م</text>}
    </svg>
  )
}