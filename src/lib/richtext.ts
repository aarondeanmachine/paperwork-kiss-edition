import type { TextColor } from '../types'
import { placeCaretAtEnd } from './caret'

/**
 * Rich-text commands for the text box being edited.
 * With words highlighted they change just those words. With only a caret they
 * change the whole box, so a paragraph can be restyled in one tap.
 */

export type InlineCommand = 'bold' | 'underline' | 'italic' | 'foreColor' | 'insertUnorderedList'

export const TEXT_COLORS: TextColor[] = ['black', 'gray', 'red', 'orange', 'green', 'blue']

export interface InlineState {
  bold: boolean
  underline: boolean
  italic: boolean
  /** Null when the selection's color is not one of the six, or is mixed. */
  color: TextColor | null
}

/** Resolves a color token to its value, e.g. 'red' -> '#d5443a'. tokens.css stays the single source. */
export function colorValue(color: TextColor): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--doc-color-${color}`).trim()
}

function selectAll(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** The caret's position as a count of characters from the start of the box. */
function caretOffset(el: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return 0
  const range = document.createRange()
  range.selectNodeContents(el)
  range.setEnd(selection.focusNode ?? el, selection.focusOffset)
  return range.toString().length
}

function setCaretOffset(el: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let remaining = offset
  while (walker.nextNode()) {
    const length = walker.currentNode.textContent?.length ?? 0
    if (remaining <= length) {
      const range = document.createRange()
      range.setStart(walker.currentNode, remaining)
      range.collapse(true)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      return
    }
    remaining -= length
  }
  placeCaretAtEnd(el)
}

/** True when the box is focused with a caret only, i.e. no words are highlighted. */
export function caretOnly(el: HTMLElement): boolean {
  const selection = window.getSelection()
  return !selection || selection.isCollapsed || !el.contains(selection.anchorNode)
}

/**
 * Applies a command in the box being edited: to the highlighted words, or to the
 * whole box when nothing is highlighted. Bullets always apply to the whole box.
 */
export function formatSelection(el: HTMLElement, command: InlineCommand, value?: string): void {
  const selection = window.getSelection()
  if (!selection || !el.contains(selection.anchorNode)) {
    el.focus({ preventScroll: true })
    placeCaretAtEnd(el)
  }
  document.execCommand('styleWithCSS', false, 'false')
  const wholeBox = command === 'insertUnorderedList' || caretOnly(el)
  // In an empty box there is nothing to restyle: the command sets the style for what is typed next.
  if (!wholeBox || !el.textContent) {
    document.execCommand(command, false, value)
    return
  }
  const offset = caretOffset(el)
  selectAll(el)
  document.execCommand(command, false, value)
  setCaretOffset(el, offset)
}

function toRgb(value: string): string {
  const probe = document.createElement('span')
  probe.style.color = value
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  return rgb
}

/** Bold, underline, italic and color at the caret or across the highlighted words. */
export function selectionState(): InlineState {
  const current = toRgb(document.queryCommandValue('foreColor'))
  return {
    bold: document.queryCommandState('bold'),
    underline: document.queryCommandState('underline'),
    italic: document.queryCommandState('italic'),
    color: TEXT_COLORS.find((color) => toRgb(colorValue(color)) === current) ?? null,
  }
}

/** True when every visible character of the markup sits inside one of the given tags. */
function allTextInside(html: string, selector: string): boolean {
  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  let found = false
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!node.textContent?.trim()) continue
    found = true
    if (!node.parentElement?.closest(selector)) return false
  }
  return found
}

/** Bold, underline and italic for a whole box, read from its markup. */
export function boxState(html: string): Pick<InlineState, 'bold' | 'underline' | 'italic'> {
  return {
    bold: allTextInside(html, 'b, strong'),
    underline: allTextInside(html, 'u'),
    italic: allTextInside(html, 'i, em'),
  }
}

export function hasBullets(html: string): boolean {
  return /<ul[\s>]/i.test(html)
}
