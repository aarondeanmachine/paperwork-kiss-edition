import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Ellipsis,
  Link2,
  List,
  Sparkle,
  Italic,
  Underline,
  type LucideIcon,
} from 'lucide-react'
import { placeCaretAtEnd } from '../lib/caret'
import {
  TEXT_COLORS,
  boxState,
  caretOnly,
  colorValue,
  formatSelection,
  hasBullets,
  selectionState,
  type InlineCommand,
  type InlineState,
} from '../lib/richtext'
import { useStore } from '../store'
import type { TextAlign, TextFont, TextObject, TextSize } from '../types'
import { AgentChat } from './AgentChat'

type Panel = 'color' | 'font' | 'size' | 'more' | null

const FONTS: { value: TextFont; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'handwritten', label: 'Hand' },
  { value: 'typewriter', label: 'Type' },
]

const SIZES: { value: TextSize; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Extra' },
]

const ALIGNS: { value: TextAlign; label: string; icon: LucideIcon }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
]

/** Which end of the toolbar each option row lines up with (under its own button). */
const PANEL_ALIGN = { color: 'start', font: 'start', size: 'center', more: 'end' } as const

const BAR_HEIGHT = 36
/** Space between the toolbar and the selection box. */
const GAP = 12
/** Minimum space between the toolbar and the frame edges. */
const EDGE = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * The dark toolbar that floats above the text box being edited (Exhibit B).
 * It only exists in the Text tool; a box selected with the cursor has no toolbar.
 * Each control opens a row of options above the toolbar; the ellipsis row holds
 * link, bullets, alignment and Ask agent.
 */
export function FormatBar({ object }: { object: TextObject }) {
  const showToast = useStore((state) => state.showToast)
  const [panel, setPanel] = useState<Panel>(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [live, setLive] = useState<InlineState | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const contentEl = () => document.querySelector<HTMLElement>(`.canvas [data-obj-id="${object.id}"] .text-content`)

  /* ---------- Position: above the box, flipping below when there is no room ---------- */

  const reposition = useCallback(() => {
    const anchor = anchorRef.current
    const editor = anchor?.parentElement
    const box = editor?.querySelector(`.canvas [data-obj-id="${object.id}"]`)
    const canvas = editor?.querySelector('.canvas')
    const dock = editor?.querySelector('.toolbar')
    if (!anchor || !editor || !box || !canvas || !dock) return
    const frame = editor.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    const top = canvas.getBoundingClientRect().top - frame.top
    const bottom = dock.getBoundingClientRect().top - frame.top - EDGE
    const boxTop = boxRect.top - frame.top
    const boxBottom = boxRect.bottom - frame.top

    // The toolbar itself must clear the top bar. Its option rows and the chat may overlap
    // the top bar, but nothing may leave the frame.
    const height = anchor.offsetHeight
    const fitsAbove = boxTop - GAP - BAR_HEIGHT >= top && boxTop - GAP - height >= EDGE
    const fitsBelow = boxBottom + GAP + height <= bottom
    const side = !fitsAbove && fitsBelow ? 'below' : 'above'
    // When neither side has room (a box taller than the view), it stays pinned inside the canvas.
    const y =
      side === 'above'
        ? clamp(boxTop - GAP, Math.max(top + BAR_HEIGHT + EDGE, height + EDGE), bottom)
        : boxBottom + GAP
    const half = anchor.offsetWidth / 2
    const x = clamp(boxRect.left + boxRect.width / 2 - frame.left, EDGE + half, frame.width - EDGE - half)

    anchor.dataset.side = side
    anchor.style.left = `${x}px`
    anchor.style.top = `${y}px`
  }, [object.id])

  // Runs after every render: the box may have moved, re-wrapped or the toolbar changed size.
  useLayoutEffect(reposition)

  useEffect(() => {
    const canvas = anchorRef.current?.parentElement?.querySelector('.canvas')
    canvas?.addEventListener('scroll', reposition, { passive: true })
    window.addEventListener('resize', reposition)
    return () => {
      canvas?.removeEventListener('scroll', reposition)
      window.removeEventListener('resize', reposition)
    }
  }, [reposition])

  /* ---------- State shown on the buttons ---------- */

  // With words highlighted the buttons describe those words. With only a caret, bold, underline
  // and italic describe the whole box, because that is what pressing them will change.
  const readState = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`.canvas [data-obj-id="${object.id}"] .text-content`)
    if (!el || el.closest('[data-editing]') === null) return
    const state = selectionState()
    setLive(caretOnly(el) && el.textContent ? { ...state, ...boxState(el.innerHTML) } : state)
  }, [object.id])

  useEffect(() => {
    readState()
    document.addEventListener('selectionchange', readState)
    return () => document.removeEventListener('selectionchange', readState)
  }, [readState, object.html])

  const bold = live?.bold ?? false
  const underline = live?.underline ?? false
  const italic = live?.italic ?? false
  const color = live ? live.color : object.color
  const bullets = hasBullets(object.html)

  /* ---------- Applying changes ---------- */

  // Undo needs no bookkeeping here: the edit session already holds the undo point.

  /** Bold, underline, italic, color and bullets: the highlighted words, or the whole box with only a caret. */
  const applyInline = (command: InlineCommand, value?: string, wholeBoxPatch: Partial<TextObject> = {}) => {
    const el = contentEl()
    if (!el) return
    const wholeBox = caretOnly(el)
    formatSelection(el, command, value)
    if (wholeBox) useStore.getState().updateObject(object.id, wholeBoxPatch)
    readState()
  }

  /** Font, size and alignment always belong to the whole box. */
  const applyBox = (patch: Partial<TextObject>) => useStore.getState().updateObject(object.id, patch)

  /** Leaving the chat puts the caret back in the box, ready to keep typing. */
  const closeAgent = () => {
    setAgentOpen(false)
    const el = contentEl()
    if (!el) return
    el.focus({ preventScroll: true })
    placeCaretAtEnd(el)
  }

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next))
  const sizeLabel = SIZES.find((size) => size.value === object.size)?.label

  return (
    <div
      ref={anchorRef}
      className="format-anchor"
      data-align={panel ? PANEL_ALIGN[panel] : undefined}
      // Pressing the toolbar must not take focus (and the text selection) away from the box.
      onMouseDown={(event) => {
        if (!(event.target as Element).closest('input')) event.preventDefault()
      }}
    >
      {agentOpen ? (
        <AgentChat onClose={closeAgent} onResize={reposition} />
      ) : (
        <>
          <div className="format-bar" role="toolbar" aria-label="Text formatting">
            <BarButton label="Text color" expanded={panel === 'color'} onClick={() => toggle('color')}>
              <span
                className="swatch"
                style={color ? { background: `var(--doc-color-${color})` } : undefined}
                data-mixed={color ? undefined : true}
              />
              <ChevronDown size={12} strokeWidth={2} aria-hidden />
            </BarButton>
            <span className="format-divider" />
            <BarButton label="Font" expanded={panel === 'font'} onClick={() => toggle('font')}>
              <span className="format-aa" data-font={object.font}>
                Aa
              </span>
              <ChevronDown size={12} strokeWidth={2} aria-hidden />
            </BarButton>
            <span className="format-divider" />
            <BarButton label="Text size" expanded={panel === 'size'} onClick={() => toggle('size')} className="format-size">
              <span>{sizeLabel}</span>
              <ChevronDown size={12} strokeWidth={2} aria-hidden />
            </BarButton>
            <span className="format-divider" />
            <BarButton label="Bold" pressed={bold} onClick={() => applyInline('bold')}>
              <Bold size={16} strokeWidth={2} aria-hidden />
            </BarButton>
            <BarButton label="Underline" pressed={underline} onClick={() => applyInline('underline')}>
              <Underline size={16} strokeWidth={1.75} aria-hidden />
            </BarButton>
            <BarButton label="Italic" pressed={italic} onClick={() => applyInline('italic')}>
              <Italic size={16} strokeWidth={1.75} aria-hidden />
            </BarButton>
            <span className="format-divider" />
            <BarButton label="More options" expanded={panel === 'more'} onClick={() => toggle('more')}>
              <Ellipsis size={16} strokeWidth={1.75} aria-hidden />
            </BarButton>
          </div>

          {panel === 'color' && (
            <div className="format-bar format-row" role="group" aria-label="Text color">
              {TEXT_COLORS.map((option) => (
                <BarButton
                  key={option}
                  label={option}
                  pressed={color === option}
                  onClick={() => applyInline('foreColor', colorValue(option), { color: option })}
                >
                  <span className="swatch" style={{ background: `var(--doc-color-${option})` }} />
                </BarButton>
              ))}
            </div>
          )}

          {panel === 'font' && (
            <div className="format-bar format-row" role="group" aria-label="Font">
              {FONTS.map((option) => (
                <BarButton
                  key={option.value}
                  label={option.label}
                  pressed={object.font === option.value}
                  onClick={() => applyBox({ font: option.value })}
                >
                  <span className="format-font" data-font={option.value}>
                    {option.label}
                  </span>
                </BarButton>
              ))}
            </div>
          )}

          {panel === 'size' && (
            <div className="format-bar format-row" role="group" aria-label="Text size">
              {SIZES.map((option) => (
                <BarButton
                  key={option.value}
                  label={option.label}
                  pressed={object.size === option.value}
                  onClick={() => applyBox({ size: option.value })}
                >
                  <span>{option.label}</span>
                </BarButton>
              ))}
            </div>
          )}

          {panel === 'more' && (
            <div className="format-bar format-row" role="group" aria-label="More options">
              {/* Links are not part of this version: the button is here for the layout only. */}
              <BarButton label="Link" onClick={() => showToast('Links are not part of this mockup')}>
                <Link2 size={16} strokeWidth={1.75} aria-hidden />
              </BarButton>
              <BarButton label="Bullet list" pressed={bullets} onClick={() => applyInline('insertUnorderedList')}>
                <List size={16} strokeWidth={1.75} aria-hidden />
              </BarButton>
              <span className="format-divider" />
              {ALIGNS.map(({ value, label, icon: Icon }) => (
                <BarButton
                  key={value}
                  label={label}
                  pressed={object.align === value}
                  onClick={() => applyBox({ align: value })}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </BarButton>
              ))}
              <span className="format-divider" />
              <BarButton
                label="Ask agent"
                onClick={() => {
                  setPanel(null)
                  setAgentOpen(true)
                }}
              >
                <Sparkle size={16} strokeWidth={1.5} aria-hidden />
                <span>Ask agent</span>
              </BarButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface BarButtonProps {
  label: string
  pressed?: boolean
  expanded?: boolean
  className?: string
  onClick: () => void
  children: ReactNode
}

function BarButton({ label, pressed, expanded, className, onClick, children }: BarButtonProps) {
  return (
    <button
      type="button"
      className={`format-btn ${className ?? ''}`}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
