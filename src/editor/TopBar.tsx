import { useState } from 'react'
import { Download, FileDown, House, Link2, Mail, PanelLeft, Shrink } from 'lucide-react'
import { MenuItem, Popover } from '../components/Popover'
import { useStore } from '../store'

export function TopBar({ title }: { title: string }) {
  const goHome = useStore((state) => state.goHome)
  const showToast = useStore((state) => state.showToast)
  const setDialog = useStore((state) => state.setDialog)
  const sidebar = useStore((state) => state.sidebar)
  const setSidebar = useStore((state) => state.setSidebar)
  const [shareOpen, setShareOpen] = useState(false)

  const openDialog = (dialog: 'formats' | 'compress') => {
    setShareOpen(false)
    setDialog(dialog)
  }

  const share = (message: string) => {
    setShareOpen(false)
    showToast(message)
  }

  return (
    <header className="topbar">
      <div className="topbar-group">
        <button type="button" className="icon-btn" aria-label="Home" onClick={goHome}>
          <House size={18} strokeWidth={1.5} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Pages"
          aria-expanded={sidebar !== 'closed'}
          onClick={() => setSidebar(sidebar === 'closed' ? 'list' : 'closed')}
        >
          <PanelLeft size={18} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <div className="topbar-title">{title}</div>

      <Popover
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        label="Share"
        placement="bottom-end"
        trigger={
          <button
            type="button"
            className="btn-primary"
            aria-haspopup="menu"
            aria-expanded={shareOpen}
            onClick={() => setShareOpen((open) => !open)}
          >
            Share
          </button>
        }
      >
        <MenuItem icon={Link2} label="Share via link" onSelect={() => share('Link copied')} />
        <MenuItem icon={Mail} label="Share via email" onSelect={() => share('Email draft opened')} />
        <MenuItem icon={Download} label="Download as PDF" onSelect={() => share('Downloading PDF')} />
        <MenuItem icon={FileDown} label="Download as other formats" onSelect={() => openDialog('formats')} />
        <MenuItem icon={Shrink} label="Compress file" onSelect={() => openDialog('compress')} />
      </Popover>
    </header>
  )
}
