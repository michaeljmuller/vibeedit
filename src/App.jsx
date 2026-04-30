import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FooHighlight } from './FooHighlight'
import ChatPanel from './ChatPanel'
import ConjugatePanel from './ConjugatePanel'
import DictionaryPanel from './DictionaryPanel'
import SettingsPage from './SettingsPage'

const LANGUAGES = [
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'it',    label: 'Italian' },
]

const IS_MAC = /macintosh|mac os x/i.test(navigator.userAgent)

const PANELS = [
  { id: 'check',      label: 'Check' },
  { id: 'chat',       label: 'Chat' },
  { id: 'translate',  label: 'Translate' },
  { id: 'conjugate',  label: 'Conjugate' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'speak',      label: 'Speak' },
]

const PANEL_TITLES = {
  chat:       'Chat',
  translate:  'Translation',
  conjugate:  'Conjugate',
  dictionary: 'Dictionary',
  speak:      'Text to Speech',
}

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
      <span className="divider" />
      {PANELS.slice(1).map((p, i) => (
        <button
          key={p.id}
          onClick={() => onPanelToggle(p.id)}
          className={[
            activePanel === p.id ? 'panel-active' : '',
            ctrlHeld ? 'hotkey-hint' : '',
          ].filter(Boolean).join(' ')}
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
      <div className="speak-controls-row">
        <select className="voice-picker" value={voice} onChange={handleVoiceChange} disabled={loading}>
          {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button className="regen-btn" onClick={generate} disabled={loading}>↺ Re-generate</button>
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

function TranslatePanel({ getEditorHtml, active }) {
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

  useEffect(() => {
    if (active) run()
  }, [active])

  return (
    <div className="panel-bar translate-panel">
      <div className="translate-controls">
        <button className="retranslate-btn" onClick={() => run(true)} disabled={loading}>↺ Re-translate</button>
      </div>
      {loading && <p className="translate-status">Translating…</p>}
      {error && <p className="translate-status error">{error}</p>}
      {translation && <div className="translate-output tiptap" dangerouslySetInnerHTML={{ __html: translation }} />}
    </div>
  )
}

// Migrate old bare 'pt' localStorage keys to 'pt-PT'
;(() => {
  if (localStorage.getItem('vibeedit-lang') === 'pt') {
    localStorage.setItem('vibeedit-lang', 'pt-PT')
    const old = localStorage.getItem('vibeedit-prompt')
    if (old !== null) {
      if (localStorage.getItem('vibeedit-prompt-pt-PT') === null) {
        localStorage.setItem('vibeedit-prompt-pt-PT', old)
      }
      localStorage.removeItem('vibeedit-prompt')
    }
  }
})()

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('vibeedit-lang') ?? 'pt-PT')
  const [prompt, setPrompt] = useState(() => localStorage.getItem(`vibeedit-prompt-${localStorage.getItem('vibeedit-lang') ?? 'pt-PT'}`) ?? '')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [activePanel, setActivePanel] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [conjugateState, setConjugateState] = useState({ verb: '', sections: null, error: null })
  const [dictState, setDictState] = useState({ word: '', results: null, error: null, loading: false })
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('vibeedit-panel-height')) || 220)
  const [annotations, setAnnotations] = useState([])
  const [user, setUser] = useState(null)
  const [view, setView] = useState('editor')
  const hideTimer = useRef(null)
  const saveTimer = useRef(null)
  const dragState = useRef(null)
  const panelContentRef = useRef(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setUser(d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!panelContentRef.current) return
    const ro = new ResizeObserver(entries => {
      if (dragState.current) return
      const contentHeight = entries[0].contentRect.height
      if (contentHeight === 0) return
      setPanelHeight(Math.min(contentHeight, window.innerHeight * 0.45))
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
      setTooltip(null)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        localStorage.setItem('vibeedit-content', editor.getHTML())
      }, 500)
    },
  })

  const dismissAnnotation = useCallback((message) => {
    setAnnotations(prev => {
      const next = prev.filter(a => a.message !== message)
      editor?.commands.setAnnotations(next)
      return next
    })
    setTooltip(null)
  }, [editor])

  const handlePanelToggle = (panel) => {
    setActivePanel(prev => {
      const next = prev === panel ? null : panel
      if (next === null) editor?.commands.focus()
      return next
    })
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && activePanel && activePanel !== 'check') {
        setActivePanel(null)
        editor?.commands.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activePanel, editor])

  useEffect(() => {
    const saved = localStorage.getItem(`vibeedit-prompt-${lang}`)
    if (saved !== null) {
      setPrompt(saved)
      return
    }
    fetch(`/api/prompts/${lang}`)
      .then(r => r.json())
      .then(d => {
        if (d.prompt) {
          setPrompt(d.prompt)
          localStorage.setItem(`vibeedit-prompt-${lang}`, d.prompt)
        }
      })
      .catch(() => {})
  }, [lang])

  const handleLangChange = (code) => {
    setLang(code)
    localStorage.setItem('vibeedit-lang', code)
  }

  const handlePromptChange = (e) => {
    setPrompt(e.target.value)
    localStorage.setItem(`vibeedit-prompt-${lang}`, e.target.value)
  }

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setError(null)
    setAnnotations([])
    editor.commands.setAnnotations([])

    const text = editor.getText()
    const langLabel = LANGUAGES.find(l => l.code === lang)?.label ?? lang
    const expandedPrompt = prompt.replace(/\{\{language\}\}/g, langLabel)
    if (!expandedPrompt.trim()) {
      setError('No chat prompt configured. Open Settings to set one.')
      setChecking(false)
      return
    }
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, prompt: expandedPrompt }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnnotations(data.annotations)
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
    const flipped = rect.bottom > window.innerHeight * 0.6
    setTooltip({
      x: rect.left + window.scrollX,
      y: flipped
        ? rect.top + window.scrollY
        : rect.bottom + window.scrollY + 6,
      flipped,
      message: el.getAttribute('data-message'),
    })
  }

  const handleMouseOut = (e) => {
    if (!e.target.closest('.foo-highlight')) return
    hideTimer.current = setTimeout(() => setTooltip(null), 100)
  }

  const panelVisible = activePanel && activePanel !== 'check'
  const expandedPrompt = prompt.replace(/\{\{language\}\}/g, LANGUAGES.find(l => l.code === lang)?.label ?? lang)

  return (
    <div className="container">
      <div className="title-bar">
        <h1>VibeEdit</h1>
        {view === 'editor' && (
          <span className="lang-display">{LANGUAGES.find(l => l.code === lang)?.label}</span>
        )}
        <div className="title-bar-right">
          {user && (
            <div className="user-badge">
              <span className="user-email">{user.email}</span>
              <button
                className={`settings-gear-btn${view === 'settings' ? ' settings-gear-btn--active' : ''}`}
                onClick={() => setView(v => v === 'settings' ? 'editor' : 'settings')}
                title="Settings"
              >
                ⚙
              </button>
              <a href="/auth/logout" className="logout-link">Sign out</a>
            </div>
          )}
        </div>
      </div>
      {view === 'settings' ? (
        <SettingsPage
          lang={lang}
          languages={LANGUAGES}
          onLangChange={handleLangChange}
          prompt={prompt}
          onPromptChange={handlePromptChange}
          onBack={() => setView('editor')}
        />
      ) : (
        <div className="editor-wrapper">
          <MenuBar
            editor={editor}
            onCheck={handleCheck}
            checking={checking}
            activePanel={activePanel}
            onPanelToggle={handlePanelToggle}
            ctrlHeld={ctrlHeld}
          />
          {panelVisible && (
            <div className="panel-header">
              <div className="panel-header-left">
                <span className="panel-title">{PANEL_TITLES[activePanel]}</span>
              </div>
              <div className="panel-header-right">
                {activePanel === 'chat' && chatHistory.length > 0 && (
                  <button className="panel-secondary-btn" onClick={() => setChatHistory([])}>Clear chat</button>
                )}
                <button
                  className="panel-close-btn"
                  onClick={() => handlePanelToggle(activePanel)}
                  title="Close panel"
                >×</button>
              </div>
            </div>
          )}
          <div
            className="panel-container"
            style={{ display: panelVisible ? undefined : 'none', height: panelHeight }}
          >
            <div ref={panelContentRef}>
              <div style={{ display: activePanel === 'translate' ? undefined : 'none' }}>
                <TranslatePanel getEditorHtml={() => editor?.getHTML()} active={activePanel === 'translate'} />
              </div>
              {activePanel === 'conjugate' && <ConjugatePanel state={conjugateState} setState={setConjugateState} lang={lang} />}
              {activePanel === 'dictionary' && <DictionaryPanel state={dictState} setState={setDictState} lang={lang} />}
              <div style={{ display: activePanel === 'speak' ? undefined : 'none' }}>
                <SpeakPanel getEditorText={() => editor?.getText()} active={activePanel === 'speak'} />
              </div>
              <div style={{ display: activePanel === 'chat' ? undefined : 'none' }}>
                <ChatPanel getEditorText={() => editor?.getText()} history={chatHistory} setHistory={setChatHistory} active={activePanel === 'chat'} prompt={expandedPrompt} />
              </div>
            </div>
          </div>
          {panelVisible && (
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
      )}
      {error && <div className="error-banner">{error}</div>}
      {tooltip && (
        <div
          className={`error-tooltip${tooltip.flipped ? ' error-tooltip--flipped' : ''}`}
          style={{ left: tooltip.x, top: tooltip.y }}
          onMouseOver={() => clearTimeout(hideTimer.current)}
          onMouseOut={() => { hideTimer.current = setTimeout(() => setTooltip(null), 100) }}
        >
          <span className="tooltip-message">{tooltip.message}</span>
          <button
            className="tooltip-dismiss"
            onClick={(e) => { e.stopPropagation(); dismissAnnotation(tooltip.message) }}
            title="Dismiss this suggestion"
          >×</button>
        </div>
      )}
    </div>
  )
}
