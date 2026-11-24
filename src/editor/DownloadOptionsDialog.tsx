import { Download } from 'lucide-react'
import { Dialog } from '../components/Dialog'
import { useStore } from '../store'

export interface DownloadOption {
  label: string
  detail: string
  /** What the toast says once this option is chosen. */
  toast: string
}

interface DownloadOptionsDialogProps {
  title: string
  options: DownloadOption[]
  onClose: () => void
}

/** A popup of download buttons, one per option. Shared by the Share menu's download choices. */
export function DownloadOptionsDialog({ title, options, onClose }: DownloadOptionsDialogProps) {
  const showToast = useStore((state) => state.showToast)

  const download = (option: DownloadOption) => {
    // Nothing is really downloaded in the mockup.
    onClose()
    showToast(option.toast)
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="option-list">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            className="option"
            aria-label={`Download: ${option.label}`}
            onClick={() => download(option)}
          >
            <span className="option-icon">
              <Download size={16} strokeWidth={1.5} aria-hidden />
            </span>
            <span className="option-text">
              <span className="option-title">{option.label}</span>
              <span className="option-sub">{option.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
