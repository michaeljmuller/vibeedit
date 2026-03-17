import * as cheerio from 'cheerio'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { inflateSync } from 'zlib'

function parseCell($, td) {
  const pronoun = $(td).find('i').text().trim()
  const dataT = $(td).attr('data-t')
  const clone = $(td).clone()
  clone.find('i').remove()
  const form = clone.text().trim()
  if (!form) return null
  let stem = form, suffix = '', className = ''
  if (dataT) {
    if (dataT.charAt(0) === '+') {
      className = dataT.charAt(1) === '0' ? 'irregular' : 'append'
    } else {
      className = 'suffix'
    }
    const stemLen = parseInt(dataT)
    if (!isNaN(stemLen) && form.length > stemLen) {
      stem = form.substring(0, stemLen)
      suffix = form.substring(stemLen)
    }
  }
  return { pronoun, stem, suffix, className }
}

function scrapeConjugations($) {
  const sections = []
  $('main h2').each(function () {
    const heading = $(this).text().trim()
    const tenses = []
    $(this).closest('div').find('table').each(function () {
      const name = $(this).find('caption').text().trim()
      const rows = []
      $(this).find('tr').each(function () {
        const cells = []
        $(this).find('td').each(function () {
          const cell = parseCell($, this)
          if (cell) cells.push(cell)
        })
        if (cells.length) rows.push(cells)
      })
      if (rows.length) tenses.push({ name, rows })
    })
    if (tenses.length) sections.push({ heading, tenses })
  })
  return sections
}

// ── Apple Dictionary ──────────────────────────────────────────────────────────

function findAppleDictPath() {
  // Check project-local copy first
  const local = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'portuguese-english-dictionary.data')
  if (existsSync(local)) return local

  // Fall back to macOS system location
  const base = '/System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX'
  try {
    for (const dir of readdirSync(base)) {
      const p = join(base, dir, 'AssetData', 'Portuguese - English.dictionary', 'Contents', 'Resources')
      if (existsSync(join(p, 'Body.data'))) return p
    }
  } catch {}
  return null
}

const APPLE_DICT_PATH = findAppleDictPath()

let _bodyData = null
let _enBlocks = null
let _ptBlocks = null

function initAppleDict() {
  if (_enBlocks !== null) return
  if (!APPLE_DICT_PATH) { _enBlocks = []; _ptBlocks = []; return }

  _bodyData = readFileSync(APPLE_DICT_PATH)
  const en = [], pt = []

  for (let i = 0; i < _bodyData.length - 1; i++) {
    if (_bodyData[i] !== 0x78 || _bodyData[i + 1] !== 0xda) continue
    try {
      const raw = inflateSync(_bodyData.subarray(i)).toString('utf8')
      if (!raw.includes('d:entry')) continue
      const titles = [...raw.matchAll(/d:title="([^"]+)"/g)].map(m => m[1])
      if (!titles.length) continue
      const idMatch = raw.match(/id="([^"]+)"/)
      const block = { offset: i, first: titles[0], last: titles.at(-1) }
      idMatch?.[1].includes('pt-en') ? pt.push(block) : en.push(block)
    } catch {}
  }

  _enBlocks = en
  _ptBlocks = pt
}

function binarySearchBlock(blocks, word) {
  const w = word.toLowerCase()
  let lo = 0, hi = blocks.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (blocks[mid].first.toLowerCase() <= w) lo = mid
    else hi = mid - 1
  }
  // Return the block and its neighbour in case of boundary
  return [blocks[lo], blocks[lo + 1]].filter(Boolean)
}

function parseAppleEntry(xml, word) {
  const $ = cheerio.load(xml, { xmlMode: false })
  const sections = []

  // Each gramb block is a POS section (noun, verb, etc.)
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

function lookupInBlocks(blocks, q) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const block of binarySearchBlock(blocks, q)) {
    const raw = inflateSync(_bodyData.subarray(block.offset)).toString('utf8')
    const m = raw.match(new RegExp(`<[^>]+d:title="${escaped}"[^>]*>.*?</[^:]+:entry>`, 's'))
    if (m) return parseAppleEntry(m[0], q)
  }
  return null
}

export function lookup(word) {
  initAppleDict()
  if (!_enBlocks.length && !_ptBlocks.length) throw new Error('Apple Dictionary not available')

  const q = word.trim()
  const results = [lookupInBlocks(_ptBlocks, q), lookupInBlocks(_enBlocks, q)].filter(Boolean)
  if (!results.length) throw new Error(`No entry found for "${q}"`)
  return results
}

export async function scrape(verb) {
  const url = `https://pt.conjugateverb.com/pt/${encodeURIComponent(verb.trim())}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
  const html = await response.text()
  const $ = cheerio.load(html)
  const sections = scrapeConjugations($)
  if (!sections.length) throw new Error('No conjugation data found')
  return sections
}
