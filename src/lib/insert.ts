import { useStore } from '../store'
import type { Signer } from '../types'
import { PHOTO_SRC, SIGNATURE_SRC } from './assets'
import { uid } from './id'
import { FIELD_HEIGHT, SIGNATURE_BOX_HEIGHT } from './layout'
import { clientToPage } from './geometry'

/** New objects land in the middle of the visible part of the page, selected and ready to drag. */
function centerOfView(width: number, height: number): { pageId: string; x: number; y: number } | null {
  const canvas = document.querySelector('.canvas')
  if (!canvas) return null
  const view = canvas.getBoundingClientRect()
  const dock = document.querySelector('.toolbar')?.getBoundingClientRect()
  const centerX = view.left + view.width / 2
  const centerY = (view.top + (dock?.top ?? view.bottom)) / 2

  let page: HTMLElement | null = null
  let nearest = Infinity
  for (const candidate of canvas.querySelectorAll<HTMLElement>('.page')) {
    const rect = candidate.getBoundingClientRect()
    const distance = Math.max(rect.top - centerY, centerY - rect.bottom, 0)
    if (distance < nearest) {
      nearest = distance
      page = candidate
    }
  }
  if (!page?.dataset.pageId) return null
  const rect = page.getBoundingClientRect()
  const point = clientToPage(page, centerX, Math.min(Math.max(centerY, rect.top), rect.bottom))
  return { pageId: page.dataset.pageId, x: point.x - width / 2, y: point.y - height / 2 }
}

function aspectRatio(src: string): Promise<number> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth / image.naturalHeight)
    image.onerror = () => resolve(1.5)
    image.src = src
  })
}

async function insertImage(type: 'signature' | 'photo', src: string, width: number): Promise<void> {
  const height = Math.round(width / (await aspectRatio(src)))
  const spot = centerOfView(width, height)
  if (spot) useStore.getState().addObject({ type, src, ...spot, width, height })
}

/** Draw, upload and photograph all place the example signature. */
export const insertMySignature = () => insertImage('signature', SIGNATURE_SRC, 130)

export const insertPhoto = () => insertImage('photo', PHOTO_SRC, 180)

/** A new person to collect a signature or details from. Tints rotate so people can be told apart. */
export function createSigner(name: string, email: string): Signer {
  const known = new Set<string>()
  for (const object of useStore.getState().snapshot().objects) {
    if ((object.type === 'field' || object.type === 'signatureRequest') && object.signer) known.add(object.signer.id)
  }
  return { id: uid('signer'), name, email, tone: ((known.size % 3) + 1) as Signer['tone'] }
}

/** A plain form field, or with a signer, the first field for that person. */
export function insertField(signer?: Signer): void {
  const spot = centerOfView(150, FIELD_HEIGHT)
  if (!spot) return
  useStore.getState().addObject({ type: 'field', ...spot, width: 150, height: FIELD_HEIGHT, label: 'Form field', value: '', signer, showSigner: Boolean(signer) })
}

export function insertSignatureRequest(signer: Signer): void {
  const spot = centerOfView(150, SIGNATURE_BOX_HEIGHT)
  if (spot) useStore.getState().addObject({ type: 'signatureRequest', ...spot, width: 150, height: SIGNATURE_BOX_HEIGHT, signer })
}
