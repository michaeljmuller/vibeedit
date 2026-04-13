import * as cheerio from 'cheerio'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { inflateSync } from 'zlib'

// ── Apple Dictionary ──────────────────────────────────────────────────────────

function findAppleDictPath() {
  // Check project-local copy first
  const local = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'italian-english-dictionary.data')
  if (existsSync(local)) return local

  // Fall back to macOS system location
  const base = '/System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX'
  try {
    for (const dir of readdirSync(base)) {
      const p = join(base, dir, 'AssetData', 'Italian - English.dictionary', 'Contents', 'Resources')
      if (existsSync(join(p, 'Body.data'))) return p
    }
  } catch {}
  return null
}

const APPLE_DICT_PATH = findAppleDictPath()

let _bodyData = null
let _enBlocks = null
let _itBlocks = null

function initAppleDict() {
  if (_enBlocks !== null) return
  if (!APPLE_DICT_PATH) { _enBlocks = []; _itBlocks = []; return }

  _bodyData = readFileSync(APPLE_DICT_PATH)
  const en = [], it = []

  for (let i = 0; i < _bodyData.length - 1; i++) {
    if (_bodyData[i] !== 0x78 || _bodyData[i + 1] !== 0xda) continue
    try {
      const raw = inflateSync(_bodyData.subarray(i)).toString('utf8')
      if (!raw.includes('d:entry')) continue
      const titles = [...raw.matchAll(/d:title="([^"]+)"/g)].map(m => m[1])
      if (!titles.length) continue
      const block = { offset: i, first: titles[0], last: titles.at(-1) }
      raw.includes('-it-en') ? it.push(block) : en.push(block)
    } catch {}
  }

  _enBlocks = en
  _itBlocks = it
}

function dictNormalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9]/g, '')                          // ignore punctuation/spaces
}

function binarySearchBlock(blocks, word) {
  const w = dictNormalize(word)
  let lo = 0, hi = blocks.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (dictNormalize(blocks[mid].first) <= w) lo = mid
    else hi = mid - 1
  }
  return [blocks[lo], blocks[lo + 1]].filter(Boolean)
}

function parseAppleEntry(xml, word) {
  const $ = cheerio.load(xml, { xmlMode: false })
  const sections = []

  const grambs = $('[class~="gramb"][class~="x_xd0"]')
  const targets = grambs.length ? grambs : $('body')

  targets.each((gi, gEl) => {
    const $g = $(gEl)
    const pos = $g.find('[class~="ps"]').first().clone().find('*').remove().end().text().trim()
    const senses = []

    $g.find('[class~="semb"][class~="x_xd1"]').each((i, el) => {
      const $el = $(el)
      const num = $el.children('[class~="sn"]').first().text().trim().replace(/\s/g, '') || String(i + 1)
      const context = $el.find('[class~="ind"]').first().text().replace(/[()]/g, '').trim()
      const trans = $el.find('[class~="trans"]')
        .filter((j, t) => !$(t).closest('[class~="exg"]').length && !$(t).closest('[class~="x_xd3"]').length)
        .map((j, t) => {
          const c = $(t).clone()
          c.find('var, [class~="reg"], [class~="gp"]').remove()
          return c.text().trim()
        }).get().filter(Boolean).join(' / ')
      const examples = []
      $el.find('[class~="exg"]').each((j, ex) => {
        const src = $(ex).find('[class~="ex"]').text().trim()
        const tgt = $(ex).find('[class~="trg"] [class~="trans"]')
          .map((k, t) => $(t).text().trim()).get().filter(Boolean).join(' / ')
        if (src && tgt) examples.push({ src, tgt })
      })
      if (trans) senses.push({ num, context, trans, examples })
    })

    if (senses.length) sections.push({ pos, senses })
  })

  return { word, sections }
}

function lookupInBlocks(blocks, q, depth = 0) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const qNorm = dictNormalize(q)
  for (const block of binarySearchBlock(blocks, q)) {
    const raw = inflateSync(_bodyData.subarray(block.offset)).toString('utf8')
    let m = raw.match(new RegExp(`<[^>]+d:title="${escaped}"[^>]*>.*?</[^:]+:entry>`, 's'))
    if (m) {
      const result = parseAppleEntry(m[0], q)
      if (!result.sections.length && depth === 0) {
        const xrTitle = m[0].match(/class="xr"[^>]*>.*?title="([^"]+)"/)
          ?? m[0].match(/title="([^"]+)"[^>]*>.*?class="xr"/)
          ?? m[0].match(/<a[^>]+title="([^"]+)"/)
        if (xrTitle) return lookupInBlocks(blocks, xrTitle[1], 1)
      }
      return result
    }
    for (const [, title] of raw.matchAll(/d:title="([^"]+)"/g)) {
      if (dictNormalize(title) === qNorm) {
        const te = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        m = raw.match(new RegExp(`<[^>]+d:title="${te}"[^>]*>.*?</[^:]+:entry>`, 's'))
        if (m) {
          const result = parseAppleEntry(m[0], q)
          if (!result.sections.length && depth === 0) {
            const xrTitle = m[0].match(/<a[^>]+title="([^"]+)"/)
            if (xrTitle) return lookupInBlocks(blocks, xrTitle[1], 1)
          }
          return result
        }
      }
    }
  }
  return null
}

export function lookup(word) {
  initAppleDict()
  if (!_enBlocks.length && !_itBlocks.length) throw new Error('Apple Dictionary not available')

  const q = word.trim()
  const results = [lookupInBlocks(_itBlocks, q), lookupInBlocks(_enBlocks, q)].filter(Boolean)
  if (!results.length) throw new Error(`No entry found for "${q}"`)
  return results
}

// ── Reverso conjugation scraper ───────────────────────────────────────────────

function scrapeConjugations($) {
  const moodMap = new Map()

  $('.blue-box-wrap').each(function () {
    const mobileTitle = $(this).attr('mobile-title') || ''
    const spaceIdx = mobileTitle.indexOf(' ')
    const mood = spaceIdx >= 0 ? mobileTitle.substring(0, spaceIdx) : mobileTitle
    if (!mood) return

    const tenseName = $(this).find('p').first().text().trim() || mobileTitle
    const rows = []

    $(this).find('ul.wrap-verbs-listing li').each(function () {
      const particle = $(this).find('i.particletxt').text().trim()
      const pronoun = (particle ? particle + ' ' : '') + $(this).find('i.graytxt').text().trim()
      const aux = $(this).find('i.auxgraytxt').text().trim()
      const verbForm = $(this).find('i.verbtxt').text().trim()
      const form = aux ? aux + ' ' + verbForm : verbForm
      if (form) rows.push([{ pronoun, stem: form, suffix: '', className: '' }])
    })

    if (!rows.length) return

    if (!moodMap.has(mood)) moodMap.set(mood, { heading: mood, tenses: [] })
    moodMap.get(mood).tenses.push({ name: tenseName, rows })
  })

  return [...moodMap.values()]
}

export async function scrape(verb) {
  const url = `https://conjugator.reverso.net/conjugation-italian-verb-${encodeURIComponent(verb.trim())}.html`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
  const html = await response.text()
  const $ = cheerio.load(html)
  const sections = scrapeConjugations($)
  if (!sections.length) throw new Error('No conjugation data found')
  return sections
}
