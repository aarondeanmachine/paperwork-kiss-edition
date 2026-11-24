import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const GAP = 6
/** Minimum space between the menu and the frame edges. */
const EDGE = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

interface FloatingMenuProps {
  /** The button the menu belongs to. */
  anchor: HTMLElement
  onClose: () => void
  label: string
  children: ReactNode
}

/**
 * A menu anchored to a button but drawn at the top level of the phone frame, so a
 * scrolling list cannot clip it. It opens below the button (above if there is no
 * room) and is nudged sideways to stay inside the frame.
 */
export function FloatingMenu({ anchor, onClose, label, children }: FloatingMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const frame = anchor.closest<HTMLElement>('.frame')

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu || !frame) return
    const bounds = frame.getBoundingClientRect()
    const button = anchor.getBoundingClientRect()
    const below = button.bottom - bounds.top + GAP
    const fitsBelow = below + menu.offsetHeight <= bounds.height - EDGE
    const top = fitsBelow ? below : Math.max(EDGE, button.top - bounds.top - GAP - menu.offsetHeight)
    const left = clamp(button.left - bounds.left, EDGE, bounds.width - menu.offsetWidth - EDGE)
    menu.style.top = `${top}px`
    menu.style.left = `${left}px`
  })

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // A press on the button itself is left to the button, which toggles the menu.
      if (menuRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
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
  }, [anchor, onClose])

  if (!frame) return null
  return createPortal(
    <div ref={menuRef} className="menu" role="menu" aria-label={label} data-placement="floating">
      {children}
    </div>,
    frame,
  )
}
