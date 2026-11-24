import { memo, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { textProps } from '../components/textProps'
import { placeCaretAtEnd, placeCaretAtPoint } from '../lib/caret'
import { MIN_TEXT_WIDTH } from '../lib/layout'
import { useStore } from '../store'
import type { TextObject } from '../types'
import { ObjectFrame } from './ObjectFrame'

/**
 * One text box on the page.
 * Cursor tool: tap selects, drag moves, tapping the selected box starts editing.
 * Text tool: tap starts editing straight away.
 */
export const TextBox = memo(function TextBox({ object }: { object: TextObject }) {
  const editing = useStore((state) => state.editingId === object.id)
  const contentRef = useRef<HTMLDivElement>(null)

  // While editing, the DOM owns the text. Otherwise the store does (undo, redo, first paint).
  useLayoutEffect(() => {
    const el = contentRef.current
    if (el && !editing && el.innerHTML !== object.html) el.innerHTML = object.html
  }, [object.html, editing])

  // Focus when editing starts; drop focus and any text selection when it ends.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el || !editing) return
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true })
      placeCaretAtEnd(el)
    }
    return () => {
      el.blur()
      window.getSelection()?.removeAllRanges()
    }
  }, [editing])

  // Height always follows the text (re-wrap on resize, undo, font changes). No pushing here.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const state = useStore.getState()
      const current = state.snapshot().objects.find((item) => item.id === object.id)
      if (current && current.height !== el.offsetHeight) state.updateObject(object.id, { height: el.offsetHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [object.id])

  const onTap = (event: ReactPointerEvent<HTMLDivElement>, wasSelected: boolean) => {
    const state = useStore.getState()
    if (state.tool === 'text' || wasSelected) {
      flushSync(() => state.startEditing(object.id))
      if (contentRef.current) placeCaretAtPoint(contentRef.current, event.clientX, event.clientY)
    } else {
      state.select(object.id)
    }
  }

  return (
    <ObjectFrame
      object={object}
      resize="width"
      minWidth={MIN_TEXT_WIDTH}
      className="obj-text"
      locked={editing}
      onTap={onTap}
    >
      <div
        ref={contentRef}
        {...textProps(object)}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={(event) => {
          const el = event.currentTarget
          useStore.getState().typeInto(object.id, el.innerHTML, el.offsetHeight)
        }}
        onPaste={(event) => {
          // Paste as plain text so foreign styling never lands on the page.
          event.preventDefault()
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
        }}
      />
    </ObjectFrame>
  )
})
