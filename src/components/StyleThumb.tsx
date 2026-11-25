import type { StyleId } from '../data/options'
import { STYLES } from '../data/options'

// صورة معاينة مبسطة للستايل (استبدلها بصور حقيقية لاحقاً)
export default function StyleThumb({ id }: { id: StyleId }) {
  const p = STYLES.find((s) => s.id === id)!.palette
  return (
    <svg viewBox="0 0 200 120" className="thumb" aria-hidden>
      <rect width="200" height="120" fill={p.wall} />
      <rect y="84" width="200" height="36" fill={p.floor} />
      <rect x="120" y="22" width="52" height="34" rx="3" fill={p.accent} />
      <rect x="30" y="58" width="86" height="30" rx="8" fill={p.sofa} />
      <rect x="24" y="66" width="16" height="28" rx="6" fill={p.sofa} opacity=".85" />
      <rect x="106" y="66" width="16" height="28" rx="6" fill={p.sofa} opacity=".85" />
      <rect x="62" y="96" width="44" height="8" rx="3" fill={p.accent} />
    </svg>
  )
}