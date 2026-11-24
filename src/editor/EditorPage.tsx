import { useMemo } from 'react'
import { pageDisplay } from '../lib/geometry'
import { useStore } from '../store'
import type { DocFile, DocObject, Page } from '../types'
import { FieldBox, ImageBox, LineBox, SignatureRequestBox } from './Boxes'
import { PageContext } from './pageContext'
import { TextBox } from './TextBox'

interface EditorPageProps {
  file: DocFile
  page: Page
  /** Width on screen, in px. */
  width: number
}

/** A page in the editor, with live, editable objects. */
export function EditorPage({ file, page, width }: EditorPageProps) {
  const objects = file.objects.filter((object) => object.pageId === page.id)
  // The page holding the selection draws on top, so a box dragged over a neighbour stays visible.
  const raised = useStore((state) => objects.some((object) => object.id === state.selectedId))
  const display = pageDisplay(page, width)
  const context = useMemo(() => ({ scale: display.scale, rotation: page.rotation }), [display.scale, page.rotation])

  return (
    <div className="page-wrap" data-raised={raised || undefined} style={display.wrap}>
      <div className="page" data-page-id={page.id} data-rotation={page.rotation} style={display.page}>
        <PageContext.Provider value={context}>
          {objects.map((object) => (
            <LiveObject key={object.id} object={object} />
          ))}
        </PageContext.Provider>
      </div>
    </div>
  )
}

function LiveObject({ object }: { object: DocObject }) {
  switch (object.type) {
    case 'text':
      return <TextBox object={object} />
    case 'field':
      return <FieldBox object={object} />
    case 'signatureRequest':
      return <SignatureRequestBox object={object} />
    case 'signature':
    case 'photo':
      return <ImageBox object={object} />
    case 'line':
      return <LineBox object={object} />
  }
}
