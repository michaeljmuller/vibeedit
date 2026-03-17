import { useState } from 'react'
import { Results } from './languages/pt'

export default function ConjugatePanel({ state, setState }) {
  const [loading, setLoading] = useState(false)
  const { verb, sections, error } = state

  const setVerb = (verb) => setState(s => ({ ...s, verb }))
  const setError = (error) => setState(s => ({ ...s, error }))
  const setSections = (sections) => setState(s => ({ ...s, sections }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = verb.trim()
    if (!v || loading) return
    setLoading(true)
    setError(null)
    setSections(null)
    try {
      const res = await fetch('/api/conjugate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verb: v, lang: 'pt' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSections(data.sections)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-bar conjugate-panel">
      <form className="conjugate-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={verb}
          onChange={e => setVerb(e.target.value)}
          placeholder="Enter a verb…"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !verb.trim()}>
          {loading ? 'Looking up…' : 'Conjugate'}
        </button>
      </form>
      {error && <p className="translate-status error">{error}</p>}
      {sections && <Results sections={sections} />}
    </div>
  )
}
