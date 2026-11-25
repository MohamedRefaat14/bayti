export type StyleId = 'modern' | 'warm' | 'classic'
export type BudgetId = 'economy' | 'mid' | 'luxury'

// ألوان المعاينة المبسطة لكل ستايل (لحد ما نحط صور حقيقية)
export const STYLES: { id: StyleId; label: string; palette: { wall: string; floor: string; sofa: string; accent: string } }[] = [
  { id: 'modern',  label: 'مودرن',  palette: { wall: '#D9DDE3', floor: '#B9B2A6', sofa: '#4A5568', accent: '#8FA3B8' } },
  { id: 'warm',    label: 'دافئ',   palette: { wall: '#E9D6BC', floor: '#A9784F', sofa: '#B98B63', accent: '#D8B48A' } },
  { id: 'classic', label: 'كلاسيك', palette: { wall: '#EDE6D8', floor: '#8A6A4B', sofa: '#7A8A74', accent: '#C9B79C' } },
]

export const BUDGETS: { id: BudgetId; label: string; text: string }[] = [
  { id: 'economy', label: 'اقتصادي', text: 'تكلفة منخفضة بجودة مقبولة: سيراميك وبورسلين اقتصادي، دهانات عادية، وأثاث بسيط.' },
  { id: 'mid',     label: 'متوسط',   text: 'توازن بين الجودة والسعر: باركيه وبورسلين ممتاز، دهانات جيدة، وأثاث متوسط الفئة.' },
  { id: 'luxury',  label: 'فاخر',    text: 'أفضل الخامات: رخام طبيعي، باركيه فاخر، بيوت نور، وأثاث بتصميم راقي.' },
]