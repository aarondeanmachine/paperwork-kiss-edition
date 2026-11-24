/** Caret helpers for the contentEditable text boxes. */

export function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Puts the caret where the user tapped, falling back to the end of the text. */
export function placeCaretAtPoint(el: HTMLElement, clientX: number, clientY: number): void {
  let range: Range | null = null
  if ('caretPositionFromPoint' in document) {
    const position = document.caretPositionFromPoint(clientX, clientY)
    if (position) {
      range = document.createRange()
      range.setStart(position.offsetNode, position.offset)
    }
  } else if ('caretRangeFromPoint' in document) {
    range = (document as Document).caretRangeFromPoint(clientX, clientY)
  }
  if (!range || !el.contains(range.startContainer)) {
    placeCaretAtEnd(el)
    return
  }
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** True when a box holds no visible text (tags, spaces and line breaks only). */
export function isEmptyHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|​/g, ' ')
      .trim() === ''
  )
}
