import { uid } from '../lib/id'
import { LINE_BOX_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, layoutBlocks, measureTextHeight } from '../lib/layout'
import type { DocObject, Page } from '../types'
import { manifestoBlocks } from './manifesto'

/**
 * The sample document: the culture manifesto, with two columns of signature
 * lines on the first page. Each line and each caption under it is an ordinary
 * object on the canvas (a line and a small text box), so they can be selected,
 * moved and edited like the rest of the page. The demo is placing signature and
 * field boxes on top of them.
 */

/** What each column asks for, top to bottom. */
const LINE_LABELS = ['Signature', 'Name', 'Email', 'Title', 'Address', 'Date Signed']

/** Space between the two columns. */
const COLUMN_GAP = 14
/** Space between the text on the first page and the lines. */
const SPACE_ABOVE = 18
/** Blank space above the signature line, and above every other line: room for a box to sit on it. */
const SIGNATURE_SPACE = 37
const FIELD_SPACE = 25
/** From a line down to the bottom of its caption. */
const CAPTION_SPACE = 17
/** Gap between a line and the top of its caption: the caption starts where the line's box ends, so neither covers the other. */
const CAPTION_GAP = LINE_BOX_HEIGHT / 2

const rowHeight = (index: number) => (index === 0 ? SIGNATURE_SPACE : FIELD_SPACE) + CAPTION_SPACE
const COLUMN_HEIGHT = LINE_LABELS.reduce((total, _label, index) => total + rowHeight(index), 0)

/** One column: for each label, a line with a small grey caption beneath it. */
function signatureLines(pageId: string, x: number, top: number, width: number): DocObject[] {
  const captionHeight = measureTextHeight(LINE_LABELS[0], 'sm', width)
  let y = top
  return LINE_LABELS.flatMap((label, index): DocObject[] => {
    y += rowHeight(index)
    // Where the drawn line itself sits. Its box is taller than the stroke, so it is easy to tap.
    const stroke = y - CAPTION_SPACE
    return [
      {
        id: uid('obj'),
        pageId,
        type: 'line',
        x,
        y: stroke - LINE_BOX_HEIGHT / 2,
        width,
        height: LINE_BOX_HEIGHT,
      },
      {
        id: uid('obj'),
        pageId,
        type: 'text',
        x,
        y: stroke + CAPTION_GAP,
        width,
        height: captionHeight,
        html: label,
        size: 'sm',
        font: 'formal',
        color: 'gray',
        align: 'left',
      },
    ]
  })
}

export function buildSample(): { pages: Page[]; objects: DocObject[] } {
  // The text leaves room at the foot of the first page for the signature lines.
  const { pages, objects } = layoutBlocks(manifestoBlocks, COLUMN_HEIGHT + SPACE_ABOVE)
  const firstPage = pages[0].id
  const textEnd = Math.max(
    PAGE_MARGIN,
    ...objects.filter((object) => object.pageId === firstPage).map((object) => object.y + object.height),
  )
  const width = (PAGE_WIDTH - PAGE_MARGIN * 2 - COLUMN_GAP) / 2
  const lines = [0, 1].flatMap((column) =>
    signatureLines(firstPage, PAGE_MARGIN + column * (width + COLUMN_GAP), textEnd + SPACE_ABOVE, width),
  )
  return { pages, objects: [...objects, ...lines] }
}
