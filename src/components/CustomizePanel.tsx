import type { BudgetId } from '../data/options'
import type { RoomView } from '../apartment'
import type { FloorConfig } from '../data/catalog'
import type { WallConfig } from '../data/wallCatalog'
import type { CeilingConfig } from '../data/ceilingCatalog'
import FloorPicker from './FloorPicker'
import WallPicker from './WallPicker'
import CeilingPicker from './CeilingPicker'
import FurniturePanel from './FurniturePanel'
import OpeningsPanel from './OpeningsPanel'

interface Props {
  room: RoomView
  budget: BudgetId
  onFloor: (c: FloorConfig) => void
  onWall: (w: WallConfig) => void
  onCeiling: (c: CeilingConfig) => void
  onFurn: () => void
}

export default function CustomizePanel({ room, budget, onFloor, onWall, onCeiling, onFurn }: Props) {
  return (
    <aside className="panel">
      <h3>تخصيص الغرفة الحالية</h3>
      <p className="panel-sub">التعديل فوري على {room.name}</p>
      <FloorPicker room={room} budget={budget} onChange={onFloor} />
      <WallPicker room={room} budget={budget} onChange={onWall} />
      <CeilingPicker room={room} budget={budget} onChange={onCeiling} />
      <FurniturePanel room={room} onChange={onFurn} />
      <OpeningsPanel room={room} onChange={onFurn} />
    </aside>
  )
}