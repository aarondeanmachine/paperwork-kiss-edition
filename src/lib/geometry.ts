import type { CSSProperties } from 'react'
import type { Page } from '../types'
import { PAGE_HEIGHT, PAGE_WIDTH } from './layout'

/**
 * Pages can be rotated in quarter turns. A page keeps its own coordinate system
 * (x to its right edge, y to its bottom edge) however it is turned on screen, so
 * anything measured on screen is converted with the helpers below.
 */

/** Turns a movement on screen into the same movement in a rotated page's own axes. */
export function toLocal(dx: number, dy: number, rotation: number): [number, number] {
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [dx * cos + dy * sin, -dx * sin + dy * cos]
}

/** A point on screen as a position on the given page element. */
export function clientToPage(pageEl: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = pageEl.getBoundingClientRect()
  const rotation = Number(pageEl.dataset.rotation ?? 0)
  const sideways = rotation % 180 !== 0
  // offsetWidth and offsetHeight are the page's own size, before rotation and scaling.
  const scale = rect.width / (sideways ? pageEl.offsetHeight : pageEl.offsetWidth)
  const [x, y] = toLocal(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2), rotation)
  return { x: x / scale + pageEl.offsetWidth / 2, y: y / scale + pageEl.offsetHeight / 2 }
}

interface PageDisplay {
  scale: number
  /** The space the page takes on screen. */
  wrap: CSSProperties
  /** The page itself, rotated and scaled about its center to fill that space. */
  page: CSSProperties
}

/**
 * Sizes a page to a given width on screen. A page turned on its side is scaled
 * down so its long edge fits that width.
 * @param fullHeight false crops a page that has grown back to Letter height (file thumbnails).
 */
export function pageDisplay(page: Page, width: number, fullHeight = true): PageDisplay {
  const height = fullHeight ? page.height : PAGE_HEIGHT
  const sideways = page.rotation % 180 !== 0
  const scale = width / (sideways ? height : PAGE_WIDTH)
  return {
    scale,
    wrap: { width, height: (sideways ? PAGE_WIDTH : height) * scale },
    page: {
      width: PAGE_WIDTH,
      height,
      transform: `translate(-50%, -50%) rotate(${page.rotation}deg) scale(${scale})`,
    },
  }
}
