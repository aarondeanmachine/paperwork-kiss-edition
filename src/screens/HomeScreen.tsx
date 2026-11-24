import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowRight,
  Bell,
  Brain,
  BrainOff,
  ChevronLeft,
  Compass,
  Copy,
  Download,
  Ellipsis,
  FilePlus,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  KeyRound,
  LayoutTemplate,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkle,
  Trash2,
  Users,
} from 'lucide-react'
import { Dialog } from '../components/Dialog'
import { FloatingMenu } from '../components/FloatingMenu'
import { PageView } from '../components/PageView'
import { MenuDivider, MenuItem, MenuLabel } from '../components/Popover'
import { AgentChat } from '../editor/AgentChat'
import { useStore } from '../store'
import type { DocFile, Folder } from '../types'
import { useFileDrag } from './useFileDrag'

/** Width of one grid column in the 390px frame: (390 - 2*16 - 12) / 2. */
const THUMB_WIDTH = 173
/** A folder shows up to three of its files inside it, side by side. */
const PREVIEW_COUNT = 3
const PREVIEW_WIDTH = 20
const GHOST_WIDTH = 56

/** Shown from Settings > Building philosophy. */
const NORTH_STARS = ['Simplicity', 'What can we delete?', 'Emergent complexity']
const USER_TRAITS = [
  'will be on mobile',
  'will start with just one file',
  'they will be won over by the ease of use with one file',
  'they may only ever have fairly few files',
  'they will not look like pdf.net power users',
  "will not be expecting AI chat, and won't rely on it until they familiarize with the product",
  "will not necessarily find their 'aha' experience in the ai chat",
  'are solo B2C users (not coming from an org), so less need for enterprise features up front',
  'just want the basics',
  "are not looking for a typical pdf editor (because the ads don't say that)",
  'just want their doc work done ASAP',
]

export function HomeScreen() {
  const files = useStore((state) => state.files)
  const folders = useStore((state) => state.folders)
  const addSampleFile = useStore((state) => state.addSampleFile)
  const newBlankFile = useStore((state) => state.newBlankFile)
  const generateFile = useStore((state) => state.generateFile)
  const deleteFile = useStore((state) => state.deleteFile)
  const addFolder = useStore((state) => state.addFolder)
  const moveFile = useStore((state) => state.moveFile)
  const showToast = useStore((state) => state.showToast)
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState<DocFile | null>(null)
  const [generating, setGenerating] = useState(false)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  /** A setting with a tick and no effect in the mockup. */
  const [dumbMode, setDumbMode] = useState(false)
  /** Turned on from Settings: shows the "files need your attention" bar. */
  const [showRequests, setShowRequests] = useState(false)
  const [signingNote, setSigningNote] = useState(false)
  const [philosophyOpen, setPhilosophyOpen] = useState(false)
  /** Changing this starts the Home chat afresh. */
  const [chatSession, setChatSession] = useState(0)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  /** Turned on from Settings: adds the "Shared with me" folder beside the add tile. */
  const [showShared, setShowShared] = useState(false)
  const [sharedOpen, setSharedOpen] = useState(false)
  /** The new-folder popup. With a file, that file moves into the folder once it is made. */
  const [newFolder, setNewFolder] = useState<{ moveFileId?: string } | null>(null)

  // Which view of Home is showing: the top level, one of your folders, or "Shared with me".
  const inShared = showShared && sharedOpen
  // A folder that has been deleted simply falls back to Home.
  const openFolder = inShared ? undefined : folders.find((folder) => folder.id === openFolderId)
  const atTop = !openFolder && !inShared
  const shown = inShared ? [] : files.filter((file) => (openFolder ? file.folderId === openFolder.id : !file.folderId))
  // The search bar appears once there is something to search through.
  const showSearch = files.length > 1 || folders.length > 0

  const addFile = () => {
    // No real upload in the mockup: this adds another copy of the sample file.
    setAddAnchor(null)
    void addSampleFile().then(() => showToast('File added'))
  }

  // Files can be dragged onto folders from the top level of Home.
  const fileDrag = useFileDrag({
    enabled: atTop && folders.length > 0,
    onDrop: (fileId, folderId) => {
      const folder = folders.find((item) => item.id === folderId)
      if (!folder) return
      moveFile(fileId, folderId)
      showToast(`Moved to ${folder.name}`)
    },
  })
  const draggedFile = files.find((file) => file.id === fileDrag.draggingId)

  /** For menu items that exist for the layout only. */
  const notBuilt = (what: string, close: () => void) => () => {
    close()
    showToast(`${what} not part of this mockup`)
  }

  const createFolder = (name: string) => {
    const id = addFolder(name)
    if (newFolder?.moveFileId) moveFile(newFolder.moveFileId, id)
    setNewFolder(null)
  }

  return (
    <div className="screen home" ref={fileDrag.rootRef}>
      <header className="home-bar">
        {!atTop && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Back to Home"
            onClick={() => {
              setOpenFolderId(null)
              setSharedOpen(false)
            }}
          >
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
        )}
        {/* Home carries the wordmark; inside a folder the title is the folder's name. */}
        <h1 className="home-title" data-brand={atTop || undefined}>
          {inShared ? 'Shared with me' : openFolder ? openFolder.name : 'paperwork.com'}
        </h1>
        {atTop && (
          <button type="button" className="icon-btn" aria-label="Add folder" onClick={() => setNewFolder({})}>
            <FolderPlus size={18} strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </header>

      {/* Turned on from Settings. It sits under the wordmark, above where the search bar goes. */}
      {atTop && showRequests && (
        <button type="button" className="request-bar" onClick={() => setSigningNote(true)}>
          <span className="request-bar-text">Two files need your attention</span>
          <span className="request-bar-count">2</span>
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </button>
      )}

      {showSearch && (
        // For looks only: typing here does not filter anything.
        <label className="home-search">
          <Search size={15} strokeWidth={1.5} aria-hidden />
          <input className="home-search-input" type="search" placeholder="Search" aria-label="Search files" />
        </label>
      )}

      <div className="file-grid" ref={fileDrag.gridRef} data-dragging={draggedFile ? true : undefined}>
        {/* Always first, so adding a file is in the same place however much is on Home. */}
        {atTop && (
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

        {/* Always second (top right), when switched on in Settings. */}
        {atTop && showShared && (
          <div className="file-card shared-card">
            <button
              type="button"
              className="folder-tile"
              aria-label="Open Shared with me"
              onClick={() => setSharedOpen(true)}
            >
              <span className="folder-shape">
                <span className="folder-tab" />
                <span className="folder-body">
                  <Users size={20} strokeWidth={1.5} aria-hidden />
                </span>
              </span>
            </button>
            <div className="file-meta">
              <div className="file-text">
                <div className="folder-name">Shared with me</div>
                <div className="file-sub">Empty</div>
              </div>
            </div>
          </div>
        )}

        {atTop &&
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

        {/* Files other people share would appear here. In the mockup it is always empty. */}
        {inShared && (
          <div className="shared-empty">
            <p className="shared-empty-text">Nothing is shared with your example@me.com account yet</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => showToast('Invites are not part of this mockup')}
            >
              Invite Friends
            </button>
            <p className="shared-empty-tagline">
              You don’t choose paperwork.
              <br />
              You do choose paperwork.com
            </p>
          </div>
        )}
      </div>

      {/* What follows the pointer while a file is dragged. */}
      {draggedFile && (
        <div className="drag-ghost" ref={fileDrag.ghostRef} aria-hidden>
          <PageView file={draggedFile} page={draggedFile.pages[0]} width={GHOST_WIDTH} fullHeight={false} />
        </div>
      )}

      <button
        type="button"
        className="settings-btn"
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={settingsAnchor !== null}
        onClick={(event) => setSettingsAnchor(settingsAnchor ? null : event.currentTarget)}
      >
        <Settings size={18} strokeWidth={1.5} aria-hidden />
      </button>

      {/* The same agent chat as the editor's, resting at the foot of Home. Its x clears the conversation. */}
      <div className="home-chat">
        <AgentChat
          key={chatSession}
          autoFocus={false}
          closeWhenEmpty={false}
          onClose={() => setChatSession((session) => session + 1)}
        />
      </div>

      {settingsAnchor && (
        <FloatingMenu anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} label="Settings">
          <MenuItem
            icon={KeyRound}
            label="Get early-access code"
            onSelect={notBuilt('Early-access codes are', () => setSettingsAnchor(null))}
          />
          <MenuItem icon={Brain} label="Memories" onSelect={notBuilt('Memories are', () => setSettingsAnchor(null))} />
          {/* A switch that only ticks: it changes nothing in the mockup. */}
          <MenuItem icon={BrainOff} label="Dumb mode" checked={dumbMode} onSelect={() => setDumbMode(!dumbMode)} />
          <MenuItem
            icon={Bell}
            label="See request notification"
            checked={showRequests}
            onSelect={() => {
              setSettingsAnchor(null)
              setShowRequests(!showRequests)
            }}
          />
          <MenuItem
            icon={Users}
            label="See shared w/ folder"
            checked={showShared}
            onSelect={() => {
              setSettingsAnchor(null)
              setShowShared(!showShared)
            }}
          />
          <MenuItem
            icon={Compass}
            label="Building philosophy"
            onSelect={() => {
              setSettingsAnchor(null)
              setPhilosophyOpen(true)
            }}
          />
        </FloatingMenu>
      )}

      {philosophyOpen && (
        <Dialog title="Building philosophy" onClose={() => setPhilosophyOpen(false)}>
          <div className="prose">
            <h3>The Three North stars:</h3>
            <ul className="prose-plain">
              {NORTH_STARS.map((star) => (
                <li key={star}>{star}</li>
              ))}
            </ul>
            <h3>Most paperwork.com users:</h3>
            <ul>
              {USER_TRAITS.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
          </div>
        </Dialog>
      )}

      {signingNote && (
        <Dialog title="Two files need your attention" onClose={() => setSigningNote(false)}>
          <p className="dialog-text">This takes the user to a mobile optimized signing flow.</p>
          <div className="dialog-actions">
            <button type="button" className="btn-primary" onClick={() => setSigningNote(false)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}

      {addAnchor && (
        <FloatingMenu anchor={addAnchor} onClose={() => setAddAnchor(null)} label="Add a file">
          <MenuItem icon={FolderOpen} label="Add from files" onSelect={addFile} />
          <MenuItem
            icon={Sparkle}
            label="Generate from prompt"
            onSelect={() => {
              setAddAnchor(null)
              setGenerating(true)
            }}
          />
          {/* Opens straight in the editor: there is nothing to look at on Home yet. */}
          <MenuItem icon={FilePlus} label="New blank page" onSelect={newBlankFile} />
          <MenuItem
            icon={LayoutTemplate}
            label="Start from template"
            onSelect={notBuilt('Templates are', () => setAddAnchor(null))}
          />
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

      {generating && (
        <GenerateDialog onGenerate={(prompt) => void generateFile(prompt)} onClose={() => setGenerating(false)} />
      )}

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

/** Asks what to write. The mockup then opens a new document holding a canned reply. */
function GenerateDialog({ onGenerate, onClose }: { onGenerate: (prompt: string) => void; onClose: () => void }) {
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const generate = (event: FormEvent) => {
    event.preventDefault()
    // Opening the new document leaves Home, which also closes this popup.
    if (prompt.trim()) onGenerate(prompt)
  }

  return (
    <Dialog title="Generate from prompt" onClose={onClose}>
      <form className="dialog-form" onSubmit={generate}>
        <label className="form-row">
          <span className="form-label">What should the document say?</span>
          <textarea
            ref={inputRef}
            className="input textarea"
            rows={3}
            value={prompt}
            placeholder="e.g. A one-page consulting agreement"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, like the agent chat. Shift+Enter starts a new line.
              if (event.key === 'Enter' && !event.shiftKey) generate(event)
            }}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!prompt.trim()}>
            Generate
          </button>
        </div>
      </form>
    </Dialog>
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
