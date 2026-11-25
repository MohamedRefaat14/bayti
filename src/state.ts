import type { BudgetId, StyleId } from './data/options'
import { defaultApartment } from './apartment'

// حالة الجلسة المشتركة بين الصفحات
export type Mode = 'build' | 'finish' | 'furnish'

export const session = {
  mode: 'finish' as Mode,
  style: 'modern' as StyleId,
  budget: 'economy' as BudgetId,
  apt: defaultApartment(), // شقة المستخدم: الأبعاد والغرف والأبواب والشبابيك والتشطيب
  name: 'مشروع بدون اسم',
  rev: 0, // بيزيد كل ما مشروع يتفتح أو يتعمل جديد، عشان الصفحات تتبني من جديد
}