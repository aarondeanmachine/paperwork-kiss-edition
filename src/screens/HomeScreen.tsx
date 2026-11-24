import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ChevronLeft,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react'
import { Dialog } from '../components/Dialog'
import { FloatingMenu } from '../components/FloatingMenu'
import { PageView } from '../components/PageView'
import { MenuDivider, MenuItem, MenuLabel } from '../components/Popover'
import { useStore } from '../store'
import type { DocFile, Folder } from '../types'
import { useFileDrag } from './useFileDrag'

/** Width of one grid column in the 390px frame: (390 - 2*16 - 12) / 2. */
const THUMB_WIDTH = 173
/** A folder shows up to three of its files inside it, side by side. */
const PREVIEW_COUNT = 3
const PREVIEW_WIDTH = 20
const GHOST_WIDTH = 56

export function HomeScreen() {
  const files = useStore((state) => state.files)
  const folders = useStore((state) => state.folders)
  const addSampleFile = useStore((state) => state.addSampleFile)
  const deleteFile = useStore((state) => state.deleteFile)
  const addFolder = useStore((state) => state.addFolder)
  const moveFile = useStore((state) => state.moveFile)
  const showToast = useStore((state) => state.showToast)
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState<DocFile | null>(null)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  /** The new-folder popup. With a file, that file moves into the folder once it is made. */
  const [newFolder, setNewFolder] = useState<{ moveFileId?: string } | null>(null)

  // A folder that has been deleted simply falls back to Home.
  const openFolder = folders.find((folder) => folder.id === openFolderId)
  const shown = files.filter((file) => (openFolder ? file.folderId === openFolder.id : !file.folderId))
  // The search bar appears once there is something to search through.
  const showSearch = files.length > 1 || folders.length > 0

  const addFile = () => {
    // No real upload in the mockup: both options add another copy of the sample file.
    setAddAnchor(null)
    void addSampleFile().then(() => showToast('File added'))
  }

  // Files can be dragged onto folders from the top level of Home.
  const fileDrag = useFileDrag({
    enabled: !openFolder && folders.length > 0,
    onDrop: (fileId, folderId) => {
      const folder = folders.find((item) => item.id === folderId)
      if (!folder) return
      moveFile(fileId, folderId)
      showToast(`Moved to ${folder.name}`)
    },
  })
  const draggedFile = files.find((file) => file.id === fileDrag.draggingId)

  const createFolder = (name: string) => {
    const id = addFolder(name)
    if (newFolder?.moveFileId) moveFile(newFolder.moveFileId, id)
    setNewFolder(null)
  }

  return (
    <div className="screen home" ref={fileDrag.rootRef}>
      <header className="home-bar">
        {openFolder && (
          <button type="button" className="icon-btn" aria-label="Back to Home" onClick={() => setOpenFolderId(null)}>
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
        )}
        {/* Home carries the wordmark; inside a folder the title is the folder's name. */}
        <h1 className="home-title" data-brand={openFolder ? undefined : true}>
          {openFolder ? openFolder.name : 'paperwork.com'}
        </h1>
        {!openFolder && (
          <button type="button" className="icon-btn" aria-label="Add folder" onClick={() => setNewFolder({})}>
            <FolderPlus size={18} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </header>

      {showSearch && (
        // For looks only: typing here does not filter anything.
        <label className="home-search">
          <Search size={15} strokeWidth={1.5} aria-hidden />
          <input className="home-search-input" type="search" placeholder="Search" aria-label="Search files" />
        </label>
      )}

      <div className="file-grid" ref={fileDrag.gridRef} data-dragging={draggedFile ? true : undefined}>
        {/* Always first, so adding a file is in the same place however much is on Home. */}
        {!openFolder && (
          <div className="file-slot">
            <button
              type="button"
              className="add-tile"
              aria-label="Add a file"
              aria-haspopup="menu"
              aria-expanded={addAnchor !== null}
              onClick={(event) => setAddAnchor(addAnchor ? null : event.currentTarget)}
            >
              <span className="plus-dot">
                <Plus size={16} strokeWidth={1.5} aria-hidden />
              </span>
            </button>
          </div>
        )}

        {!openFolder &&
          folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              isDropTarget={fileDrag.dropFolderId === folder.id}
              onOpen={() => setOpenFolderId(folder.id)}
            />
          ))}

        {shown.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            isDragging={file.id === fileDrag.draggingId}
            onThumbDown={(event) => fileDrag.onThumbDown(event, file.id)}
            wasDrag={fileDrag.wasDrag}
            onDelete={() => setDeleting(file)}
            onNewFolder={() => setNewFolder({ moveFileId: file.id })}
          />
        ))}

        {openFolder && shown.length === 0 && <p className="folder-empty">This folder is empty.</p>}
      </div>

      {/* What follows the pointer while a file is dragged. */}
      {draggedFile && (
        <div className="drag-ghost" ref={fileDrag.ghostRef} aria-hidden>
          <PageView file={draggedFile} page={draggedFile.pages[0]} width={GHOST_WIDTH} fullHeight={false} />
        </div>
      )}

      {/* Settings are not part of the mockup. */}
      <button
        type="button"
        className="settings-btn"
        aria-label="Settings"
        onClick={() => showToast('Settings are not part of this mockup')}
      >
        <Settings size={18} strokeWidth={1.5} aria-hidden />
      </button>

      {addAnchor && (
        <FloatingMenu anchor={addAnchor} onClose={() => setAddAnchor(null)} label="Add a file">
          <MenuItem icon={FolderOpen} label="Add from files" onSelect={addFile} />
          <MenuItem icon={FileText} label="Open sample file" onSelect={addFile} />
          <MenuDivider />
          <MenuItem
            icon={FolderPlus}
            label="Add new folder"
            onSelect={() => {
              setAddAnchor(null)
              setNewFolder({})
            }}
          />
        </FloatingMenu>
      )}

      {newFolder && <NewFolderDialog onCreate={createFolder} onClose={() => setNewFolder(null)} />}

      {deleting && (
        <Dialog title="Delete this file?" onClose={() => setDeleting(null)}>
          <p className="dialog-text">
            “{deleting.name}” will be deleted. This can’t be undone.
          </p>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setDeleting(null)
                // Deleting the last file returns to the Start screen.
                deleteFile(deleting.id)
              }}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

/* ---------- File ---------- */

interface FileCardProps {
  file: DocFile
  /** True while this file is being dragged: the card fades where it was. */
  isDragging: boolean
  onThumbDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  /** True for the tap that ends a drag, which should not open the file. */
  wasDrag: () => boolean
  onDelete: () => void
  onNewFolder: () => void
}

function FileCard({ file, isDragging, onThumbDown, wasDrag, onDelete, onNewFolder }: FileCardProps) {
  const folders = useStore((state) => state.folders)
  const openFile = useStore((state) => state.openFile)
  const copyFile = useStore((state) => state.copyFile)
  const moveFile = useStore((state) => state.moveFile)
  const showToast = useStore((state) => state.showToast)
  /** The open menu's anchor, and whether it shows the file's options or the folders to move it to. */
  const [menu, setMenu] = useState<{ anchor: HTMLElement; view: 'options' | 'folders' } | null>(null)
  const pageCount = file.pages.length

  const pick = (action: () => void) => () => {
    setMenu(null)
    action()
  }

  const moveTo = (folder: Folder | null) =>
    pick(() => {
      if ((folder?.id ?? undefined) === file.folderId) return
      moveFile(file.id, folder?.id ?? null)
      showToast(folder ? `Moved to ${folder.name}` : 'Removed from folder')
    })

  return (
    <div className="file-card" data-dragging={isDragging || undefined}>
      <button
        type="button"
        className="file-thumb"
        aria-label={`Open ${file.name}`}
        onPointerDown={onThumbDown}
        onClick={() => {
          if (!wasDrag()) openFile(file.id)
        }}
      >
        <PageView file={file} page={file.pages[0]} width={THUMB_WIDTH} fullHeight={false} />
      </button>
      <div className="file-meta">
        <div className="file-text">
          <div className="file-name">{file.name}</div>
          <div className="file-sub">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Options for ${file.name}`}
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          onClick={(event) => setMenu(menu ? null : { anchor: event.currentTarget, view: 'options' })}
        >
          <Ellipsis size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {menu?.view === 'options' && (
        <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={`Options for ${file.name}`}>
          <MenuItem icon={Download} label="Download" onSelect={pick(() => showToast('Downloading PDF'))} />
          {/* Stays open and swaps to the list of folders. */}
          <MenuItem icon={FolderInput} label="Move to folder" onSelect={() => setMenu({ ...menu, view: 'folders' })} />
          <MenuItem icon={Copy} label="Make a copy" onSelect={pick(() => copyFile(file.id))} />
          <MenuItem icon={Share2} label="Share" onSelect={pick(() => showToast('Link copied'))} />
          <MenuDivider />
          <MenuItem icon={Trash2} label="Delete" tone="danger" onSelect={pick(onDelete)} />
        </FloatingMenu>
      )}

      {menu?.view === 'folders' && (
        <FloatingMenu anchor={menu.anchor} onClose={() => setMenu(null)} label={`Move ${file.name} to a folder`}>
          <MenuLabel>Move to</MenuLabel>
          {folders.map((folder) => (
            <MenuItem
              key={folder.id}
              icon={FolderIcon}
              label={folder.name}
              checked={file.folderId === folder.id}
              onSelect={moveTo(folder)}
            />
          ))}
          {file.folderId && <MenuItem icon={FolderOutput} label="Remove from folder" onSelect={moveTo(null)} />}
          {(folders.length > 0 || file.folderId) && <MenuDivider />}
          <MenuItem icon={FolderPlus} label="New folder" onSelect={pick(onNewFolder)} />
        </FloatingMenu>
      )}
    </div>
  )
}

/* ---------- Folder ---------- */

/**
 * A folder. Empty, it opens a checklist of files to put in it.
 * With files inside, it shows them and opens when tapped.
 */
interface FolderCardProps {
  folder: Folder
  /** True while a dragged file is held over this folder. */
  isDropTarget: boolean
  onOpen: () => void
}

function FolderCard({ folder, isDropTarget, onOpen }: FolderCardProps) {
  const files = useStore((state) => state.files)
  const moveFile = useStore((state) => state.moveFile)
  const deleteFolder = useStore((state) => state.deleteFolder)
  const tileRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const inside = files.filter((file) => file.folderId === folder.id)

  return (
    <div className="file-card folder-card" data-folder-id={folder.id} data-drop={isDropTarget || undefined}>
      <button
        ref={tileRef}
        type="button"
        className="folder-tile"
        data-empty={inside.length === 0 || undefined}
        aria-label={inside.length === 0 ? `Add files to ${folder.name}` : `Open ${folder.name}`}
        aria-expanded={pickerOpen || undefined}
        onClick={() => {
          // While the checklist is open the tile closes it, even if the folder now has files.
          if (pickerOpen) setPickerOpen(false)
          else if (inside.length === 0) setPickerOpen(true)
          else onOpen()
        }}
      >
        {/* Drawn like the + tile: a white, softly raised body, with an off-white tab behind its top edge. */}
        <span className="folder-shape">
          <span className="folder-tab" />
          <span className="folder-body">
            {inside.slice(0, PREVIEW_COUNT).map((file) => (
              <PageView key={file.id} file={file} page={file.pages[0]} width={PREVIEW_WIDTH} fullHeight={false} />
            ))}
          </span>
        </span>
      </button>
      <div className="file-meta">
        <div className="file-text">
          <div className="folder-name">{folder.name}</div>
          <div className="file-sub">
            {inside.length === 0 ? 'Empty' : `${inside.length} ${inside.length === 1 ? 'file' : 'files'}`}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Options for ${folder.name}`}
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={(event) => setMenuAnchor(menuAnchor ? null : event.currentTarget)}
        >
          <Ellipsis size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {pickerOpen && tileRef.current && (
        // A checklist: it stays open so several files can be ticked in one go.
        <FloatingMenu anchor={tileRef.current} onClose={() => setPickerOpen(false)} label={`Add files to ${folder.name}`}>
          <MenuLabel>Add to {folder.name}</MenuLabel>
          {files.map((file) => {
            const isInside = file.folderId === folder.id
            return (
              <MenuItem
                key={file.id}
                icon={FileText}
                label={file.name}
                checked={isInside}
                onSelect={() => moveFile(file.id, isInside ? null : folder.id)}
              />
            )
          })}
        </FloatingMenu>
      )}

      {menuAnchor && (
        <FloatingMenu anchor={menuAnchor} onClose={() => setMenuAnchor(null)} label={`Options for ${folder.name}`}>
          <MenuItem
            icon={FolderInput}
            label="Add files"
            onSelect={() => {
              setMenuAnchor(null)
              setPickerOpen(true)
            }}
          />
          <MenuDivider />
          {/* Only the folder goes: its files return to Home. */}
          <MenuItem
            icon={Trash2}
            label="Delete folder"
            tone="danger"
            onSelect={() => {
              setMenuAnchor(null)
              deleteFolder(folder.id)
            }}
          />
        </FloatingMenu>
      )}
    </div>
  )
}

function NewFolderDialog({ onCreate, onClose }: { onCreate: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('New folder')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [])

  const create = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onCreate(name)
  }

  return (
    <Dialog title="New folder" onClose={onClose}>
      <form className="dialog-form" onSubmit={create}>
        <label className="form-row">
          <span className="form-label">Folder name</span>
          <input
            ref={inputRef}
            className="input"
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </Dialog>
  )
}
