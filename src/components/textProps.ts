import type { CSSProperties } from 'react'
import type { TextObject } from '../types'

/** The attributes that style a text box. Shared by the editor and the thumbnails. */
export function textProps(object: TextObject) {
  return {
    className: 'text-content',
    'data-size': object.size,
    'data-font': object.font,
    style: { color: `var(--doc-color-${object.color})`, textAlign: object.align } as CSSProperties,
  }
}
