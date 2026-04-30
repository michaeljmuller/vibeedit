import { useState } from 'react'

const WORD_RE = /([A-Za-zÀ-ɏ]+(?:['’-][A-Za-zÀ-ɏ]+)*)/

function clickableText(text, onWordClick) {
  return text.split(WORD_RE).map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="dict-word-link" onClick={() => onWordClick(part)}>{part}</span>
      : part
  )
}

function DictResult({ result, onWordClick }) {
  return (
    <div className="dict-result">
      <div className="dict-result-header">
        <span className="dict-result-word">{result.word}</span>
      </div>
      {result.sections.map((sec, si) => (
        <div key={si} className="dict-section">
          {sec.pos && <span className="dict-result-pos">{sec.pos}</span>}
          <ol className="dict-senses">
            {sec.senses.map((s, i) => (
              <li key={i} className="dict-sense">
                {s.context && <span className="dict-context">({s.context}) </span>}
                <span className="dict-trans">{clickableText(s.trans, onWordClick)}</span>
                {s.examples.length > 0 && (
                  <ul className="dict-examples">
                    {s.examples.map((ex, j) => (
                      <li key={j} className="dict-example">
                        <span className="dict-ex-src">{clickableText(ex.src, onWordClick)}</span>
                        <span className="dict-ex-sep"> ▸ </span>
                        <span className="dict-ex-tgt">{clickableText(ex.tgt, onWordClick)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

export default function DictionaryPanel({ state, setState, lang }) {
  const { word, results, error, loading } = state
  const [input, setInput] = useState(word || '')

  const lookup = async (w) => {
    setState(s => ({ ...s, loading: true, error: null, results: null, word: w }))
    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w, lang }),
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
    if (input.trim()) lookup(input.trim())
  }

  const handleWordClick = (w) => {
    setInput(w)
    lookup(w)
  }

  return (
    <div className="panel-bar dict-panel">
      <label>Dictionary</label>
      <form className="dict-input-row" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Word…"
          autoFocus
          onFocus={e => e.target.select()}
        />
        <button type="submit" disabled={loading}>Look up</button>
      </form>
      {loading && <p className="dict-status">Looking up…</p>}
      {error && <p className="dict-status dict-error">{error}</p>}
      {results && (
        <div className="dict-results-list">
          {results.map((r, i) => <DictResult key={i} result={r} onWordClick={handleWordClick} />)}
        </div>
      )}
    </div>
  )
}
