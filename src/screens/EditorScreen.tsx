import { useEffect } from 'react'
import { BottomToolbar } from '../editor/BottomToolbar'
import { Canvas } from '../editor/Canvas'
import { CompressDialog } from '../editor/CompressDialog'
import { FormatBar } from '../editor/FormatBar'
import { FormatsDialog } from '../editor/FormatsDialog'
import { Organizer } from '../editor/Organizer'
import { PersonDialog, SignatureDialog } from '../editor/SignatureDialog'
import { Sidebar } from '../editor/Sidebar'
import { TopBar } from '../editor/TopBar'
import { useActiveFile, useStore } from '../store'

export function EditorScreen() {
  const file = useActiveFile()
  const editingId = useStore((state) => state.editingId)
  const dialog = useStore((state) => state.dialog)
  const sidebar = useStore((state) => state.sidebar)
  const setDialog = useStore((state) => state.setDialog)

  useEffect(() => {
    // Pressing anywhere outside the canvas and the two toolbars commits and deselects.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (target.closest('.canvas, .toolbar, .format-anchor')) return
      const state = useStore.getState()
      if (state.selectedId) state.deselect()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const state = useStore.getState()
      if (event.key === 'Escape') {
        if (state.selectedId) state.deselect()
        return
      }
      // While typing, every other key belongs to the text box. A dialog takes the keyboard too.
      const target = event.target as HTMLElement
      if (state.editingId || target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      if (document.querySelector('[role="dialog"]')) return

      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
      } else if (mod && key === 'y') {
        event.preventDefault()
        state.redo()
      } else if ((event.key === 'Backspace' || event.key === 'Delete') && state.selectedId) {
        event.preventDefault()
        state.deleteSelected()
      } else if (!mod && !event.altKey && (key === 'v' || key === 't')) {
        // preventDefault keeps the letter out of a box that T has just put into editing.
        event.preventDefault()
        state.setTool(key === 'v' ? 'select' : 'text')
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!file) return null
  // The formatting toolbar belongs to the Text tool: it shows for the box being edited only.
  const editingObject = file.objects.find((object) => object.id === editingId)

  return (
    <div className="screen editor">
      <TopBar title={file.name} />
      <Canvas file={file} />
      {/* Keyed by box, so open rows and the agent chat reset when another box is edited. */}
      {editingObject?.type === 'text' && <FormatBar key={editingObject.id} object={editingObject} />}
      <BottomToolbar />
      {sidebar === 'list' && <Sidebar file={file} />}
      {sidebar === 'organize' && <Organizer file={file} />}
      {dialog === 'signature' && <SignatureDialog onClose={() => setDialog(null)} />}
      {dialog === 'person' && <PersonDialog onClose={() => setDialog(null)} />}
      {dialog === 'compress' && <CompressDialog onClose={() => setDialog(null)} />}
      {dialog === 'formats' && <FormatsDialog fileName={file.name} onClose={() => setDialog(null)} />}
    </div>
  )
}
