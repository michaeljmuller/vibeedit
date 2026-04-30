import { useState, useEffect, useRef } from 'react'

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
        const content = typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content, null, 2)
        parts.push(`${role}:\n${content}`)
      }
    }

    if (entry.error) {
      parts.push(`ERROR:\n${entry.error}`)
    } else {
      let responseText = entry.response ?? ''
      try {
        responseText = JSON.stringify(JSON.parse(responseText), null, 2)
      } catch {}
      parts.push(`RESPONSE:\n${responseText}`)
    }

    return parts.join('\n\n')
  }).join('\n\n\n')
}

export default function SettingsPage({ lang, languages, onLangChange, prompt, onPromptChange, onBack }) {
  const [logText, setLogText] = useState('Loading…')
  const [releaseNotes, setReleaseNotes] = useState('')
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logText])

  useEffect(() => {
    fetch('/api/release-notes')
      .then(r => r.json())
      .then(d => setReleaseNotes(d.text))
      .catch(() => setReleaseNotes('(failed to load)'))
  }, [])

  const fetchLog = async () => {
    try {
      const res = await fetch('/api/log')
      const data = await res.json()
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
    <div className="settings-page">
      <div className="settings-nav">
        <button className="settings-back-btn" onClick={onBack}>← Back to editor</button>
        <span className="settings-page-heading">Settings</span>
      </div>
      <div className="settings-body">
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-lang">Language</label>
          <select
            id="settings-lang"
            className="settings-lang-select"
            value={lang}
            onChange={e => onLangChange(e.target.value)}
          >
            {languages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-prompt">Chat Prompt</label>
          <p className="settings-hint">
            Sent with every chat message. Use{' '}
            <code>{'{{language}}'}</code>{' '}
            to insert the name of the selected language.
          </p>
          <textarea
            id="settings-prompt"
            className="settings-textarea"
            value={prompt}
            onChange={onPromptChange}
            autoFocus
            spellCheck={false}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">Release Notes</label>
          <textarea
            className="settings-release-textarea"
            value={releaseNotes}
            readOnly
            spellCheck={false}
          />
        </div>
        <div className="settings-field settings-field--grow">
          <div className="settings-log-header">
            <label className="settings-label">LLM Log</label>
            <button className="settings-log-btn" onClick={fetchLog}>Refresh</button>
            <button className="settings-log-btn" onClick={clearLog}>Clear</button>
          </div>
          <textarea
            ref={logRef}
            className="settings-log-textarea"
            value={logText}
            readOnly
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
