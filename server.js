import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { scrape as scrapePt, lookup as lookupPt } from './languages/pt.js'
import { scrape as scrapeIt, lookup as lookupIt } from './languages/it.js'

const languageScrapers = { 'pt-PT': scrapePt, 'pt-BR': scrapePt, it: scrapeIt }
const languageLookup = { 'pt-PT': lookupPt, 'pt-BR': lookupPt, it: lookupIt }

// Load API keys from .apikey file if not in environment
if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
  try {
    const content = readFileSync('.apikey', 'utf8')
    if (!process.env.ANTHROPIC_API_KEY) {
      const match = content.match(/ANTHROPIC_API_KEY=(.+)/)
      if (match) process.env.ANTHROPIC_API_KEY = match[1].trim()
    }
    if (!process.env.OPENAI_API_KEY) {
      const match = content.match(/OPENAI_API_KEY=(.+)/)
      if (match) process.env.OPENAI_API_KEY = match[1].trim()
    }
  } catch {}
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

// ── Auth ──────────────────────────────────────────────────────────────────────

function getAllowedEmails() {
  try {
    return readFileSync('/config/allowed-emails.txt', 'utf8')
      .split('\n')
      .map(e => e.trim().toLowerCase())
      .filter(e => e && !e.startsWith('#'))
  } catch {
    return []
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}))

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
}, (_at, _rt, profile, done) => {
  const email = profile.emails?.[0]?.value?.toLowerCase()
  const allowed = getAllowedEmails()
  console.log('OAuth profile email:', email, '| allowed:', allowed)
  if (!email) return done(null, false)
  if (!allowed.includes(email)) return done(null, false)
  return done(null, { email })
}))

passport.serializeUser((user, done) => done(null, user.email))
passport.deserializeUser((email, done) => done(null, { email }))

app.use(passport.initialize())
app.use(passport.session())

// Public auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['email'] }))
app.get('/auth/google/callback',
  (req, res, next) => passport.authenticate('google', (err, user) => {
    if (err) { console.error('OAuth error:', err); return res.redirect('/login') }
    if (!user) { console.error('OAuth: no user returned'); return res.redirect('/login') }
    req.logIn(user, loginErr => {
      if (loginErr) { console.error('Login error:', loginErr); return res.redirect('/login') }
      res.redirect('/')
    })
  })(req, res, next)
)
app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login'))
})
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/')
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In – VibeEdit</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a1a; color: #e0e0e0;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .card {
      background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 12px;
      padding: 48px 40px; text-align: center; max-width: 360px; width: 100%;
    }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    p { color: #888; margin-bottom: 32px; font-size: 0.9rem; }
    a {
      display: inline-flex; align-items: center; gap: 10px;
      background: #fff; color: #333; text-decoration: none;
      padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 0.95rem;
    }
    a:hover { background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>VibeEdit</h1>
    <p>Sign in to continue</p>
    <a href="/auth/google">
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign in with Google
    </a>
  </div>
</body>
</html>`)
})

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next()
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' })
  res.redirect('/login')
}

app.use(requireAuth)
app.use(express.static(join(__dirname, 'dist')))

// ── API ───────────────────────────────────────────────────────────────────────

const client = new Anthropic()

async function firstPass(text, prompt) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a text review assistant. Analyze the provided text according to the user's instructions.
Respond ONLY with a valid JSON array. Each element must have:
- "text": an exact substring from the input (must appear verbatim in the text)
- "message": a brief explanation and suggested correction

If no issues are found, return an empty array [].
Return only JSON, no markdown or explanation.`,
    messages: [{
      role: 'user',
      content: `Instructions: ${prompt}\n\nText to review:\n${text}`,
    }],
  })
  const raw = response.content[0].text.replace(/^```[^\n]*\n?|\n?```$/g, '').trim()
  return JSON.parse(raw)
}

async function reviewerPass(text, annotations) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a strict reviewer validating suggested corrections for a piece of text.
You will receive the original text and a list of proposed corrections.
Your job is to filter out any corrections that are:
- Incorrect or not genuine errors
- Not an exact substring of the original text
- Overly pedantic or subjective without clear justification

Return ONLY a valid JSON array containing the corrections you consider valid, in the same format as the input.
Return only JSON, no markdown or explanation.`,
    messages: [{
      role: 'user',
      content: `Original text:\n${text}\n\nProposed corrections:\n${JSON.stringify(annotations, null, 2)}`,
    }],
  })
  const raw = response.content[0].text.replace(/^```[^\n]*\n?|\n?```$/g, '').trim()
  return JSON.parse(raw)
}

app.get('/api/prompts/:lang', (req, res) => {
  const { lang } = req.params
  if (!languageLookup[lang]) return res.status(404).json({ error: `Unknown language: ${lang}` })
  try {
    const text = readFileSync(join(__dirname, 'prompts', `${lang}.txt`), 'utf8')
    res.json({ prompt: text.trim() })
  } catch {
    res.status(404).json({ error: 'No prompt file for this language' })
  }
})

app.post('/api/check', async (req, res) => {
  const { text, prompt, twoPass = true } = req.body
  try {
    let annotations = await firstPass(text, prompt)
    if (twoPass && annotations.length > 0) {
      annotations = await reviewerPass(text, annotations)
    }
    res.json({ annotations })
  } catch (err) {
    console.error('[check] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/translate', async (req, res) => {
  const { text } = req.body
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: 'You are a translator. The user will provide HTML content. Translate all text into English while preserving all HTML tags and structure exactly. Return only the translated HTML, no explanation or commentary.',
      messages: [{ role: 'user', content: text }],
    })
    res.json({ translation: response.content[0].text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/chat', async (req, res) => {
  const { editorText, history, question } = req.body
  try {
    const messages = [
      ...history,
      { role: 'user', content: question },
    ]
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a helpful writing assistant. The user is working on the following document:\n\n---\n${editorText}\n---\n\nAnswer questions about the document or writing in general.`,
      messages,
    })
    res.json({ response: response.content[0].text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/conjugate', async (req, res) => {
  const { verb, lang = 'pt-PT' } = req.body
  if (!verb) return res.status(400).json({ error: 'No verb provided' })
  const scraper = languageScrapers[lang]
  if (!scraper) return res.status(400).json({ error: `Unsupported language: ${lang}` })
  try {
    const sections = await scraper(verb)
    res.json({ sections })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/dictionary', async (req, res) => {
  const { word, lang = 'pt-PT' } = req.body
  if (!word) return res.status(400).json({ error: 'No word provided' })
  const lookup = languageLookup[lang]
  if (!lookup) return res.status(400).json({ error: `Unsupported language: ${lang}` })
  try {
    const results = lookup(word)
    res.json({ results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/speak', async (req, res) => {
  const { text, voice = 'nova' } = req.body
  if (!text) return res.status(400).json({ error: 'No text provided' })
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', input: text, voice }),
    })
    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message ?? 'TTS failed' })
    }
    res.setHeader('Content-Type', 'audio/mpeg')
    const buf = await response.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
