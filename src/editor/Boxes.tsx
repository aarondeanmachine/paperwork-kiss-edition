import { useEffect, useRef, useState } from 'react'
import { Calendar, Mail, Plus, Type, User, UserPlus, type LucideIcon } from 'lucide-react'
import {
  FieldContent,
  FieldShell,
  ImageContent,
  LineContent,
  SignatureRequestContent,
} from '../components/ObjectContent'
import { MenuDivider, MenuItem, MenuLabel, Popover, type Placement } from '../components/Popover'
import { FIELD_GAP, FIELD_HEIGHT } from '../lib/layout'
import { useStore } from '../store'
import type { FieldObject, ImageObject, LineObject, SignatureRequestObject, Signer } from '../types'
import { ObjectFrame } from './ObjectFrame'

/** Two taps this close together (ms) count as a double tap. */
const DOUBLE_TAP = 450

const select = (id: string) => useStore.getState().select(id)

/* ---------- Signature image and photo ---------- */

export function ImageBox({ object }: { object: ImageObject }) {
  return (
    <ObjectFrame
      object={object}
      resize="aspect"
      minWidth={32}
      className="obj-image"
      onTap={() => select(object.id)}
    >
      <ImageContent object={object} />
    </ObjectFrame>
  )
}

/* ---------- Line ---------- */

/** A drawn line: it can be selected, moved, made longer or shorter, and deleted. */
export function LineBox({ object }: { object: LineObject }) {
  return (
    <ObjectFrame object={object} resize="width" minWidth={16} className="obj-line" onTap={() => select(object.id)}>
      <LineContent />
    </ObjectFrame>
  )
}

/* ---------- The + attached to a signer's boxes ---------- */

interface SignerField {
  label: string
  icon: LucideIcon
  /** What the field starts with: details the sender already knows are filled in. */
  value: (signer: Signer) => string
  /** Generic fields show the person's name in the box, since the label does not say whose it is. */
  showSigner?: boolean
}

const SIGNER_FIELDS: SignerField[] = [
  { label: 'Name', icon: User, value: (signer) => signer.name },
  { label: 'Email', icon: Mail, value: (signer) => signer.email },
  { label: 'Date signed', icon: Calendar, value: () => '', showSigner: true },
  { label: 'Text', icon: Type, value: () => '', showSigner: true },
]

type SignerBox = (SignatureRequestObject | FieldObject) & { signer: Signer }

/**
 * Shown on any selected box that belongs to a signer: the signature placeholder
 * and every field added for that person. Adds more fields for the same person,
 * or starts a new person.
 */
function SignerAttachment({ object }: { object: SignerBox }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement>('bottom-end')
  const { signer } = object

  /** Each new field stacks under everything this person already has on the page. */
  const addField = (field: SignerField) => {
    setMenuOpen(false)
    const state = useStore.getState()
    const theirs = state
      .snapshot()
      .objects.filter(
        (item) =>
          item.pageId === object.pageId &&
          (item.type === 'field' || item.type === 'signatureRequest') &&
          item.signer?.id === signer.id,
      )
    const lowest = Math.max(object.y + object.height, ...theirs.map((item) => item.y + item.height))
    state.addObject(
      {
        type: 'field',
        pageId: object.pageId,
        x: object.x,
        y: lowest + FIELD_GAP,
        width: object.width,
        height: FIELD_HEIGHT,
        label: field.label,
        value: field.value(signer),
        signer,
        showSigner: field.showSigner,
      },
      // The box stays selected, so several fields can be added in a row. Near the
      // bottom of a page the page grows, so the fields never pile up on each other.
      { select: false, growPage: true },
    )
  }

  return (
    <Popover
      className="signer-add"
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      label={`Add a field for ${signer.name}`}
      placement={placement}
      trigger={
        <button
          type="button"
          className="attach-btn"
          aria-label={`Add a field for ${signer.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            // Open toward whichever side of the frame has more room.
            const frame = event.currentTarget.closest('.frame')?.getBoundingClientRect()
            const button = event.currentTarget.getBoundingClientRect()
            const onRightHalf = frame ? button.left + button.width / 2 > frame.left + frame.width / 2 : true
            setPlacement(onRightHalf ? 'bottom-end' : 'bottom-start')
            setMenuOpen((open) => !open)
          }}
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden />
        </button>
      }
    >
      <MenuLabel>Fields for {signer.name}</MenuLabel>
      {SIGNER_FIELDS.map((field) => (
        <MenuItem key={field.label} icon={field.icon} label={field.label} onSelect={() => addField(field)} />
      ))}
      <MenuDivider />
      <MenuItem
        icon={UserPlus}
        label="Add additional person"
        onSelect={() => {
          setMenuOpen(false)
          useStore.getState().setDialog('person')
        }}
      />
    </Popover>
  )
}

/* ---------- Form field ---------- */

/** Placed like any object. A double tap turns it into an input; the typed value stays in the box. */
export function FieldBox({ object }: { object: FieldObject }) {
  const [typing, setTyping] = useState(false)
  const lastTap = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!typing) return
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [typing])

  const commit = (value: string) => {
    setTyping(false)
    if (value === object.value) return
    const state = useStore.getState()
    const before = state.snapshot()
    state.updateObject(object.id, { value })
    state.record(before)
  }

  return (
    <ObjectFrame
      object={object}
      resize="free"
      minWidth={48}
      minHeight={18}
      className="obj-field"
      locked={typing}
      onTap={(event) => {
        const isDouble = event.timeStamp - lastTap.current < DOUBLE_TAP
        lastTap.current = event.timeStamp
        select(object.id)
        if (isDouble) setTyping(true)
      }}
      attachment={object.signer && <SignerAttachment object={{ ...object, signer: object.signer }} />}
    >
      {typing ? (
        <FieldShell object={object}>
          <input
            ref={inputRef}
            className="field-input"
            defaultValue={object.value}
            placeholder={object.label}
            aria-label={object.label}
            autoComplete="off"
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                // Escape abandons the typing but keeps the field selected.
                event.stopPropagation()
                event.currentTarget.value = object.value
                event.currentTarget.blur()
              }
            }}
          />
        </FieldShell>
      ) : (
        <FieldContent object={object} />
      )}
    </ObjectFrame>
  )
}

/* ---------- Signature request ---------- */

/** Where the other person signs. */
export function SignatureRequestBox({ object }: { object: SignatureRequestObject }) {
  return (
    <ObjectFrame
      object={object}
      resize="free"
      minWidth={90}
      minHeight={32}
      className="obj-request"
      onTap={() => select(object.id)}
      attachment={<SignerAttachment object={object} />}
    >
      <SignatureRequestContent object={object} />
    </ObjectFrame>
  )
}
