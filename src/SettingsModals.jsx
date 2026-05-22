import { useState, useEffect, useRef } from 'react'

function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-x-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function LanguageModal({ lang, languages, onSave, onClose }) {
  const [value, setValue] = useState(lang)
  return (
    <Modal title="Language" onClose={onClose} footer={
      <>
        <button className="modal-btn modal-btn--secondary" onClick={onClose}>Cancel</button>
        <button className="modal-btn modal-btn--primary" onClick={() => { onSave(value); onClose() }}>Save</button>
      </>
    }>
      <select className="modal-lang-select" value={value} onChange={e => setValue(e.target.value)}>
        {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </Modal>
  )
}

export function PromptModal({ prompt, onSave, onClose }) {
  const [value, setValue] = useState(prompt)
  return (
    <Modal title="Chat Prompt" onClose={onClose} footer={
      <>
        <button className="modal-btn modal-btn--secondary" onClick={onClose}>Cancel</button>
        <button className="modal-btn modal-btn--primary" onClick={() => { onSave(value); onClose() }}>Save</button>
      </>
    }>
      <p className="modal-hint">
        Sent with every chat message. Use <code>{'{{language}}'}</code> to insert the name of the selected language.
      </p>
      <textarea
        className="modal-textarea"
        value={value}
        onChange={e => setValue(e.target.value)}
        autoFocus
        spellCheck={false}
      />
    </Modal>
  )
}

export function ReleaseNotesModal({ onClose }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    fetch('/api/release-notes')
      .then(r => r.json())
      .then(d => setText(d.text))
      .catch(() => setText('(failed to load)'))
  }, [])
  return (
    <Modal title="Release Notes" onClose={onClose} footer={
      <button className="modal-btn modal-btn--secondary" onClick={onClose}>Close</button>
    }>
      <textarea className="modal-textarea modal-textarea--readonly" value={text} readOnly spellCheck={false} />
    </Modal>
  )
}

function formatLog(entries) {
  if (entries.length === 0) return '(no log entries yet)'
  return entries.map(entry => {
    const ts = new Date(entry.ts).toLocaleString()
    const header = `${'━'.repeat(60)}\n${entry.type.toUpperCase()}  ${ts}  (${entry.durationMs}ms)\n${'━'.repeat(60)}`
    const parts = [header]
    if (entry.system) parts.push(`SYSTEM:\n${entry.system}`)
    if (entry.messages) {
      for (const msg of entry.messages) {
        const role = msg.role.toUpperCase()
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)
        parts.push(`${role}:\n${content}`)
      }
    }
    if (entry.error) {
      parts.push(`ERROR:\n${entry.error}`)
    } else {
      let responseText = entry.response ?? ''
      try { responseText = JSON.stringify(JSON.parse(responseText), null, 2) } catch {}
      parts.push(`RESPONSE:\n${responseText}`)
    }
    return parts.join('\n\n')
  }).join('\n\n\n')
}

export function LogsModal({ onClose }) {
  const [logText, setLogText] = useState('Loading…')
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logText])

  const fetchLog = async () => {
    try {
      const data = await fetch('/api/log').then(r => r.json())
      setLogText(formatLog(data.entries))
    } catch {
      setLogText('(failed to load log)')
    }
  }

  const clearLog = async () => {
    await fetch('/api/log', { method: 'DELETE' })
    setLogText('(log cleared)')
  }

  useEffect(() => { fetchLog() }, [])

  return (
    <Modal title="LLM Log" onClose={onClose} footer={
      <>
        <button className="modal-btn modal-btn--secondary" onClick={fetchLog}>Refresh</button>
        <button className="modal-btn modal-btn--secondary" onClick={clearLog}>Clear</button>
        <button className="modal-btn modal-btn--secondary" onClick={onClose}>Close</button>
      </>
    }>
      <textarea
        ref={logRef}
        className="modal-textarea modal-textarea--readonly modal-textarea--log"
        value={logText}
        readOnly
        spellCheck={false}
      />
    </Modal>
  )
}
