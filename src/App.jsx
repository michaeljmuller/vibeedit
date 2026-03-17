import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FooHighlight } from './FooHighlight'
import ChatPanel from './ChatPanel'
import ConjugatePanel from './ConjugatePanel'
import DictionaryPanel from './DictionaryPanel'

const DEFAULT_PROMPT = 'Review the text for grammatical errors, unclear phrasing, and style issues. Flag specific problems with suggested corrections.'

const IS_MAC = /macintosh|mac os x/i.test(navigator.userAgent)

const PANELS = [
  { id: 'check',      label: 'Check' },
  { id: 'chat',       label: 'Chat' },
  { id: 'translate',  label: 'Translate' },
  { id: 'conjugate',  label: 'Conjugate' },
  { id: 'dictionary', label: 'Dictionary' },
]

const MenuBar = ({ editor, onCheck, checking, activePanel, onPanelToggle, ctrlHeld }) => {
  if (!editor) return null

  const label = (idx, text) => ctrlHeld ? `${text} [${idx + 1}]` : text

  return (
    <div className="menu-bar">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}>Bold</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}>Italic</button>
      <span className="divider" />
      <button onClick={onCheck} disabled={checking} className={`check-btn${ctrlHeld ? ' hotkey-hint' : ''}`}>
        {checking ? 'Checking…' : label(0, 'Check')}
      </button>
      {PANELS.slice(1).map((p, i) => (
        <button
          key={p.id}
          onClick={() => onPanelToggle(p.id)}
          className={`${activePanel === p.id ? 'active' : ''}${ctrlHeld ? ' hotkey-hint' : ''}`}
        >
          {label(i + 1, p.label)}
        </button>
      ))}
    </div>
  )
}

function TranslatePanel({ getEditorHtml }) {
  const [translation, setTranslation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setTranslation(null)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: getEditorHtml() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranslation(data.translation)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [])

  return (
    <div className="prompt-bar translate-panel">
      <div className="translate-header">
        <label>English translation</label>
        <button className="retranslate-btn" onClick={run} disabled={loading}>↺ Re-translate</button>
      </div>
      {loading && <p className="translate-status">Translating…</p>}
      {error && <p className="translate-status error">{error}</p>}
      {translation && <div className="translate-output tiptap" dangerouslySetInnerHTML={{ __html: translation }} />}
    </div>
  )
}

export default function App() {
  const [prompt, setPrompt] = useState(localStorage.getItem('vibeedit-prompt') ?? DEFAULT_PROMPT)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [conjugateState, setConjugateState] = useState({ verb: '', sections: null, error: null })
  const [dictState, setDictState] = useState({ word: '', results: null, error: null, loading: false })
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const hideTimer = useRef(null)
  const saveTimer = useRef(null)

  const editor = useEditor({
    autofocus: true,
    extensions: [StarterKit, FooHighlight],
    content: localStorage.getItem('vibeedit-content') ?? '<p>Start writing something amazing...</p>',
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      },
    },
    onUpdate({ editor }) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        localStorage.setItem('vibeedit-content', editor.getHTML())
      }, 500)
    },
  })

  const handlePanelToggle = (panel) => {
    setActivePanel(prev => {
      const next = prev === panel ? null : panel
      if (next === null) editor?.commands.focus()
      return next
    })
  }

  const handlePromptChange = (e) => {
    setPrompt(e.target.value)
    localStorage.setItem('vibeedit-prompt', e.target.value)
  }

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setError(null)
    editor.commands.setAnnotations([])

    const text = editor.getText()
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, prompt }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      editor.commands.setAnnotations(data.annotations)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }, [editor, prompt])

  useEffect(() => {
    if (!IS_MAC) return
    const onKeyDown = (e) => {
      if (e.key === 'Control') { setCtrlHeld(true); return }
      if (!e.ctrlKey) return
      if (e.key === '0') {
        e.preventDefault()
        setActivePanel(null)
        editor?.commands.focus()
        return
      }
      const idx = parseInt(e.key) - 1
      if (idx < 0 || idx >= PANELS.length) return
      e.preventDefault()
      const panel = PANELS[idx]
      if (panel.id === 'check') {
        handleCheck()
      } else {
        handlePanelToggle(panel.id)
      }
    }
    const onKeyUp = (e) => { if (e.key === 'Control') setCtrlHeld(false) }
    const onBlur = () => setCtrlHeld(false)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [handleCheck])

  const handleMouseOver = (e) => {
    const el = e.target.closest('.foo-highlight')
    if (!el) return
    clearTimeout(hideTimer.current)
    const rect = el.getBoundingClientRect()
    setTooltip({
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 6,
      message: el.getAttribute('data-message'),
    })
  }

  const handleMouseOut = (e) => {
    if (!e.target.closest('.foo-highlight')) return
    hideTimer.current = setTimeout(() => setTooltip(null), 100)
  }

  return (
    <div className="container">
      <h1>VibeEdit</h1>
      <div className="editor-wrapper">
        <MenuBar
          editor={editor}
          onCheck={handleCheck}
          checking={checking}
          activePanel={activePanel}
          onPanelToggle={handlePanelToggle}
          ctrlHeld={ctrlHeld}
        />
        {activePanel === 'prompt' && (
          <div className="prompt-bar">
            <label htmlFor="prompt">Review prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={handlePromptChange}
              rows={3}
              autoFocus
            />
          </div>
        )}
        {activePanel === 'translate' && (
          <TranslatePanel getEditorHtml={() => editor.getHTML()} />
        )}
        {activePanel === 'conjugate' && <ConjugatePanel state={conjugateState} setState={setConjugateState} />}
        {activePanel === 'dictionary' && <DictionaryPanel state={dictState} setState={setDictState} />}
        <div onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} spellCheck={false} autoCorrect="off" autoCapitalize="off">
          <EditorContent editor={editor} className="editor-content" />
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {activePanel === 'chat' && (
        <ChatPanel getEditorText={() => editor.getText()} history={chatHistory} setHistory={setChatHistory} />
      )}
      {tooltip && (
        <div
          className="error-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
          onMouseOver={() => clearTimeout(hideTimer.current)}
          onMouseOut={() => { hideTimer.current = setTimeout(() => setTooltip(null), 100) }}
        >
          {tooltip.message}
        </div>
      )}
    </div>
  )
}
