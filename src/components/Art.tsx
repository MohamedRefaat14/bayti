// رسومات الكروت (SVG مسطّح بنفس ألوان التصميم)
const B = '#5B93D6', BL = '#8DB6E8', G = '#9AA3AE', GD = '#6B7480', W = '#E6EAF0', Y = '#F2C14E'

export function FurnishArt() {
  return (
    <svg viewBox="0 0 260 170" width="260" height="170" aria-hidden>
      <rect x="168" y="16" width="38" height="38" rx="3" fill={W} stroke={GD} strokeWidth="3" />
      <path d="M174 46 l10 -12 l8 8 l6 -6 l6 10z" fill={B} />
      <path d="M44 40 h28 l8 26 h-44z" fill={G} /><rect x="56" y="66" width="4" height="20" fill={GD} />
      <rect x="30" y="90" width="48" height="38" rx="4" fill={W} /><rect x="36" y="100" width="36" height="3" fill={G} /><rect x="36" y="112" width="36" height="3" fill={G} />
      <rect x="92" y="78" width="104" height="46" rx="12" fill={B} />
      <rect x="84" y="94" width="20" height="40" rx="8" fill={BL} /><rect x="184" y="94" width="20" height="40" rx="8" fill={BL} />
      <rect x="104" y="86" width="40" height="22" rx="6" fill={BL} /><rect x="146" y="86" width="40" height="22" rx="6" fill={BL} />
      <rect x="96" y="124" width="6" height="10" fill={GD} /><rect x="186" y="124" width="6" height="10" fill={GD} />
      <path d="M208 100 q-18 -30 0 -42 q18 12 0 42z" fill={BL} /><path d="M214 108 q22 -26 8 -40 q-18 12 -8 40z" fill={B} />
      <rect x="204" y="106" width="20" height="26" rx="3" fill={W} />
      <path d="M52 148 h150 l14 18 h-178z" fill="none" stroke={B} strokeWidth="4" strokeLinejoin="round" />
      <path d="M70 152 h112 l10 12 h-132z" fill={BL} opacity=".5" />
    </svg>
  )
}

export function FinishArt() {
  return (
    <svg viewBox="0 0 260 170" width="260" height="170" aria-hidden>
      <rect x="46" y="34" width="86" height="34" rx="6" fill={W} />
      <path d="M120 34 h28 q8 0 8 8 v26 q0 8 -8 8 h-28z" fill={B} />
      <path d="M150 40 q18 0 18 14 q0 14 -18 14z" fill={BL} />
      <rect x="40" y="52" width="14" height="14" fill={G} />
      <rect x="50" y="70" width="6" height="22" fill={G} transform="rotate(-24 53 80)" />
      <path d="M30 78 l8 -4 l8 22 l-8 4z" fill={GD} />
      <path d="M52 104 l12 -4 l10 38 l-10 6z" fill={B} />
      <line x1="196" y1="14" x2="196" y2="40" stroke={G} strokeWidth="3" />
      <path d="M176 66 q0 -26 20 -26 q20 0 20 26z" fill={G} />
      <rect x="190" y="66" width="12" height="6" fill={Y} />
      <path d="M184 82 l-8 8 M196 84 v12 M208 82 l8 8" stroke={Y} strokeWidth="3" strokeLinecap="round" />
      <path d="M150 122 l40 -22 l40 22 v34 l-40 18 l-40 -18z" fill="#B9BFC8" />
      <path d="M150 122 l40 22 l40 -22" fill="none" stroke={GD} strokeWidth="3" />
      <path d="M190 144 v30" stroke={GD} strokeWidth="3" />
      <path d="M160 132 l30 16 M170 126 l30 16 M180 120 l30 16" stroke="#D6DAE0" strokeWidth="3" />
    </svg>
  )
}

export function BuildArt() {
  return (
    <svg viewBox="0 0 260 170" width="260" height="170" aria-hidden>
      <path d="M56 24 h108 q10 0 10 10 v78 q0 10 -10 10 h-108 q-14 0 -14 -14 v-70 q0 -14 14 -14z" fill={B} />
      <rect x="62" y="34" width="100" height="84" rx="4" fill={W} stroke={BL} strokeWidth="3" />
      <rect x="86" y="50" width="46" height="46" fill="none" stroke={B} strokeWidth="3" />
      <path d="M86 73 h22 M109 50 v23" stroke={B} strokeWidth="3" />
      <text x="109" y="68" fontSize="18" fontWeight="800" fill={B} textAnchor="middle" fontFamily="sans-serif">2D</text>
      <path d="M190 42 h22 v50" fill="none" stroke={BL} strokeWidth="3" strokeDasharray="6 5" />
      <path d="M212 108 l-6 -12 h12z" fill={BL} />
      <path d="M62 122 h100" stroke={BL} strokeWidth="3" strokeDasharray="6 5" />
      <rect x="170" y="140" width="76" height="14" fill="#9AA3AE" /><rect x="170" y="124" width="52" height="14" fill="#B9BFC8" /><rect x="170" y="108" width="28" height="14" fill="#9AA3AE" />
      <path d="M188 140 v14 M214 140 v14 M196 124 v14" stroke="#6B7480" strokeWidth="2" />
    </svg>
  )
}
