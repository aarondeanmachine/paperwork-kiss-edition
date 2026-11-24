import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '../components/Dialog'
import { useStore } from '../store'
import type { DocFile } from '../types'

interface ExtractDialogProps {
  file: DocFile
  pageIds: string[]
  onClose: () => void
}

/** Asks for a name, then saves the chosen pages as a new file and opens it. */
export function ExtractDialog({ file, pageIds, onClose }: ExtractDialogProps) {
  const [name, setName] = useState(`${file.name} extract`)
  const inputRef = useRef<HTMLInputElement>(null)
  const count = pageIds.length

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [])

  const extract = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    // Opening the new file leaves this screen, which also closes the dialog.
    useStore.getState().extractPages(pageIds, name)
  }

  return (
    <Dialog title="Name the new file" onClose={onClose}>
      <form className="dialog-form" onSubmit={extract}>
        <label className="form-row">
          <span className="form-label">File name</span>
          <input
            ref={inputRef}
            className="input"
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="dialog-note">
          {count} {count === 1 ? 'page' : 'pages'} will be saved as a new file and added to Home. They also stay
          in this file.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Extract
          </button>
        </div>
      </form>
    </Dialog>
  )
}
