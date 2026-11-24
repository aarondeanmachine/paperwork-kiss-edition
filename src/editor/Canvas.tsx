import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { clientToPage } from '../lib/geometry'
import { PAGE_WIDTH } from '../lib/layout'
import { useStore } from '../store'
import type { DocFile } from '../types'
import { EditorPage } from './EditorPage'

const GUTTER = 12

/** The scrolling stack of pages. Pages are drawn at the frame width less the gutters (366px at 390px). */
export function Canvas({ file }: { file: DocFile }) {
  const tool = useStore((state) => state.tool)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pressStartedInObject = useRef(false)
  const [pageWidth, setPageWidth] = useState(PAGE_WIDTH)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setPageWidth(el.clientWidth - GUTTER * 2)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** A tap that is not on an object: deselect, or (Text tool) start a new text box. */
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element
    // Ignore presses that began in a box, e.g. a text selection dragged past its edge.
    if (pressStartedInObject.current || target.closest('.obj')) return
    const state = useStore.getState()
    if (state.selectedId) {
      // Commits the edit and removes the box if it is empty. The tool stays as it is.
      state.deselect()
      return
    }
    if (state.tool !== 'text') return
    const page = target.closest<HTMLElement>('.page')
    if (!page?.dataset.pageId) return
    const pageId = page.dataset.pageId
    const point = clientToPage(page, event.clientX, event.clientY)
    // Rendered synchronously so the new box takes focus inside this tap (opens the keyboard on phones).
    flushSync(() => {
      state.createTextBox(pageId, point.x, point.y)
    })
  }

  return (
    <div
      className="canvas"
      data-tool={tool}
      ref={scrollRef}
      onPointerDownCapture={(event) => {
        pressStartedInObject.current = Boolean((event.target as Element).closest('.obj'))
      }}
      onClick={onClick}
    >
      <div className="canvas-pages">
        {file.pages.map((page) => (
          <EditorPage key={page.id} file={file} page={page} width={pageWidth} />
        ))}
      </div>
    </div>
  )
}
