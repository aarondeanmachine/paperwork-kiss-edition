import { useEffect, useRef, type ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'

export type Placement = 'bottom' | 'bottom-start' | 'bottom-end' | 'top' | 'top-end'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** The button the menu is anchored to. It owns its own click handler. */
  trigger: ReactNode
  placement?: Placement
  label: string
  className?: string
  children: ReactNode
}

/** A menu anchored to its trigger. Closes on outside press or Escape. */
export function Popover({ open, onClose, trigger, placement = 'bottom', label, className, children }: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return (
    <div className={`popover-anchor ${className ?? ''}`} ref={anchorRef}>
      {trigger}
      {open && (
        <div className="menu" role="menu" aria-label={label} data-placement={placement}>
          {children}
        </div>
      )}
    </div>
  )
}

/** A thin line between groups of menu items. */
export function MenuDivider() {
  return <div className="menu-divider" role="separator" />
}

/** A quiet caption at the top of a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>
}

interface MenuItemProps {
  icon: LucideIcon
  label: string
  tone?: 'default' | 'danger'
  /** Shown but not available, e.g. "Move up" on the first page. */
  disabled?: boolean
  /** Makes the item a tick-box: true shows a check at the end of the row. */
  checked?: boolean
  onSelect: () => void
}

export function MenuItem({ icon: Icon, label, tone = 'default', disabled = false, checked, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      className="menu-item"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      data-tone={tone}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onSelect}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden />
      <span className="menu-item-label">{label}</span>
      {checked && <Check className="menu-item-check" size={14} strokeWidth={2} aria-hidden />}
    </button>
  )
}
