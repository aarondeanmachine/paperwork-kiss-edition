import { useContext, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { clientToPage, toLocal } from '../lib/geometry'
import { PAGE_WIDTH } from '../lib/layout'
import { useStore, type Snapshot } from '../store'
import type { DocObject } from '../types'
import { PageContext } from './pageContext'

/** Pointer travel (px) before a press counts as a drag instead of a tap. */
const DRAG_THRESHOLD = 4
/** Dragging within this distance of the canvas top or bottom scrolls it. */
const SCROLL_EDGE = 64
const SCROLL_MAX_SPEED = 14

/**
 * width: only the width changes and the content sets the height (text).
 * free: width and height change independently (form fields, signature requests).
 * aspect: proportions are locked (signatures, photos).
 */
export type ResizeMode = 'width' | 'free' | 'aspect'

interface MoveGesture {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  wasSelected: boolean
  canDrag: boolean
  dragging: boolean
  moved: boolean
  origin: { x: number; y: number }
  startScroll: number
  before: Snapshot | null
  frame: number
}

interface ResizeGesture {
  pointerId: number
  left: boolean
  top: boolean
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
  before: Snapshot | null
}

const HANDLES = [
  { corner: 'tl', left: true, top: true },
  { corner: 'tr', left: false, top: true },
  { corner: 'bl', left: true, top: false },
  { corner: 'br', left: false, top: false },
] as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

interface ObjectFrameProps {
  object: DocObject
  resize: ResizeMode
  minWidth: number
  minHeight?: number
  className: string
  /** True while the content is being typed in: presses go to the content, not to dragging. */
  locked?: boolean
  /** A press and release without movement. `wasSelected` is the state before the press. */
  onTap: (event: ReactPointerEvent<HTMLDivElement>, wasSelected: boolean) => void
  /** Controls attached to the box while it is selected. */
  attachment?: ReactNode
  children: ReactNode
}

/**
 * Everything objects on the canvas have in common: position, selection box,
 * dragging (including across pages) and corner handles.
 */
export function ObjectFrame({
  object,
  resize,
  minWidth,
  minHeight = 16,
  className,
  locked = false,
  onTap,
  attachment,
  children,
}: ObjectFrameProps) {
  const selected = useStore((state) => state.selectedId === object.id)
  const { scale, rotation } = useContext(PageContext)
  const boxRef = useRef<HTMLDivElement>(null)
  const move = useRef<MoveGesture | null>(null)
  const resizing = useRef<ResizeGesture | null>(null)

  const canvasOf = (el: Element) => el.closest<HTMLElement>('.canvas')

  /* ---------- Move ---------- */

  const applyDrag = (gesture: MoveGesture) => {
    const canvas = boxRef.current && canvasOf(boxRef.current)
    const scrolled = canvas ? canvas.scrollTop - gesture.startScroll : 0
    // Movement on screen, turned into the page's own axes (the page may be rotated).
    const [dx, dy] = toLocal(gesture.lastX - gesture.startX, gesture.lastY - gesture.startY + scrolled, rotation)
    let x = gesture.origin.x + dx / scale
    let y = gesture.origin.y + dy / scale
    // Keep the box between the page's left and right edges as seen on screen, and leave it free
    // up and down so it can cross to another page. On a page turned sideways that is its y axis.
    const box = boxRef.current
    const page = box?.closest<HTMLElement>('.page')
    if (rotation % 180 === 0) x = clamp(x, 0, PAGE_WIDTH - object.width)
    else if (box && page) y = clamp(y, 0, page.offsetHeight - box.offsetHeight)
    useStore.getState().updateObject(object.id, { x, y })
  }

  const autoScroll = () => {
    const gesture = move.current
    const canvas = boxRef.current && canvasOf(boxRef.current)
    if (!gesture?.dragging || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const over =
      Math.max(gesture.lastY - (rect.bottom - SCROLL_EDGE), 0) - Math.max(rect.top + SCROLL_EDGE - gesture.lastY, 0)
    if (over !== 0) {
      canvas.scrollTop += clamp(over / 4, -SCROLL_MAX_SPEED, SCROLL_MAX_SPEED)
      applyDrag(gesture)
    }
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  /** On release the object joins whichever page its center is over. */
  const drop = (gesture: MoveGesture) => {
    const box = boxRef.current
    const canvas = box && canvasOf(box)
    if (!box || !canvas) return
    const rect = box.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    let target: HTMLElement | null = null
    let nearest = Infinity
    for (const page of canvas.querySelectorAll<HTMLElement>('.page')) {
      const pageRect = page.getBoundingClientRect()
      const distance = Math.max(pageRect.top - centerY, centerY - pageRect.bottom, 0)
      if (distance < nearest) {
        nearest = distance
        target = page
      }
    }
    const state = useStore.getState()
    if (target?.dataset.pageId) {
      // The object keeps its center; its position is read in the target page's own axes.
      const center = clientToPage(target, centerX, centerY)
      state.placeObject(
        object.id,
        target.dataset.pageId,
        center.x - box.offsetWidth / 2,
        center.y - box.offsetHeight / 2,
      )
    }
    if (gesture.before) state.record(gesture.before)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || locked) return
    const state = useStore.getState()
    const isMouse = event.pointerType === 'mouse'
    // Touch drags only an object that is already selected, so swiping over the page still scrolls.
    const canDrag = state.tool === 'select' && (isMouse || selected)
    if (state.tool === 'select' && isMouse && !selected) state.select(object.id)
    if (canDrag) event.currentTarget.setPointerCapture(event.pointerId)
    const canvas = canvasOf(event.currentTarget)
    move.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      wasSelected: selected,
      canDrag,
      dragging: false,
      moved: false,
      origin: { x: object.x, y: object.y },
      startScroll: canvas?.scrollTop ?? 0,
      before: null,
      frame: 0,
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = move.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > DRAG_THRESHOLD) {
      gesture.moved = true
      if (gesture.canDrag) {
        gesture.dragging = true
        gesture.before = useStore.getState().snapshot()
        gesture.frame = requestAnimationFrame(autoScroll)
      }
    }
    if (gesture.dragging) applyDrag(gesture)
  }

  const endMove = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = move.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    move.current = null
    cancelAnimationFrame(gesture.frame)
    if (gesture.dragging) {
      drop(gesture)
      return
    }
    if (!cancelled && !gesture.moved) onTap(event, gesture.wasSelected)
  }

  /* ---------- Resize ---------- */

  const onHandleDown = (event: ReactPointerEvent<HTMLSpanElement>, left: boolean, top: boolean) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizing.current = {
      pointerId: event.pointerId,
      left,
      top,
      startX: event.clientX,
      startY: event.clientY,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      // While text is being edited, the edit session already holds the undo point.
      before: locked ? null : useStore.getState().snapshot(),
    }
  }

  const onHandleMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const gesture = resizing.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const [localX, localY] = toLocal(event.clientX - gesture.startX, event.clientY - gesture.startY, rotation)
    const dx = localX / scale
    const dy = localY / scale
    const right = gesture.x + gesture.width
    const bottom = gesture.y + gesture.height
    const update = useStore.getState().updateObject

    let x = gesture.x
    let width = gesture.width
    if (gesture.left) {
      x = clamp(gesture.x + dx, 0, right - minWidth)
      width = right - x
    } else {
      width = clamp(gesture.width + dx, minWidth, PAGE_WIDTH - gesture.x)
    }

    if (resize === 'width') {
      update(object.id, { x, width })
      return
    }
    if (resize === 'aspect') {
      // The opposite corner stays put while the picture scales.
      const height = width * (gesture.height / gesture.width)
      update(object.id, { x, y: gesture.top ? bottom - height : gesture.y, width, height })
      return
    }
    let y = gesture.y
    let height = gesture.height
    if (gesture.top) {
      y = clamp(gesture.y + dy, 0, bottom - minHeight)
      height = bottom - y
    } else {
      height = Math.max(minHeight, gesture.height + dy)
    }
    update(object.id, { x, y, width, height })
  }

  const onHandleUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const gesture = resizing.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    resizing.current = null
    if (gesture.before) useStore.getState().record(gesture.before)
  }

  return (
    <div
      ref={boxRef}
      className={`obj obj-live ${className}`}
      data-obj-id={object.id}
      data-selected={selected || undefined}
      data-editing={locked || undefined}
      style={{
        left: object.x,
        top: object.y,
        width: object.width,
        height: resize === 'width' ? undefined : object.height,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endMove(event, false)}
      onPointerCancel={(event) => endMove(event, true)}
    >
      {children}
      {selected && (
        <div className="selection" data-resize={resize} aria-hidden>
          {HANDLES.map(({ corner, left, top }) => (
            <span
              key={corner}
              className="handle"
              data-corner={corner}
              onPointerDown={(event) => onHandleDown(event, left, top)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              // Keep the caret in the box when a handle is pressed mid-edit.
              onMouseDown={(event) => event.preventDefault()}
            />
          ))}
        </div>
      )}
      {selected && attachment && (
        // Presses on attached controls must not start a drag of the box.
        <div className="attachment" onPointerDown={(event) => event.stopPropagation()}>
          {attachment}
        </div>
      )}
    </div>
  )
}
