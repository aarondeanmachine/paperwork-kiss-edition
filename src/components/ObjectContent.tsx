import type { ReactNode } from 'react'
import { PenLine } from 'lucide-react'
import type { FieldObject, ImageObject, SignatureRequestObject } from '../types'

/** How each non-text object looks. Shared by the editor and the thumbnails. */

export function ImageContent({ object }: { object: ImageObject }) {
  return <img className="obj-img" data-kind={object.type} src={object.src} alt="" draggable={false} />
}

export function LineContent() {
  return <div className="doc-line" />
}

export function SignatureRequestContent({ object }: { object: SignatureRequestObject }) {
  return (
    <div className="sig-request" data-tone={object.signer.tone}>
      <div className="sig-request-title">
        <PenLine size={12} strokeWidth={1.75} aria-hidden />
        <span>Signature</span>
      </div>
      <div className="sig-request-name">{object.signer.name}</div>
    </div>
  )
}

/**
 * The field's box. Generic fields that belong to a person ("Text", "Form field") carry
 * that person's name on the right, after a divider, styled like the signature block's name.
 */
export function FieldShell({ object, children }: { object: FieldObject; children: ReactNode }) {
  return (
    <div className="field" data-empty={!object.value || undefined} data-tone={object.signer?.tone}>
      {children}
      {object.signer && object.showSigner && (
        <>
          <span className="field-divider" />
          <span className="field-signer">{object.signer.name}</span>
        </>
      )}
    </div>
  )
}

export function FieldContent({ object }: { object: FieldObject }) {
  return (
    <FieldShell object={object}>
      <span className="field-text">{object.value || object.label}</span>
    </FieldShell>
  )
}
