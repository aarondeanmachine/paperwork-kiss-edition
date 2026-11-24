import { useState } from 'react'
import {
  EyeOff,
  Image,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Shapes,
  Signature,
  Table,
  TextCursorInput,
  Type,
  Undo2,
} from 'lucide-react'
import { MenuItem, Popover } from '../components/Popover'
import { insertField, insertPhoto } from '../lib/insert'
import { useStore } from '../store'

/**
 * Cursor, Text, Undo, Redo and + (Exhibit C). Undo and redo are actions, not tools,
 * so they never take the selected background. The + opens the insert menu.
 */
export function BottomToolbar() {
  const tool = useStore((state) => state.tool)
  const setTool = useStore((state) => state.setTool)
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)
  const canUndo = useStore((state) => state.canUndo)
  const canRedo = useStore((state) => state.canRedo)
  const setDialog = useStore((state) => state.setDialog)
  const [insertOpen, setInsertOpen] = useState(false)

  const close = () => setInsertOpen(false)
  const pick = (action: () => void) => () => {
    close()
    action()
  }

  return (
    <div className="toolbar-dock">
      <div className="toolbar" role="toolbar" aria-label="Tools">
        <button
          type="button"
          className="tool-btn"
          aria-label="Select"
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <MousePointer2 size={18} strokeWidth={1.5} aria-hidden />
        </button>
        <button
          type="button"
          className="tool-btn"
          aria-label="Text"
          aria-pressed={tool === 'text'}
          onClick={() => setTool('text')}
        >
          <Type size={18} strokeWidth={1.5} aria-hidden />
        </button>
        <button type="button" className="tool-btn" aria-label="Undo" aria-disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} strokeWidth={1.5} aria-hidden />
        </button>
        <button type="button" className="tool-btn" aria-label="Redo" aria-disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} strokeWidth={1.5} aria-hidden />
        </button>

        <Popover
          open={insertOpen}
          onClose={close}
          label="Insert"
          placement="top-end"
          className="insert-menu"
          trigger={
            <button
              type="button"
              className="tool-btn"
              aria-label="Insert"
              aria-haspopup="menu"
              aria-expanded={insertOpen}
              onClick={() => setInsertOpen((open) => !open)}
            >
              <span className="plus-dot">
                <Plus size={16} strokeWidth={1.5} aria-hidden />
              </span>
            </button>
          }
        >
          <MenuItem icon={Signature} label="Signature" onSelect={pick(() => setDialog('signature'))} />
          <MenuItem icon={TextCursorInput} label="Form field" onSelect={pick(insertField)} />
          {/* Redaction, shape, drawing and table are not built in the mockup: they just close the menu. */}
          <MenuItem icon={EyeOff} label="Redaction" onSelect={close} />
          <MenuItem icon={Shapes} label="Shape" onSelect={close} />
          <MenuItem icon={Pencil} label="Drawing" onSelect={close} />
          <MenuItem icon={Table} label="Table" onSelect={close} />
          <MenuItem icon={Image} label="Photo" onSelect={pick(() => void insertPhoto())} />
        </Popover>
      </div>
    </div>
  )
}
