import { session } from './state'
import { buildViews } from './apartment'

// غرف الـ360 كما هي في شقة المستخدم (بتتحسب من البيانات كل مرة)
export const getRooms = () => buildViews(session.apt, session.style)