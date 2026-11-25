import { FIN, applyFin, resetFinDefaults } from './finance'

const KEY = 'bayti.fin.v1'

// بيتنده مرة واحدة قبل ما الموقع يظهر
export function initFinance() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) applyFin(JSON.parse(raw))
  } catch { /* تجاهل */ }
}
export function saveFin() { try { localStorage.setItem(KEY, JSON.stringify(FIN)) } catch { /* المساحة ممتلئة */ } }
export function resetFin() { resetFinDefaults(); saveFin() }