import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

interface DialogProps {
  title: string
  onClose: () => void
  /** Shows a back arrow for the second step of a flow. */
  onBack?: () => void
  children: ReactNode
}

/** A small popup card over a dimmed screen. Closes on the x, the dimmed area, or Escape. */
export function Dialog({ title, onClose, onBack, children }: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          {onBack && (
            <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
              <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <h2 className="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
