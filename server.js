import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { scrape as scrapePt, lookup as lookupPt } from './languages/pt.js'

const languageScrapers = { pt: scrapePt }
const languageLookup = { pt: lookupPt }

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
app.use(express.static(join(__dirname, 'dist')))

const client = new Anthropic()

async function firstPass(text, prompt) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
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
    max_tokens: 1024,
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

app.post('/api/check', async (req, res) => {
  const { text, prompt, twoPass = true } = req.body
  try {
    let annotations = await firstPass(text, prompt)
    if (twoPass && annotations.length > 0) {
      annotations = await reviewerPass(text, annotations)
    }
    res.json({ annotations })
  } catch (err) {
    console.error(err)
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
  const { verb, lang = 'pt' } = req.body
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
  const { word, dir = 'ptToEn', lang = 'pt' } = req.body
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
