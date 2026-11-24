import { create } from 'zustand'
import { buildSample } from './data/sample'
import { isEmptyHtml } from './lib/caret'
import { uid } from './lib/id'
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from './lib/layout'
import type { DocFile, DocObject, Folder, NewObject, Page, Screen, TextObject, Tool } from './types'

const SAMPLE_NAME = 'culture_manifesto'
const HISTORY_LIMIT = 100
const NEW_BOX_MIN_WIDTH = 120
const NEW_BOX_LINE_HEIGHT = 16

/** What undo and redo restore: the pages and objects of the open file. */
export interface Snapshot {
  pages: Page[]
  objects: DocObject[]
}

interface AppState {
  screen: Screen
  files: DocFile[]
  folders: Folder[]
  activeFileId: string | null
  tool: Tool
  toast: string | null
  /** The popup that is open over the editor, if any. */
  dialog: 'signature' | 'person' | 'compress' | 'formats' | null
  /** The page navigator: closed, the narrow list, or the full-screen organizer. */
  sidebar: 'closed' | 'list' | 'organize'
  selectedId: string | null
  /** Set while a text box is being typed in. Implies the Text tool. */
  editingId: string | null
  canUndo: boolean
  canRedo: boolean

  /** Both Start options land here: the sample file opens in the editor. */
  openSample: () => Promise<void>
  /** Home's +: another sample file joins the list without leaving Home. */
  addSampleFile: () => Promise<void>
  copyFile: (id: string) => void
  addFolder: (name: string) => string
  /** Removes a folder. Its files go back to Home. */
  deleteFolder: (id: string) => void
  /** Puts a file in a folder, or back on Home with `null`. */
  moveFile: (fileId: string, folderId: string | null) => void
  /** Removes a file. Deleting the last one returns to the Start screen. */
  deleteFile: (id: string) => void
  openFile: (id: string) => void
  goHome: () => void
  setSidebar: (sidebar: AppState['sidebar']) => void
  /** Puts the pages in a new order. */
  reorderPages: (pageIds: string[]) => void
  /** Adds a blank page at a position. */
  insertPage: (index: number) => void
  /** Turns a page a quarter turn clockwise. */
  rotatePage: (pageId: string) => void
  /** Adds a copy of a page, with its contents, right after it. */
  duplicatePage: (pageId: string) => void
  /** Removes a page and everything on it. A file always keeps at least one page. */
  deletePage: (pageId: string) => void
  /** Saves the given pages as a new file and opens it. The pages stay in this file too. */
  extractPages: (pageIds: string[], name: string) => void
  setTool: (tool: Tool) => void
  showToast: (message: string) => void
  setDialog: (dialog: AppState['dialog']) => void

  select: (id: string) => void
  /** Commits any edit in progress and clears the selection. */
  deselect: () => void
  startEditing: (id: string) => void
  commitEditing: (options?: { keepSelected?: boolean }) => void
  /** Adds an empty text box at a point on a page and starts editing it. */
  createTextBox: (pageId: string, x: number, y: number) => string
  /** Places a new object on its page (kept inside the page) and adds an undo step. */
  addObject: (object: NewObject, options?: { select?: boolean; growPage?: boolean }) => string
  /** Typing: stores the new text and height, and moves the boxes below by the difference. */
  typeInto: (id: string, html: string, height: number) => void
  /** Changes an object without touching history (used during drags). */
  updateObject: (id: string, patch: Partial<DocObject>) => void
  /** Drops an object on a page, kept inside the page bounds. */
  placeObject: (id: string, pageId: string, x: number, y: number) => void
  deleteSelected: () => void

  snapshot: () => Snapshot
  /** Adds an undo step if the file changed since `before` was taken. */
  record: (before: Snapshot) => void
  undo: () => void
  redo: () => void
}

let toastTimer: number | undefined
let past: Snapshot[] = []
let future: Snapshot[] = []
let editSession: { id: string; before: Snapshot; isNew: boolean } | null = null

function resetHistory() {
  past = []
  future = []
  editSession = null
}

/** Text is measured to lay out the pages, so the fonts have to be ready first. */
async function fontsReady(): Promise<void> {
  await Promise.all([
    document.fonts.load('400 11px "Inter Variable"'),
    document.fonts.load('700 11px "Inter Variable"'),
    document.fonts.load('italic 700 11px "Inter Variable"'),
  ])
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function shallowEqual(a: object, b: object): boolean {
  if (a === b) return true
  const keys = Object.keys(a) as (keyof typeof a)[]
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    a.objects.length === b.objects.length &&
    a.pages.length === b.pages.length &&
    a.objects.every((object, index) => shallowEqual(object, b.objects[index])) &&
    a.pages.every((page, index) => shallowEqual(page, b.pages[index]))
  )
}

/** Grows a page when content spills past its bottom; shrinks back toward Letter height. */
function fitPageHeight(page: Page, objects: DocObject[]): number {
  const bottoms = objects.filter((object) => object.pageId === page.id).map((object) => object.y + object.height)
  const lowest = Math.max(0, ...bottoms)
  if (lowest > page.height) return lowest + PAGE_MARGIN
  return Math.max(PAGE_HEIGHT, Math.min(page.height, lowest + PAGE_MARGIN))
}

async function createSampleFile(existing: DocFile[]): Promise<DocFile> {
  await fontsReady()
  const { pages, objects } = buildSample()
  const sameName = existing.filter((file) => file.name.startsWith(SAMPLE_NAME)).length
  const name = sameName === 0 ? SAMPLE_NAME : `${SAMPLE_NAME} ${sameName + 1}`
  return { id: uid('file'), name, pages, objects }
}

export const useStore = create<AppState>((set, get) => {
  const activeFile = () => {
    const state = get()
    return state.files.find((file) => file.id === state.activeFileId)
  }

  const patchFile = (patch: (file: DocFile) => Partial<DocFile>) =>
    set((state) => ({
      files: state.files.map((file) => (file.id === state.activeFileId ? { ...file, ...patch(file) } : file)),
    }))

  const restore = (snapshot: Snapshot) => patchFile(() => ({ pages: snapshot.pages, objects: snapshot.objects }))

  return {
    screen: 'start',
    files: [],
    folders: [],
    activeFileId: null,
    tool: 'select',
    toast: null,
    dialog: null,
    sidebar: 'closed',
    selectedId: null,
    editingId: null,
    canUndo: false,
    canRedo: false,

    openSample: async () => {
      const file = await createSampleFile(get().files)
      set((state) => ({ files: [...state.files, file] }))
      get().openFile(file.id)
    },

    addSampleFile: async () => {
      const file = await createSampleFile(get().files)
      set((state) => ({ files: [...state.files, file] }))
    },

    copyFile: (id) => {
      set((state) => {
        const index = state.files.findIndex((file) => file.id === id)
        if (index < 0) return {}
        const source = state.files[index]
        // Pages and objects are never mutated in place, so the copy can start from the same ones.
        const copy: DocFile = { ...source, id: uid('file'), name: `${source.name} copy` }
        return { files: [...state.files.slice(0, index + 1), copy, ...state.files.slice(index + 1)] }
      })
    },

    deleteFile: (id) => {
      set((state) => {
        const files = state.files.filter((file) => file.id !== id)
        // With no files left the app starts over, so the folders go too.
        if (files.length === 0) return { files, folders: [], activeFileId: null, screen: 'start' }
        return { files, activeFileId: state.activeFileId === id ? files[0].id : state.activeFileId }
      })
    },

    addFolder: (name) => {
      const id = uid('folder')
      set((state) => ({ folders: [...state.folders, { id, name: name.trim() || 'New folder' }] }))
      return id
    },

    deleteFolder: (id) => {
      set((state) => ({
        folders: state.folders.filter((folder) => folder.id !== id),
        files: state.files.map((file) => (file.folderId === id ? { ...file, folderId: undefined } : file)),
      }))
    },

    moveFile: (fileId, folderId) => {
      set((state) => ({
        files: state.files.map((file) => (file.id === fileId ? { ...file, folderId: folderId ?? undefined } : file)),
      }))
    },

    openFile: (id) => {
      resetHistory()
      set({
        activeFileId: id,
        screen: 'editor',
        tool: 'select',
        dialog: null,
        sidebar: 'closed',
        selectedId: null,
        editingId: null,
        canUndo: false,
        canRedo: false,
      })
    },

    goHome: () => {
      get().deselect()
      set({ screen: 'home', sidebar: 'closed', dialog: null })
    },

    setSidebar: (sidebar) => {
      get().deselect()
      set({ sidebar })
    },

    reorderPages: (pageIds) => {
      const before = get().snapshot()
      patchFile((file) => ({
        pages: pageIds.flatMap((id) => file.pages.find((page) => page.id === id) ?? []),
      }))
      get().record(before)
    },

    insertPage: (index) => {
      const before = get().snapshot()
      const page: Page = { id: uid('page'), height: PAGE_HEIGHT, rotation: 0 }
      patchFile((file) => ({ pages: [...file.pages.slice(0, index), page, ...file.pages.slice(index)] }))
      get().record(before)
    },

    rotatePage: (pageId) => {
      const before = get().snapshot()
      patchFile((file) => ({
        pages: file.pages.map((page) =>
          page.id === pageId ? { ...page, rotation: ((page.rotation + 90) % 360) as Page['rotation'] } : page,
        ),
      }))
      get().record(before)
    },

    duplicatePage: (pageId) => {
      const before = get().snapshot()
      patchFile((file) => {
        const index = file.pages.findIndex((page) => page.id === pageId)
        if (index < 0) return {}
        const copy: Page = { ...file.pages[index], id: uid('page') }
        const contents = file.objects
          .filter((object) => object.pageId === pageId)
          .map((object) => ({ ...object, id: uid('obj'), pageId: copy.id }))
        return {
          pages: [...file.pages.slice(0, index + 1), copy, ...file.pages.slice(index + 1)],
          objects: [...file.objects, ...contents],
        }
      })
      get().record(before)
    },

    deletePage: (pageId) => {
      const before = get().snapshot()
      if (before.pages.length <= 1) return
      patchFile((file) => ({
        pages: file.pages.filter((page) => page.id !== pageId),
        objects: file.objects.filter((object) => object.pageId !== pageId),
      }))
      get().record(before)
    },

    extractPages: (pageIds, name) => {
      const source = activeFile()
      if (!source) return
      const wanted = new Set(pageIds)
      // Pages and objects are never mutated in place, so the new file can start from the same ones.
      const extracted: DocFile = {
        id: uid('file'),
        name: name.trim() || `${source.name} extract`,
        pages: source.pages.filter((page) => wanted.has(page.id)),
        objects: source.objects.filter((object) => wanted.has(object.pageId)),
      }
      if (extracted.pages.length === 0) return
      set((state) => ({ files: [...state.files, extracted] }))
      get().openFile(extracted.id)
    },

    setTool: (tool) => {
      if (tool === 'select') {
        get().commitEditing({ keepSelected: true })
        set({ tool })
        return
      }
      set({ tool })
      // In the Text tool a selected text box is always being edited; anything else is deselected.
      const { selectedId, editingId } = get()
      if (!selectedId || editingId) return
      const selected = activeFile()?.objects.find((object) => object.id === selectedId)
      if (selected?.type === 'text') get().startEditing(selectedId)
      else set({ selectedId: null })
    },

    showToast: (message) => {
      window.clearTimeout(toastTimer)
      set({ toast: message })
      toastTimer = window.setTimeout(() => set({ toast: null }), 1800)
    },

    setDialog: (dialog) => set({ dialog }),

    select: (id) => {
      if (get().editingId && get().editingId !== id) get().commitEditing()
      // Only text is edited with the Text tool: selecting anything else returns to the cursor.
      const object = activeFile()?.objects.find((item) => item.id === id)
      set(object && object.type !== 'text' ? { selectedId: id, tool: 'select' } : { selectedId: id })
    },

    deselect: () => {
      get().commitEditing()
      set({ selectedId: null })
    },

    startEditing: (id) => {
      if (get().editingId === id) return
      get().commitEditing()
      editSession = { id, before: get().snapshot(), isNew: false }
      set({ selectedId: id, editingId: id, tool: 'text' })
    },

    commitEditing: ({ keepSelected = false } = {}) => {
      const { editingId } = get()
      if (!editingId) return
      const session = editSession
      editSession = null
      const object = activeFile()?.objects.find((item) => item.id === editingId)
      const empty = object?.type !== 'text' || isEmptyHtml(object.html)

      if (empty && session?.isNew) {
        // A new box left empty never existed: put everything back and add no undo step.
        restore(session.before)
        set({ editingId: null, selectedId: null })
        return
      }
      if (empty) {
        patchFile((file) => ({ objects: file.objects.filter((item) => item.id !== editingId) }))
      }
      set({ editingId: null, selectedId: keepSelected && !empty ? editingId : null })
      if (session) get().record(session.before)
    },

    createTextBox: (pageId, x, y) => {
      get().commitEditing()
      const before = get().snapshot()
      const page = before.pages.find((item) => item.id === pageId)
      const pageHeight = page?.height ?? PAGE_HEIGHT
      // The box runs from the tap to the right margin, so text wraps at the margin.
      const left = clamp(x, 0, PAGE_WIDTH - PAGE_MARGIN - NEW_BOX_MIN_WIDTH)
      const object: TextObject = {
        id: uid('obj'),
        pageId,
        type: 'text',
        x: left,
        y: clamp(y - NEW_BOX_LINE_HEIGHT / 2, 0, pageHeight - NEW_BOX_LINE_HEIGHT),
        width: PAGE_WIDTH - PAGE_MARGIN - left,
        height: NEW_BOX_LINE_HEIGHT,
        html: '',
        size: 'md',
        font: 'formal',
        color: 'black',
        align: 'left',
      }
      editSession = { id: object.id, before, isNew: true }
      patchFile((file) => ({ objects: [...file.objects, object] }))
      set({ selectedId: object.id, editingId: object.id, tool: 'text' })
      return object.id
    },

    addObject: (object, { select = true, growPage = false } = {}) => {
      get().commitEditing()
      const before = get().snapshot()
      const page = before.pages.find((item) => item.id === object.pageId)
      const pageHeight = page?.height ?? PAGE_HEIGHT
      let x = clamp(object.x, 0, PAGE_WIDTH - object.width)
      // Normally the object is kept on the page. With growPage, the page gets taller instead.
      let y = growPage ? Math.max(object.y, 0) : clamp(object.y, 0, pageHeight - object.height)
      // Step aside if something was just placed on this exact spot.
      while (before.objects.some((item) => item.pageId === object.pageId && item.x === x && item.y === y)) {
        x += 12
        y += 12
      }
      const id = uid('obj')
      patchFile((file) => {
        const objects = [...file.objects, { ...object, id, x, y } as DocObject]
        const pages = file.pages.map((item) =>
          item.id === object.pageId ? { ...item, height: fitPageHeight(item, objects) } : item,
        )
        return { objects, pages }
      })
      if (select) set({ selectedId: id, tool: 'select' })
      get().record(before)
      return id
    },

    typeInto: (id, html, height) => {
      patchFile((file) => {
        const target = file.objects.find((object) => object.id === id)
        if (!target) return {}
        const delta = height - target.height
        const oldBottom = target.y + target.height
        const objects = file.objects.map((object) => {
          if (object.id === id) return { ...object, html, height } as DocObject
          const below = object.pageId === target.pageId && object.y >= oldBottom - 0.5
          return delta !== 0 && below ? { ...object, y: object.y + delta } : object
        })
        if (delta === 0) return { objects }
        const pages = file.pages.map((page) =>
          page.id === target.pageId ? { ...page, height: fitPageHeight(page, objects) } : page,
        )
        return { objects, pages }
      })
    },

    updateObject: (id, patch) => {
      patchFile((file) => ({
        objects: file.objects.map((object) => (object.id === id ? ({ ...object, ...patch } as DocObject) : object)),
      }))
    },

    placeObject: (id, pageId, x, y) => {
      patchFile((file) => {
        const page = file.pages.find((item) => item.id === pageId)
        if (!page) return {}
        return {
          objects: file.objects.map((object) =>
            object.id === id
              ? {
                  ...object,
                  pageId,
                  x: clamp(x, 0, PAGE_WIDTH - object.width),
                  y: clamp(y, 0, page.height - object.height),
                }
              : object,
          ),
        }
      })
    },

    deleteSelected: () => {
      const { selectedId } = get()
      if (!selectedId) return
      const before = get().snapshot()
      editSession = null
      patchFile((file) => ({ objects: file.objects.filter((object) => object.id !== selectedId) }))
      set({ selectedId: null, editingId: null })
      get().record(before)
    },

    snapshot: () => {
      const file = activeFile()
      return { pages: file?.pages ?? [], objects: file?.objects ?? [] }
    },

    record: (before) => {
      if (sameSnapshot(before, get().snapshot())) return
      past.push(before)
      if (past.length > HISTORY_LIMIT) past.shift()
      future = []
      set({ canUndo: true, canRedo: false })
    },

    undo: () => {
      get().commitEditing()
      const previous = past.pop()
      if (!previous) return
      future.push(get().snapshot())
      restore(previous)
      set({ selectedId: null, editingId: null, canUndo: past.length > 0, canRedo: true })
    },

    redo: () => {
      get().commitEditing()
      const next = future.pop()
      if (!next) return
      past.push(get().snapshot())
      restore(next)
      set({ selectedId: null, editingId: null, canUndo: true, canRedo: future.length > 0 })
    },
  }
})

export function useActiveFile(): DocFile | undefined {
  return useStore((state) => state.files.find((file) => file.id === state.activeFileId))
}
