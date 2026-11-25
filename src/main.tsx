import { createRoot } from 'react-dom/client'
import App from './App'
import { initMaterials } from './data/matStore'
import { initFurniture } from './data/furnStore'
import { initOpenings } from './data/openStore'
import { initFinance } from './data/finStore'
import { restoreAutosave, startAutosave } from './project'
import './theme.css'

// بنحمّل الخامات والفرش والأبواب والأسعار المحفوظة (والصور والموديلات) الأول، وبعدين نرجّع آخر مشروع ونظهر الموقع
initFinance()
Promise.all([initMaterials(), initFurniture(), initOpenings()]).finally(() => {
  try { restoreAutosave() } catch { /* لو الحفظ التلقائي تالف نكمّل بمشروع جديد */ }
  startAutosave()
  createRoot(document.getElementById('root')!).render(<App />)
})