import { useState } from 'react'

export default function DictionaryPanel({ state, setState }) {
  const { word, dir, results, error, loading } = state
  const [input, setInput] = useState(word || '')

  const lookup = async (w, d) => {
    setState(s => ({ ...s, loading: true, error: null, results: null, word: w, dir: d }))
    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w, dir: d, lang: 'pt' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setState(s => ({ ...s, results: data.results, loading: false }))
    } catch (err) {
      setState(s => ({ ...s, error: err.message, loading: false }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) lookup(input.trim(), dir || 'ptToEn')
  }

  const handleDirToggle = (newDir) => {
    setState(s => ({ ...s, dir: newDir }))
    if (word) lookup(word, newDir)
  }

  const handleResultClick = (w) => {
    const newDir = dir === 'ptToEn' ? 'enToPt' : 'ptToEn'
    setInput(w)
    lookup(w, newDir)
  }

  const currentDir = dir || 'ptToEn'

  return (
    <div className="prompt-bar dict-panel">
      <div className="dict-header">
        <label>Dictionary</label>
        <div className="dict-dir-toggle">
          <button
            className={currentDir === 'ptToEn' ? 'active' : ''}
            onClick={() => handleDirToggle('ptToEn')}
          >PT → EN</button>
          <button
            className={currentDir === 'enToPt' ? 'active' : ''}
            onClick={() => handleDirToggle('enToPt')}
          >EN → PT</button>
        </div>
      </div>
      <form className="dict-input-row" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={currentDir === 'ptToEn' ? 'Portuguese word…' : 'English word…'}
          autoFocus
        />
        <button type="submit" disabled={loading}>Look up</button>
      </form>
      {loading && <p className="dict-status">Looking up…</p>}
      {error && <p className="dict-status dict-error">{error}</p>}
      {results && results.length === 0 && <p className="dict-status">No results found.</p>}
      {results && results.length > 0 && (
        <div className="dict-results">
          {results.map((r, i) => {
            const clickWord = currentDir === 'ptToEn' ? r.en : r.pt
            const mainWord = currentDir === 'ptToEn' ? r.pt : r.en
            return (
              <div key={i} className="dict-row">
                <span className="dict-main">{mainWord}</span>
                {r.gender && <span className="dict-gender">{r.gender}</span>}
                {r.variant === 'br' && <span className="dict-badge dict-badge--br">BR</span>}
                {r.variant === 'pt' && <span className="dict-badge dict-badge--pt">PT</span>}
                <span className="dict-arrow">→</span>
                <button className="dict-result-btn" onClick={() => handleResultClick(clickWord)}>
                  {clickWord}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
