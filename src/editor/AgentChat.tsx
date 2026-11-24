import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Sparkle, X } from 'lucide-react'

const CANNED_REPLY =
  'I am just a mockup, but in production I will be able to do all sorts of smart stuff to the document'
const REPLY_DELAY = 700

interface Message {
  id: number
  from: 'user' | 'agent'
  text: string
}

/**
 * The toolbar's Ask agent mode: a chat field that grows into a small chat once
 * the first message is sent. Every message gets the same canned reply.
 */
export function AgentChat({ onClose, onResize }: { onClose: () => void; onResize: () => void }) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(undefined)
  const nextId = useRef(0)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    return () => window.clearTimeout(timer.current)
  }, [])

  // Keep the newest message in view, and let the toolbar re-anchor as the chat grows.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
    onResize()
  }, [messages, thinking, onResize])

  const send = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((list) => [...list, { id: nextId.current++, from: 'user', text }])
    setDraft('')
    setThinking(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setMessages((list) => [...list, { id: nextId.current++, from: 'agent', text: CANNED_REPLY }])
      setThinking(false)
    }, REPLY_DELAY)
  }

  const started = messages.length > 0

  return (
    <div className="format-bar agent" data-started={started || undefined}>
      {started && (
        <div className="agent-log" ref={logRef} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className="agent-msg" data-from={message.from}>
              {message.text}
            </div>
          ))}
          {thinking && (
            <div className="agent-msg agent-thinking" data-from="agent" aria-label="Agent is typing">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      )}
      <form className="agent-field" onSubmit={send}>
        <Sparkle size={16} strokeWidth={1.5} aria-hidden />
        <input
          ref={inputRef}
          className="agent-input"
          value={draft}
          placeholder="Ask agent"
          aria-label="Message the agent"
          autoComplete="off"
          enterKeyHint="send"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            // Escape leaves the chat without also deselecting the box.
            event.stopPropagation()
            onClose()
          }}
        />
        {draft.trim() && (
          <button type="submit" className="agent-send" aria-label="Send">
            <ArrowUp size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
        <button type="button" className="format-btn" aria-label="Close agent" onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </form>
    </div>
  )
}
