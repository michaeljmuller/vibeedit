import * as cheerio from 'cheerio'

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
