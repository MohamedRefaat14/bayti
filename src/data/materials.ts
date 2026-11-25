import type { RoomType } from '../apartment'
import type { StyleId } from './options'
import { defaultFloor } from './catalog'
import type { FloorConfig } from './catalog'
import { defaultWall } from './wallCatalog'
import type { WallConfig } from './wallCatalog'
import { defaultCeiling } from './ceilingCatalog'
import type { CeilingConfig } from './ceilingCatalog'

// التشطيب المبدئي لغرفة حسب الستايل ونوعها
export const presetFor = (style: StyleId, type: RoomType): { wall: WallConfig; floor: FloorConfig; ceiling: CeilingConfig } => ({
  wall: defaultWall(style, type),
  floor: defaultFloor(style, type),
  ceiling: defaultCeiling(style, type),
})