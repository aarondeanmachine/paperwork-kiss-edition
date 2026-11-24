import type { Block, BlockRole } from '../data/manifesto'
import type { DocObject, Page, TextObject } from '../types'
import { uid } from './id'

/** Letter-proportioned page, sized to fit the 390px frame with 12px gutters. */
export const PAGE_WIDTH = 366
export const PAGE_HEIGHT = 474
export const PAGE_MARGIN = 24
export const MIN_TEXT_WIDTH = 48

/** Sizes shared by everything that places signature boxes and form fields. */
export const SIGNATURE_BOX_HEIGHT = 48
export const FIELD_HEIGHT = 24
/** Space between stacked fields. */
export const FIELD_GAP = 6
/** Height of a line object's box. The stroke itself is 1px, along the middle. */
export const LINE_BOX_HEIGHT = 8

const GAP_AFTER: Record<BlockRole, number> = { label: 2, title: 10, heading: 4, body: 8 }
const EXTRA_BEFORE_HEADING = 6

/** Measures the rendered height of a text box at a given width. */
export function measureTextHeight(html: string, size: string, width: number): number {
  const root = document.createElement('div')
  root.className = 'measure-root'
  const el = document.createElement('div')
  el.className = 'text-content'
  el.dataset.size = size
  el.style.width = `${width}px`
  el.innerHTML = html
  root.appendChild(el)
  document.body.appendChild(root)
  const height = Math.ceil(el.getBoundingClientRect().height)
  root.remove()
  return height
}

/**
 * Flows paragraph blocks down the page, starting a new page when one is full.
 * @param reserveOnFirstPage space (px) kept free at the foot of the first page.
 */
export function layoutBlocks(blocks: Block[], reserveOnFirstPage = 0): { pages: Page[]; objects: DocObject[] } {
  const pages: Page[] = [{ id: uid('page'), height: PAGE_HEIGHT, rotation: 0 }]
  const objects: DocObject[] = []
  const width = PAGE_WIDTH - PAGE_MARGIN * 2
  const heights = blocks.map((block) => measureTextHeight(block.html, block.size, width))
  let y = PAGE_MARGIN

  blocks.forEach((block, index) => {
    const height = heights[index]
    const bottom = PAGE_HEIGHT - PAGE_MARGIN - (pages.length === 1 ? reserveOnFirstPage : 0)
    const atTop = y === PAGE_MARGIN
    let before = block.role === 'heading' && !atTop ? EXTRA_BEFORE_HEADING : 0
    // A heading stays with the paragraph after it. Paragraphs never split, so it needs room for all of it.
    const withNext = block.role === 'heading' && index + 1 < blocks.length
    const needed = height + (withNext ? GAP_AFTER.heading + heights[index + 1] : 0)

    if (!atTop && y + before + needed > bottom) {
      pages.push({ id: uid('page'), height: PAGE_HEIGHT, rotation: 0 })
      y = PAGE_MARGIN
      before = 0
    }

    const object: TextObject = {
      id: uid('obj'),
      pageId: pages[pages.length - 1].id,
      type: 'text',
      x: PAGE_MARGIN,
      y: y + before,
      width,
      height,
      html: block.html,
      size: block.size,
      font: 'formal',
      color: 'black',
      align: 'left',
    }
    objects.push(object)
    y += before + height + GAP_AFTER[block.role]
  })

  return { pages, objects }
}
