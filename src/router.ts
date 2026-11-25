import { useEffect, useState } from 'react'
// توجيه بسيط بالـhash (#plan, #style...) عشان يشتغل في أي استضافة
export const go = (r: string) => { location.hash = r }
export function useRoute() {
  const read = () => location.hash.replace('#', '')
  const [r, setR] = useState(read())
  useEffect(() => {
    const f = () => setR(read())
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return r
}
