import { useState, type FormEvent } from 'react'
import { Camera, PenLine, Pencil, Send, TextCursorInput, Upload, type LucideIcon } from 'lucide-react'
import { Dialog } from '../components/Dialog'
import { createSigner, insertField, insertMySignature, insertSignatureRequest } from '../lib/insert'

type Step = 'choose' | 'mine' | 'request'
type StartWith = 'signature' | 'field'

const METHODS: { label: string; icon: LucideIcon }[] = [
  { label: 'Draw', icon: Pencil },
  { label: 'Upload', icon: Upload },
  { label: 'Photograph', icon: Camera },
]

const STARTS: { value: StartWith; label: string; icon: LucideIcon }[] = [
  { value: 'signature', label: 'Signature', icon: PenLine },
  { value: 'field', label: 'Form field', icon: TextCursorInput },
]

/** Places the first box for a new person: where they sign, or a field for them to fill in. */
function startPerson(name: string, email: string, startWith: StartWith): void {
  const signer = createSigner(name, email)
  if (startWith === 'signature') insertSignatureRequest(signer)
  else insertField(signer)
}

interface SignerFormProps {
  /** Lets the sender pick what this person starts with. Without it, they start with a signature. */
  chooseStart?: boolean
  onDone: () => void
}

/** Name and email of the person, and optionally whether they start with a signature or a form field. */
function SignerForm({ chooseStart = false, onDone }: SignerFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [startWith, setStartWith] = useState<StartWith>('signature')
  const valid = name.trim() !== '' && /^\S+@\S+\.\S+$/.test(email.trim())

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    startPerson(name.trim(), email.trim(), startWith)
    onDone()
  }

  return (
    <form className="dialog-form" onSubmit={save}>
      <label className="form-row">
        <span className="form-label">Name</span>
        <input
          className="input"
          value={name}
          placeholder="Jane Doe"
          autoComplete="off"
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="form-row">
        <span className="form-label">Email</span>
        <input
          className="input"
          type="email"
          inputMode="email"
          value={email}
          placeholder="jane@example.com"
          autoComplete="off"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {chooseStart && (
        <div className="form-row">
          <span className="form-label" id="start-with">
            Start with
          </span>
          <div className="choice-row" role="radiogroup" aria-labelledby="start-with">
            {STARTS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className="choice"
                role="radio"
                aria-checked={startWith === value}
                onClick={() => setStartWith(value)}
              >
                <Icon size={15} strokeWidth={1.5} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="dialog-note">You can add more fields and details in the next step.</p>
      <div className="dialog-actions">
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!valid}>
          Next
        </button>
      </div>
    </form>
  )
}

/** Signature flow: add my own signature, or request one from someone else. */
export function SignatureDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('choose')

  const placeMine = () => {
    // The mockup has no drawing, upload or camera: every method places the example signature.
    void insertMySignature()
    onClose()
  }

  if (step === 'mine') {
    return (
      <Dialog title="Add my signature" onClose={onClose} onBack={() => setStep('choose')}>
        <div className="method-grid">
          {METHODS.map(({ label, icon: Icon }) => (
            <button key={label} type="button" className="method" onClick={placeMine}>
              <Icon size={18} strokeWidth={1.5} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Dialog>
    )
  }

  if (step === 'request') {
    return (
      <Dialog title="Request a signature" onClose={onClose} onBack={() => setStep('choose')}>
        <SignerForm onDone={onClose} />
      </Dialog>
    )
  }

  return (
    <Dialog title="Signature" onClose={onClose}>
      <div className="option-list">
        <button type="button" className="option" onClick={() => setStep('mine')}>
          <span className="option-icon">
            <PenLine size={16} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="option-text">
            <span className="option-title">Add my signature</span>
            <span className="option-sub">Draw, upload or photograph it</span>
          </span>
        </button>
        <button type="button" className="option" onClick={() => setStep('request')}>
          <span className="option-icon">
            <Send size={16} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="option-text">
            <span className="option-title">Request a signature</span>
            <span className="option-sub">Mark where someone else signs</span>
          </span>
        </button>
      </div>
    </Dialog>
  )
}

/** Opened from "Add additional person" on a signer's +: a new person, starting with a signature or a field. */
export function PersonDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Add additional person" onClose={onClose}>
      <SignerForm chooseStart onDone={onClose} />
    </Dialog>
  )
}
