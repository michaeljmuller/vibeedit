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
  { id: 'prompt',     label: 'Prompt' },
  { id: 'translate',  label: 'Translate' },
  { id: 'conjugate',  label: 'Conjugate' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'speak',      label: 'Speak' },
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

const VOICES = ['alloy', 'ash', 'ballad', 'cedar', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse']

function SpeakPanel({ getEditorText, active }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [voice, setVoice] = useState(() => localStorage.getItem('vibeedit-voice') ?? 'cedar')
  const audioRef = useRef(null)

  const handleVoiceChange = (e) => {
    setVoice(e.target.value)
    localStorage.setItem('vibeedit-voice', e.target.value)
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    setAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setCurrentTime(0)
    setDuration(0)
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: getEditorText(), voice }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      const blob = await res.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasActivated = useRef(false)
  useEffect(() => {
    if (active && !hasActivated.current) {
      hasActivated.current = true
      generate()
    }
  }, [active])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    isPlaying ? a.pause() : a.play()
  }

  const skip = (secs) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + secs))
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="panel-bar speak-panel">
      <div className="speak-header">
        <label>Text to Speech</label>
        <div className="speak-header-controls">
          <select className="voice-picker" value={voice} onChange={handleVoiceChange} disabled={loading}>
            {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button className="regen-btn" onClick={generate} disabled={loading}>↺ Re-generate</button>
        </div>
      </div>
      {loading && <p className="speak-status">Generating audio…</p>}
      {error && <p className="speak-status error">{error}</p>}
      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
            onLoadedMetadata={e => { setDuration(e.target.duration); e.target.play() }}
          />
          <div className="speak-controls">
            <button className="speak-skip" onClick={() => skip(-10)}>«10s</button>
            <button className="speak-playpause" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="speak-skip" onClick={() => skip(10)}>10s»</button>
            <input
              type="range" className="speak-progress"
              min={0} max={duration || 0} step={0.1} value={currentTime}
              onChange={e => { audioRef.current.currentTime = e.target.value }}
            />
            <span className="speak-time">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function TranslatePanel({ getEditorHtml }) {
  const [translation, setTranslation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastTranslatedHtml = useRef(null)

  const run = async (force = false) => {
    const html = getEditorHtml()
    if (!force && html === lastTranslatedHtml.current) return
    lastTranslatedHtml.current = html
    setTranslation(null)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: html }),
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
    <div className="panel-bar translate-panel">
      <div className="translate-header">
        <label>English translation</label>
        <button className="retranslate-btn" onClick={() => run(true)} disabled={loading}>↺ Re-translate</button>
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
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('vibeedit-panel-height')) || 220)
  const hideTimer = useRef(null)
  const saveTimer = useRef(null)
  const dragState = useRef(null)
  const panelContentRef = useRef(null)

  useEffect(() => {
    if (!panelContentRef.current) return
    const ro = new ResizeObserver(entries => {
      if (dragState.current) return
      const contentHeight = entries[0].contentRect.height
      if (contentHeight === 0) return
      setPanelHeight(Math.min(contentHeight, window.innerHeight / 2))
    })
    ro.observe(panelContentRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragState.current) return
      const delta = e.clientY - dragState.current.startY
      const next = Math.max(80, Math.min(600, dragState.current.startHeight + delta))
      setPanelHeight(next)
    }
    const onMouseUp = (e) => {
      if (!dragState.current) return
      const delta = e.clientY - dragState.current.startY
      const final = Math.max(80, Math.min(600, dragState.current.startHeight + delta))
      localStorage.setItem('vibeedit-panel-height', String(Math.round(final)))
      dragState.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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
        <div
          className="panel-container"
          style={{ display: activePanel && activePanel !== 'check' ? undefined : 'none', height: panelHeight }}
        >
          <div ref={panelContentRef}>
          {activePanel === 'prompt' && (
            <div className="panel-bar" style={{ height: panelHeight }}>
              <label htmlFor="prompt">Review prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                autoFocus
              />
            </div>
          )}
          {activePanel === 'translate' && (
            <TranslatePanel getEditorHtml={() => editor.getHTML()} />
          )}
          {activePanel === 'conjugate' && <ConjugatePanel state={conjugateState} setState={setConjugateState} />}
          {activePanel === 'dictionary' && <DictionaryPanel state={dictState} setState={setDictState} />}
          <div style={{ display: activePanel === 'speak' ? undefined : 'none' }}>
            <SpeakPanel getEditorText={() => editor.getText()} active={activePanel === 'speak'} />
          </div>
          <div style={{ display: activePanel === 'chat' ? undefined : 'none' }}>
            <ChatPanel getEditorText={() => editor.getText()} history={chatHistory} setHistory={setChatHistory} active={activePanel === 'chat'} />
          </div>
          </div>
        </div>
        {activePanel && activePanel !== 'check' && (
          <div
            className="resize-handle"
            onMouseDown={(e) => {
              dragState.current = { startY: e.clientY, startHeight: panelHeight }
              document.body.style.cursor = 'row-resize'
              document.body.style.userSelect = 'none'
              e.preventDefault()
            }}
          />
        )}
        <div className="editor-area" onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} spellCheck={false} autoCorrect="off" autoCapitalize="off">
          <EditorContent editor={editor} className="editor-content" />
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
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
