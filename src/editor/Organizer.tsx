import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Library, Plus, Redo2, RotateCw, Scissors, Undo2, Upload } from 'lucide-react'
import { FloatingMenu } from '../components/FloatingMenu'
import { PageView } from '../components/PageView'
import { MenuDivider, MenuItem } from '../components/Popover'
import { PAGE_HEIGHT, PAGE_WIDTH } from '../lib/layout'
import { useStore } from '../store'
import type { DocFile } from '../types'
import { ExtractDialog } from './ExtractDialog'

const COLUMNS = 3
/** Width of the strip before, between and after pages that holds the add / split button. */
const GAP_WIDTH = 32
const GHOST_WIDTH = 56
/** Mouse: travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4
/** Touch: a still press this long (ms) picks pages up; moving sooner scrolls the grid. */
const LONG_PRESS = 280
const LONG_PRESS_SLOP = 8
const SCROLL_EDGE = 56
const SCROLL_SPEED = 8
/** Extract needs more than one page selected. */
const EXTRACT_MINIMUM = 2

/** Where dragged pages would land: before a page, or after the last page of a row. */
interface DropTarget {
  index: number
  side: 'before' | 'after'
}

interface DragGesture {
  pageId: string
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

/**
 * The full-screen page organizer: three pages to a row. Pages can be selected,
 * dragged as a group to a new place (a line shows where they will land), rotated
 * and extracted. The button between pages adds a file there, or splits (not built).
 */
export function Organizer({ file }: { file: DocFile }) {
  const setSidebar = useStore((state) => state.setSidebar)
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)
  const canUndo = useStore((state) => state.canUndo)
  const canRedo = useStore((state) => state.canRedo)
  const showToast = useStore((state) => state.showToast)

  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragGesture | null>(null)
  const dropRef = useRef<DropTarget | null>(null)
  const movingRef = useRef<string[] | null>(null)

  const [thumbWidth, setThumbWidth] = useState(100)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [moving, setMoving] = useState<string[] | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [insert, setInsert] = useState<(DropTarget & { anchor: HTMLElement }) | null>(null)
  const [naming, setNaming] = useState(false)

  const pages = file.pages
  // Selected pages in document order. Pages removed by undo simply drop out.
  const chosen = pages.filter((page) => selected.has(page.id)).map((page) => page.id)
  const slotHeight = Math.round((thumbWidth * PAGE_HEIGHT) / PAGE_WIDTH)
  const rows: (typeof pages)[] = []
  for (let start = 0; start < pages.length; start += COLUMNS) rows.push(pages.slice(start, start + COLUMNS))

  // Thumbnails shrink to whatever fits three across.
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const update = () => setThumbWidth(Math.floor((grid.clientWidth - GAP_WIDTH * (COLUMNS + 1)) / COLUMNS))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const toggle = (pageId: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(pageId)) next.add(pageId)
      return next
    })

  /* ---------- Drag a page, or the selected group ---------- */

  const placeGhost = (gesture: DragGesture) => {
    const root = rootRef.current?.getBoundingClientRect()
    if (!root || !ghostRef.current) return
    ghostRef.current.style.transform = `translate(${gesture.lastX - root.left}px, ${gesture.lastY - root.top}px)`
  }

  /** The gap nearest the pointer: in the row it is over, before the first page whose middle is to its right. */
  const findDrop = (gesture: DragGesture): DropTarget | null => {
    const cells = [...(gridRef.current?.querySelectorAll<HTMLElement>('.org-cell') ?? [])]
    let row: string | undefined
    let nearest = Infinity
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect()
      const distance = Math.max(rect.top - gesture.lastY, gesture.lastY - rect.bottom, 0)
      if (distance < nearest) {
        nearest = distance
        row = cell.dataset.row
      }
    }
    const inRow = cells.filter((cell) => cell.dataset.row === row)
    if (inRow.length === 0) return null
    for (const cell of inRow) {
      const rect = cell.getBoundingClientRect()
      if (gesture.lastX < rect.left + rect.width / 2) return { index: Number(cell.dataset.index), side: 'before' }
    }
    return { index: Number(inRow[inRow.length - 1].dataset.index) + 1, side: 'after' }
  }

  const track = (gesture: DragGesture) => {
    placeGhost(gesture)
    const next = findDrop(gesture)
    const current = dropRef.current
    if (next?.index !== current?.index || next?.side !== current?.side) {
      dropRef.current = next
      setDrop(next)
    }
  }

  // The ghost mounts when a drag starts: put it under the pointer before it is painted.
  useLayoutEffect(() => {
    if (moving && drag.current) placeGhost(drag.current)
  }, [moving])

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
    setInsert(null)
    // A selected page brings the whole selection with it; any other page moves alone.
    movingRef.current = selected.has(gesture.pageId) ? chosen : [gesture.pageId]
    setMoving(movingRef.current)
    gesture.frame = requestAnimationFrame(autoScroll)
  }

  /** Lifts the moved pages out and sets them down, in their original order, at the drop point. */
  const move = (ids: string[], target: DropTarget) => {
    const lifted = new Set(ids)
    const rest = pages.filter((page) => !lifted.has(page.id)).map((page) => page.id)
    const at = pages.slice(0, target.index).filter((page) => !lifted.has(page.id)).length
    const next = [...rest.slice(0, at), ...ids, ...rest.slice(at)]
    if (next.some((id, index) => id !== pages[index].id)) useStore.getState().reorderPages(next)
  }

  const finish = (gesture: DragGesture, commit: boolean) => {
    window.clearTimeout(gesture.timer)
    cancelAnimationFrame(gesture.frame)
    gesture.cleanup()
    drag.current = null
    if (!gesture.active) return
    if (commit && movingRef.current && dropRef.current) move(movingRef.current, dropRef.current)
    movingRef.current = null
    dropRef.current = null
    setMoving(null)
    setDrop(null)
  }

  const onCellDown = (event: ReactPointerEvent<HTMLDivElement>, pageId: string) => {
    // The selector and rotate buttons are not drag handles.
    if (event.button !== 0 || drag.current || (event.target as Element).closest('button')) return
    const pointerId = event.pointerId

    const onMove = (moveEvent: PointerEvent) => {
      const gesture = drag.current
      if (!gesture || moveEvent.pointerId !== pointerId) return
      gesture.lastX = moveEvent.clientX
      gesture.lastY = moveEvent.clientY
      if (!gesture.active) {
        const travel = Math.hypot(moveEvent.clientX - gesture.startX, moveEvent.clientY - gesture.startY)
        if (gesture.isMouse && travel > DRAG_THRESHOLD) pickUp(gesture)
        // On touch, moving before the hold completes is a scroll of the grid, not a drag.
        else if (!gesture.isMouse && travel > LONG_PRESS_SLOP) finish(gesture, false)
        return
      }
      track(gesture)
    }
    const onUp = (upEvent: PointerEvent) => {
      const gesture = drag.current
      if (!gesture || upEvent.pointerId !== pointerId) return
      const wasTap = !gesture.active
      finish(gesture, upEvent.type === 'pointerup')
      // A tap anywhere on a page selects it, the same as its selector.
      if (wasTap && upEvent.type === 'pointerup') toggle(pageId)
    }
    // Once pages are picked up on touch, the finger moves them, not the grid.
    const onTouchMove = (touchEvent: TouchEvent) => {
      if (drag.current?.active && touchEvent.cancelable) touchEvent.preventDefault()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    const gesture: DragGesture = {
      pageId,
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
    // Only on unmount: stop listening if the organizer closes mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /* ---------- The add / split button between pages ---------- */

  const addAt = (index: number) => {
    // No real upload or library in the mockup: either choice adds a blank page here.
    setInsert(null)
    useStore.getState().insertPage(index)
    showToast('Blank page added')
  }

  const splitHere = () => {
    // Split is shown for the layout only.
    setInsert(null)
    showToast('Split is not part of this mockup')
  }

  /** One tall rounded button per gap: + over scissors with a divider between. Both lead to the same menu. */
  const gap = (index: number, side: DropTarget['side']) => (
    <div
      className="org-gap"
      style={{ height: slotHeight }}
      data-drop={(drop?.index === index && drop.side === side) || undefined}
    >
      <button
        type="button"
        className="gap-btn"
        aria-label={`Add or split at position ${index + 1}`}
        aria-haspopup="menu"
        aria-expanded={insert?.index === index && insert.side === side}
        onClick={(event) => {
          const anchor = event.currentTarget
          setInsert((current) => (current?.anchor === anchor ? null : { index, side, anchor }))
        }}
      >
        <Plus size={9} strokeWidth={2} aria-hidden />
        <span className="gap-btn-divider" />
        <Scissors size={9} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )

  const grabbed = moving && drag.current ? pages.find((page) => page.id === drag.current?.pageId) : undefined

  return (
    <div className="organizer" ref={rootRef}>
      <header className="org-bar">
        <div className="topbar-group">
          <button type="button" className="icon-btn" aria-label="Undo" aria-disabled={!canUndo} onClick={undo}>
            <Undo2 size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" className="icon-btn" aria-label="Redo" aria-disabled={!canRedo} onClick={redo}>
            <Redo2 size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={chosen.length < EXTRACT_MINIMUM}
          onClick={() => setNaming(true)}
        >
          Extract
        </button>
        <button type="button" className="btn-primary" onClick={() => setSidebar('list')}>
          Done
        </button>
      </header>

      <div className="org-grid" ref={gridRef} data-dragging={moving ? true : undefined}>
        {rows.map((row, rowIndex) => (
          <div className="org-row" key={row[0].id}>
            {row.map((page, column) => {
              const index = rowIndex * COLUMNS + column
              const isSelected = selected.has(page.id)
              return (
                <Fragment key={page.id}>
                  {gap(index, 'before')}
                  <div
                    className="org-cell"
                    style={{ width: thumbWidth }}
                    data-page-id={page.id}
                    data-index={index}
                    data-row={rowIndex}
                    aria-selected={isSelected}
                    data-selected={isSelected || undefined}
                    data-moving={moving?.includes(page.id) || undefined}
                    onPointerDown={(event) => onCellDown(event, page.id)}
                  >
                    <div className="org-slot" style={{ height: slotHeight }}>
                      <div className="org-thumb">
                        <PageView file={file} page={page} width={thumbWidth} fullHeight={false} />
                        {/* The check appears only once a page is selected; tapping the page selects it. */}
                        {isSelected && (
                          <button
                            type="button"
                            className="select-dot"
                            aria-label={`Deselect page ${index + 1}`}
                            onClick={() => toggle(page.id)}
                          >
                            <Check size={10} strokeWidth={3} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          className="corner-btn"
                          data-corner="top-right"
                          aria-label={`Rotate page ${index + 1}`}
                          onClick={() => useStore.getState().rotatePage(page.id)}
                        >
                          <RotateCw size={10} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <span className="thumb-num">{index + 1}</span>
                  </div>
                  {column === row.length - 1 && gap(index + 1, 'after')}
                </Fragment>
              )
            })}
          </div>
        ))}
      </div>

      {moving && grabbed && (
        <div className="org-ghost" ref={ghostRef} aria-hidden>
          <PageView file={file} page={grabbed} width={GHOST_WIDTH} fullHeight={false} />
          {moving.length > 1 && <span className="org-ghost-count">{moving.length}</span>}
        </div>
      )}

      {insert && (
        <FloatingMenu anchor={insert.anchor} onClose={() => setInsert(null)} label="Add a file here">
          <MenuItem icon={Upload} label="Upload from device" onSelect={() => addAt(insert.index)} />
          <MenuItem icon={Library} label="Select from library" onSelect={() => addAt(insert.index)} />
          <MenuDivider />
          <MenuItem icon={Scissors} label="Split file here" onSelect={splitHere} />
        </FloatingMenu>
      )}

      {naming && <ExtractDialog file={file} pageIds={chosen} onClose={() => setNaming(false)} />}
    </div>
  )
}
