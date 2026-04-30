import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'

export default function ChatPanel({ getEditorText, history, setHistory, active, prompt }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  useEffect(() => {
    if (active) textareaRef.current?.focus()
  }, [active])

  const adjustHeight = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  const handleChange = (e) => {
    setQuestion(e.target.value)
    adjustHeight()
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    if (!prompt?.trim()) {
      setError('No chat prompt configured. Open Settings to set one.')
      return
    }

    const newHistory = [...history, { role: 'user', content: q }]
    setHistory(newHistory)
    setQuestion('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    })
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
          prompt,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHistory([...newHistory, { role: 'assistant', content: data.response }])
    } catch (err) {
      setError(err.message)
      setHistory(history)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
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
        <textarea
          ref={textareaRef}
          value={question}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          rows={1}
          className="chat-textarea"
        />
        <button type="submit" disabled={loading || !question.trim()}>Send</button>
      </form>
    </div>
  )
}
