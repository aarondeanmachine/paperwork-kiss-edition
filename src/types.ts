export type Screen = 'start' | 'editor' | 'home'
export type Tool = 'select' | 'text'

export type TextSize = 'sm' | 'md' | 'lg' | 'xl'
export type TextFont = 'formal' | 'handwritten' | 'typewriter'
export type TextAlign = 'left' | 'center' | 'right'
/** The six text colors. Their values live in tokens.css as --doc-color-<name>. */
export type TextColor = 'black' | 'gray' | 'red' | 'orange' | 'green' | 'blue'

/** Every object on the canvas is positioned in page coordinates. */
interface BaseObject {
  id: string
  pageId: string
  x: number
  y: number
  width: number
  height: number
}

export interface TextObject extends BaseObject {
  type: 'text'
  /** Rich text: bold, underline, italic, colored ranges and bullet lists live in the markup. */
  html: string
  size: TextSize
  font: TextFont
  color: TextColor
  align: TextAlign
}

/** A placed picture: the user's own signature, or a photo. Resizes with its proportions locked. */
export interface ImageObject extends BaseObject {
  type: 'signature' | 'photo'
  src: string
}

/** Someone other than the sender who has boxes to complete. Each person gets one of three tints. */
export interface Signer {
  id: string
  name: string
  email: string
  tone: 1 | 2 | 3
}

/** Marks where someone else will sign. */
export interface SignatureRequestObject extends BaseObject {
  type: 'signatureRequest'
  signer: Signer
}

/** A fillable form field. With a signer it is one of that person's fields. */
export interface FieldObject extends BaseObject {
  type: 'field'
  label: string
  value: string
  signer?: Signer
  /** Shows the signer's name inside the box, for fields whose label does not say whose they are. */
  showSigner?: boolean
}

/**
 * A drawn horizontal line, e.g. a signature line. Its box is taller than the stroke
 * so it is easy to tap; the stroke runs along the middle. Only its length changes.
 */
export interface LineObject extends BaseObject {
  type: 'line'
}

export type DocObject = TextObject | ImageObject | SignatureRequestObject | FieldObject | LineObject

type OmitId<T> = T extends unknown ? Omit<T, 'id'> : never
export type NewObject = OmitId<DocObject>

export interface Page {
  id: string
  /** Letter height by default. Grows when typing pushes content past the bottom. */
  height: number
  /** Quarter turns clockwise, in degrees. */
  rotation: 0 | 90 | 180 | 270
}

export interface DocFile {
  id: string
  name: string
  pages: Page[]
  objects: DocObject[]
  /** The Home folder this file is in. Without one it sits on Home itself. */
  folderId?: string
}

/** A folder on Home. Files point at it; it holds nothing itself. */
export interface Folder {
  id: string
  name: string
}
