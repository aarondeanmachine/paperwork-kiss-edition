import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Ellipsis,
  FileOutput,
  Merge,
  MoveRight,
  Plus,
  RotateCw,
  Scissors,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { FloatingMenu } from '../components/FloatingMenu'
import { PageView } from '../components/PageView'
import { MenuDivider, MenuItem } from '../components/Popover'
import { useStore } from '../store'
import type { DocFile } from '../types'
import { ExtractDialog } from './ExtractDialog'

const THUMB_WIDTH = 96
/** Mouse: travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4
/** Touch: a still press this long (ms) picks the page up; moving sooner scrolls the list. */
const LONG_PRESS = 280
const LONG_PRESS_SLOP = 8
const SCROLL_EDGE = 48
const SCROLL_SPEED = 8

interface DragGesture {
  pageId: string
  el: HTMLElement
  isMouse: boolean
  startX: number
  startY: number
  lastY: number
  /** Where inside the thumbnail it was grabbed. */
  grab: number
  active: boolean
  timer: number
  frame: number
  /** The offset currently applied to the thumbnail so it stays under the finger. */
  offset: number
  cleanup: () => void
}

/** What the organizer is for, shown as two rows of two on the button that opens it. */
const ORGANIZE_ROWS: { label: string; icon: LucideIcon }[][] = [
  [
    { label: 'Reorder', icon: ArrowUpDown },
    { label: 'Merge', icon: Merge },
  ],
  [
    { label: 'Split', icon: Scissors },
    { label: 'Add', icon: Plus },
  ],
]

function sameOrder(a: string[] | null, b: string[]): boolean {
  return a !== null && a.length === b.length && a.every((id, index) => id === b[index])
}

/**
 * The page navigator. Tap a thumbnail to jump to that page, or drag one to reorder
 * (press and hold on touch). Each thumbnail has a rotate button and a menu of page
 * actions. The button at the top opens the full-screen organizer.
 */
export function Sidebar({ file }: { file: DocFile }) {
  const setSidebar = useStore((state) => state.setSidebar)
  const listRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragGesture | null>(null)
  /** The order shown while a drag is in progress. The ref always holds the latest one. */
  const [preview, setPreview] = useState<string[] | null>(null)
  const previewRef = useRef<string[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ pageId: string; anchor: HTMLElement } | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)

  const order = preview ?? file.pages.map((page) => page.id)
  const pages = order.flatMap((id) => file.pages.find((page) => page.id === id) ?? [])
  const canvas = () => listRef.current?.closest('.editor')?.querySelector<HTMLElement>('.canvas') ?? null

  /* ---------- Which page is in view ---------- */

  useEffect(() => {
    const view = canvas()
    if (!view) return
    const update = () => {
      const viewTop = view.getBoundingClientRect().top
      let nearest: string | null = null
      let best = Infinity
      for (const page of view.querySelectorAll<HTMLElement>('.page')) {
        const rect = page.getBoundingClientRect()
        // The page covering a point a little below the top of the view.
        const distance = Math.max(rect.top - (viewTop + 80), viewTop + 80 - rect.bottom, 0)
        if (distance < best) {
          best = distance
          nearest = page.dataset.pageId ?? null
        }
      }
      setActiveId(nearest)
    }
    update()
    view.addEventListener('scroll', update, { passive: true })
    return () => view.removeEventListener('scroll', update)
  }, [file.pages])

  const jumpTo = (pageId: string) => {
    const view = canvas()
    const page = view?.querySelector<HTMLElement>(`.page[data-page-id="${pageId}"]`)?.parentElement
    if (view && page) view.scrollTo({ top: page.offsetTop - view.offsetTop, behavior: 'smooth' })
  }

  /* ---------- Drag to reorder ---------- */

  /** Keeps the picked-up thumbnail under the pointer, wherever the list has put it. */
  const follow = (gesture: DragGesture) => {
    const natural = gesture.el.getBoundingClientRect().top - gesture.offset
    gesture.offset = gesture.lastY - gesture.grab - natural
    gesture.el.style.transform = `translateY(${gesture.offset}px)`
  }

  /** The page takes the slot its center is over; the others close up around it. */
  const update = (gesture: DragGesture) => {
    const list = listRef.current
    if (!list) return
    const center = gesture.lastY - gesture.grab + gesture.el.offsetHeight / 2
    const others = [...list.querySelectorAll<HTMLElement>('.thumb')].filter((thumb) => thumb !== gesture.el)
    const index = others.filter((thumb) => {
      const rect = thumb.getBoundingClientRect()
      return rect.top + rect.height / 2 < center
    }).length
    const next = others.map((thumb) => thumb.dataset.pageId ?? '')
    next.splice(index, 0, gesture.pageId)
    if (!sameOrder(previewRef.current, next)) {
      previewRef.current = next
      setPreview(next)
    }
    follow(gesture)
  }

  // After the list re-orders, the thumbnail's resting place has moved: re-pin it to the pointer.
  useLayoutEffect(() => {
    if (drag.current?.active) follow(drag.current)
  }, [preview])

  const autoScroll = () => {
    const gesture = drag.current
    const list = listRef.current
    if (!gesture?.active || !list) return
    const rect = list.getBoundingClientRect()
    if (gesture.lastY < rect.top + SCROLL_EDGE) list.scrollTop -= SCROLL_SPEED
    else if (gesture.lastY > rect.bottom - SCROLL_EDGE) list.scrollTop += SCROLL_SPEED
    update(gesture)
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  const pickUp = (gesture: DragGesture) => {
    gesture.active = true
    setMenu(null)
    setDraggingId(gesture.pageId)
    previewRef.current = file.pages.map((page) => page.id)
    setPreview(previewRef.current)
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  const finish = (gesture: DragGesture, commit: boolean) => {
    window.clearTimeout(gesture.timer)
    cancelAnimationFrame(gesture.frame)
    gesture.cleanup()
    gesture.el.style.transform = ''
    drag.current = null
    if (!gesture.active) return
    if (commit && previewRef.current) useStore.getState().reorderPages(previewRef.current)
    previewRef.current = null
    setDraggingId(null)
    setPreview(null)
  }

  const onThumbDown = (event: ReactPointerEvent<HTMLDivElement>, pageId: string) => {
    // The rotate and menu buttons in the corners are not drag handles.
    if (event.button !== 0 || drag.current || (event.target as Element).closest('button')) return
    const el = event.currentTarget
    const pointerId = event.pointerId

    const onMove = (moveEvent: PointerEvent) => {
      const gesture = drag.current
      if (!gesture || moveEvent.pointerId !== pointerId) return
      gesture.lastY = moveEvent.clientY
      if (!gesture.active) {
        const travel = Math.hypot(moveEvent.clientX - gesture.startX, moveEvent.clientY - gesture.startY)
        if (gesture.isMouse && travel > DRAG_THRESHOLD) pickUp(gesture)
        // On touch, moving before the hold completes is a scroll of the list, not a drag.
        else if (!gesture.isMouse && travel > LONG_PRESS_SLOP) finish(gesture, false)
        return
      }
      update(gesture)
    }
    const onUp = (upEvent: PointerEvent) => {
      const gesture = drag.current
      if (!gesture || upEvent.pointerId !== pointerId) return
      const wasTap = !gesture.active
      finish(gesture, true)
      if (wasTap && upEvent.type === 'pointerup') jumpTo(pageId)
    }
    // Once a page is picked up on touch, the finger moves the page, not the list.
    const onTouchMove = (touchEvent: TouchEvent) => {
      if (drag.current?.active && touchEvent.cancelable) touchEvent.preventDefault()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    const gesture: DragGesture = {
      pageId,
      el,
      isMouse: event.pointerType === 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      lastY: event.clientY,
      grab: event.clientY - el.getBoundingClientRect().top,
      active: false,
      timer: 0,
      frame: 0,
      offset: 0,
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
    // Only on unmount: stop listening if the sidebar closes mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /* ---------- Page menu ---------- */

  const menuIndex = menu ? file.pages.findIndex((page) => page.id === menu.pageId) : -1

  const act = (action: () => void) => () => {
    setMenu(null)
    action()
  }

  const moveBy = (delta: number) => {
    const ids = file.pages.map((page) => page.id)
    const target = menuIndex + delta
    if (menuIndex < 0 || target < 0 || target >= ids.length) return
    ;[ids[menuIndex], ids[target]] = [ids[target], ids[menuIndex]]
    useStore.getState().reorderPages(ids)
  }

  return (
    <>
      {/* Anything outside the sidebar closes it. */}
      <div className="sidebar-backdrop" onClick={() => setSidebar('closed')} />
      <aside className="sidebar" aria-label="Pages">
        <div className="sidebar-list" ref={listRef} data-dragging={draggingId ? true : undefined}>
          <button
            type="button"
            className="organize-btn"
            aria-label="Reorder, merge, split or add pages"
            onClick={() => setSidebar('organize')}
          >
            {ORGANIZE_ROWS.map((row, rowIndex) => (
              <span key={rowIndex} className="organize-row">
                {row.map(({ label, icon: Icon }) => (
                  <span key={label} className="organize-item">
                    <Icon size={9} strokeWidth={2} aria-hidden />
                    {label}
                  </span>
                ))}
                {/* The arrow closes the bottom row, to the right of Split and Add. */}
                {rowIndex === ORGANIZE_ROWS.length - 1 && (
                  <MoveRight className="organize-arrow" size={18} strokeWidth={1.5} aria-hidden />
                )}
              </span>
            ))}
          </button>

          {pages.map((page, index) => (
            <div
              key={page.id}
              className="thumb"
              data-page-id={page.id}
              data-active={page.id === activeId || undefined}
              data-dragging={page.id === draggingId || undefined}
              onPointerDown={(event) => onThumbDown(event, page.id)}
            >
              <div className="thumb-page">
                <PageView file={file} page={page} width={THUMB_WIDTH} />
                <button
                  type="button"
                  className="corner-btn"
                  data-corner="top-right"
                  aria-label={`Rotate page ${index + 1}`}
                  onClick={() => useStore.getState().rotatePage(page.id)}
                >
                  <RotateCw size={10} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="corner-btn"
                  data-corner="bottom-right"
                  aria-label={`Options for page ${index + 1}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.pageId === page.id}
                  onClick={(event) => {
                    const anchor = event.currentTarget
                    setMenu((current) => (current?.pageId === page.id ? null : { pageId: page.id, anchor }))
                  }}
                >
                  <Ellipsis size={11} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <span className="thumb-num">{index + 1}</span>
            </div>
          ))}
        </div>
      </aside>

      {menu && menuIndex >= 0 && (
        <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={`Page ${menuIndex + 1}`}>
          <MenuItem icon={ArrowUp} label="Move up" disabled={menuIndex === 0} onSelect={act(() => moveBy(-1))} />
          <MenuItem
            icon={ArrowDown}
            label="Move down"
            disabled={menuIndex === file.pages.length - 1}
            onSelect={act(() => moveBy(1))}
          />
          <MenuDivider />
          <MenuItem
            icon={Copy}
            label="Duplicate"
            onSelect={act(() => useStore.getState().duplicatePage(menu.pageId))}
          />
          <MenuItem
            icon={RotateCw}
            label="Rotate"
            onSelect={act(() => useStore.getState().rotatePage(menu.pageId))}
          />
          <MenuItem icon={FileOutput} label="Extract" onSelect={act(() => setExtracting(menu.pageId))} />
          <MenuItem
            icon={Trash2}
            label="Delete"
            tone="danger"
            // A file always keeps at least one page.
            disabled={file.pages.length === 1}
            onSelect={act(() => useStore.getState().deletePage(menu.pageId))}
          />
        </FloatingMenu>
      )}

      {extracting && <ExtractDialog file={file} pageIds={[extracting]} onClose={() => setExtracting(null)} />}
    </>
  )
}
