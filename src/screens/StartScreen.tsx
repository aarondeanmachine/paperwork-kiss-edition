import { useState } from 'react'
import { FileText, FolderOpen, Plus } from 'lucide-react'
import { MenuItem, Popover } from '../components/Popover'
import { useStore } from '../store'

export function StartScreen() {
  const openSample = useStore((state) => state.openSample)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="screen start">
      <h1 className="start-wordmark">paperwork.com</h1>
      <p className="start-tagline">let’s get to work</p>

      <Popover
        className="start-add"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        label="Add a document"
        placement="bottom"
        trigger={
          <button
            type="button"
            className="add-tile"
            aria-label="Add a document"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="plus-dot">
              <Plus size={16} strokeWidth={1.5} aria-hidden />
            </span>
          </button>
        }
      >
        {/* No real upload in the mockup: both options open the sample file. */}
        <MenuItem icon={FolderOpen} label="Add from files" onSelect={openSample} />
        <MenuItem icon={FileText} label="Open sample file" onSelect={openSample} />
      </Popover>
    </div>
  )
}
