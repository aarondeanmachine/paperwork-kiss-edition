import { pageDisplay } from '../lib/geometry'
import type { DocFile, DocObject, Page } from '../types'
import { FieldContent, ImageContent, LineContent, SignatureRequestContent } from './ObjectContent'
import { textProps } from './textProps'

interface PageViewProps {
  file: DocFile
  page: Page
  /** Width on screen, in px. */
  width: number
  /** Show a page that has grown in full (default), or crop it to Letter height. */
  fullHeight?: boolean
}

/** A read-only page drawn at any size, with its rotation. Used for thumbnails. */
export function PageView({ file, page, width, fullHeight = true }: PageViewProps) {
  const objects = file.objects.filter((object) => object.pageId === page.id)
  const display = pageDisplay(page, width, fullHeight)

  return (
    <div className="page-wrap" style={display.wrap}>
      <div className="page" data-static style={display.page}>
        {objects.map((object) => (
          <ObjectView key={object.id} object={object} />
        ))}
      </div>
    </div>
  )
}

function ObjectView({ object }: { object: DocObject }) {
  if (object.type === 'text') {
    return (
      <div className="obj" style={{ left: object.x, top: object.y, width: object.width }}>
        <div {...textProps(object)} dangerouslySetInnerHTML={{ __html: object.html }} />
      </div>
    )
  }
  return (
    <div className="obj" style={{ left: object.x, top: object.y, width: object.width, height: object.height }}>
      {object.type === 'line' && <LineContent />}
      {object.type === 'field' && <FieldContent object={object} />}
      {object.type === 'signatureRequest' && <SignatureRequestContent object={object} />}
      {(object.type === 'signature' || object.type === 'photo') && <ImageContent object={object} />}
    </div>
  )
}
