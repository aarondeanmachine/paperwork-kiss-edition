import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** Mouse: travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4
/** Touch: a still press this long (ms) picks the file up; moving sooner scrolls the page. */
const LONG_PRESS = 280
const LONG_PRESS_SLOP = 8
const SCROLL_EDGE = 56
const SCROLL_SPEED = 8

interface DragGesture {
  fileId: string
  isMouse: boolean
  startX: number
  startY: number
  lastX: number
  lastY: number
  active: boolean
  timer: number
  frame: number
  cleanup: () => void
}

interface FileDragOptions {
  /** Dragging is only on offer when there is somewhere to drop. */
  enabled: boolean
  onDrop: (fileId: string, folderId: string) => void
}

/**
 * Dragging a file card onto a folder on Home.
 * With a mouse the drag starts as soon as the pointer moves. On touch, press and
 * hold to pick the file up, because a plain swipe scrolls the page.
 */
export function useFileDrag({ enabled, onDrop }: FileDragOptions) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragGesture | null>(null)
  const dropRef = useRef<string | null>(null)
  const justDragged = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)

  const placeGhost = (gesture: DragGesture) => {
    const root = rootRef.current?.getBoundingClientRect()
    if (!root || !ghostRef.current) return
    ghostRef.current.style.transform = `translate(${gesture.lastX - root.left}px, ${gesture.lastY - root.top}px)`
  }

  const track = (gesture: DragGesture) => {
    placeGhost(gesture)
    // The ghost ignores the pointer, so this finds whatever card is underneath it.
    const under = document.elementFromPoint(gesture.lastX, gesture.lastY)
    const folderId = under?.closest<HTMLElement>('.folder-card')?.dataset.folderId ?? null
    if (folderId !== dropRef.current) {
      dropRef.current = folderId
      setDropFolderId(folderId)
    }
  }

  // The ghost mounts when a drag starts: put it under the pointer before it is painted.
  useLayoutEffect(() => {
    if (draggingId && drag.current) placeGhost(drag.current)
  }, [draggingId])

  const autoScroll = () => {
    const gesture = drag.current
    const grid = gridRef.current
    if (!gesture?.active || !grid) return
    const rect = grid.getBoundingClientRect()
    if (gesture.lastY < rect.top + SCROLL_EDGE) grid.scrollTop -= SCROLL_SPEED
    else if (gesture.lastY > rect.bottom - SCROLL_EDGE) grid.scrollTop += SCROLL_SPEED
    track(gesture)
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  const pickUp = (gesture: DragGesture) => {
    gesture.active = true
    setDraggingId(gesture.fileId)
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  const finish = (gesture: DragGesture, commit: boolean) => {
    window.clearTimeout(gesture.timer)
    cancelAnimationFrame(gesture.frame)
    gesture.cleanup()
    drag.current = null
    if (!gesture.active) return
    // Letting go over the card it came from would otherwise count as a tap and open the file.
    justDragged.current = true
    window.setTimeout(() => (justDragged.current = false), 0)
    if (commit && dropRef.current) onDrop(gesture.fileId, dropRef.current)
    dropRef.current = null
    setDraggingId(null)
    setDropFolderId(null)
  }

  /** Attach to a file's thumbnail. */
  const onThumbDown = (event: ReactPointerEvent<HTMLElement>, fileId: string) => {
    if (!enabled || event.button !== 0 || drag.current) return
    const pointerId = event.pointerId

    const onMove = (moveEvent: PointerEvent) => {
      const gesture = drag.current
      if (!gesture || moveEvent.pointerId !== pointerId) return
      gesture.lastX = moveEvent.clientX
      gesture.lastY = moveEvent.clientY
      if (!gesture.active) {
        const travel = Math.hypot(moveEvent.clientX - gesture.startX, moveEvent.clientY - gesture.startY)
        if (gesture.isMouse && travel > DRAG_THRESHOLD) pickUp(gesture)
        // On touch, moving before the hold completes is a scroll of the page, not a drag.
        else if (!gesture.isMouse && travel > LONG_PRESS_SLOP) finish(gesture, false)
        return
      }
      track(gesture)
    }
    const onUp = (upEvent: PointerEvent) => {
      const gesture = drag.current
      if (gesture && upEvent.pointerId === pointerId) finish(gesture, upEvent.type === 'pointerup')
    }
    // Once a file is picked up on touch, the finger moves the file, not the page.
    const onTouchMove = (touchEvent: TouchEvent) => {
      if (drag.current?.active && touchEvent.cancelable) touchEvent.preventDefault()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    const gesture: DragGesture = {
      fileId,
      isMouse: event.pointerType === 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      active: false,
      timer: 0,
      frame: 0,
      cleanup: () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        document.removeEventListener('touchmove', onTouchMove)
      },
    }
    drag.current = gesture
    if (!gesture.isMouse) gesture.timer = window.setTimeout(() => pickUp(gesture), LONG_PRESS)
  }

  useEffect(
    () => () => {
      if (drag.current) finish(drag.current, false)
    },
    // Only on unmount: stop listening if Home goes away mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return {
    rootRef,
    gridRef,
    ghostRef,
    draggingId,
    dropFolderId,
    onThumbDown,
    /** True for the tap that ends a drag, which should not open the file. */
    wasDrag: () => justDragged.current,
  }
}
