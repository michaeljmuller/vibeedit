import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'

export default function ChatPanel({ getEditorText, history, setHistory, active }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    const newHistory = [...history, { role: 'user', content: q }]
    setHistory(newHistory)
    setQuestion('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editorText: getEditorText(),
          history: history,
          question: q,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHistory([...newHistory, { role: 'assistant', content: data.response }])
    } catch (err) {
      setError(err.message)
      setHistory(history) // revert optimistic update
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-bar chat-panel">
      <div className="chat-messages">
        {history.length === 0 && (
          <p className="chat-empty">Ask a question about your document…</p>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`chat-message chat-message--${msg.role}`}>
            <span className="chat-role">{msg.role === 'user' ? 'You' : 'Claude'}</span>
            {msg.role === 'assistant'
              ? <div className="chat-bubble"><Markdown>{msg.content}</Markdown></div>
              : <p>{msg.content}</p>
            }
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-message--assistant">
            <span className="chat-role">Claude</span>
            <p className="chat-thinking">Thinking…</p>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={loading || !question.trim()}>Send</button>
      </form>
    </div>
  )
}
