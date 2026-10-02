// Conjugation lookup. The scraping lives in the conjugate-api library, which runs
// as a companion container in this app's compose stack (see the README); this
// file only asks it for a verb and lays the answer out for ConjugateResults.jsx.

const BASE = process.env.CONJUGATION_URL || 'http://conjugation:8000'

// Carries the wrapper's HTTP status so the route can answer with the same one.
export class ConjugationError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function fetchVerb(lang, verb) {
  const word = verb.trim()
  let response
  try {
    response = await fetch(`${BASE}/v1/${encodeURIComponent(lang)}/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    throw new ConjugationError(`Conjugation service unavailable: ${err.message}`, 503)
  }
  const body = await response.json().catch(() => ({}))
  if (response.status === 404) throw new ConjugationError(`"${word}" was not found`, 404)
  if (!response.ok) throw new ConjugationError(body.error || `Lookup failed: ${response.status}`, response.status)
  return body
}

// ── Portuguese ────────────────────────────────────────────────────────────────

const PT_PERSONS = ['eu', 'tu', 'ele', 'nos', 'vos', 'eles']
const PT_PRONOUNS = { eu: 'eu', tu: 'tu', ele: 'ele/ela', nos: 'nós', vos: 'vós', eles: 'eles/elas' }
// The imperative addresses its subject: the 3rd-person rows are você/vocês.
const PT_IMPERATIVE = { tu: 'tu', ele: 'você', nos: 'nós', vos: 'vós', eles: 'vocês' }

// Section order and headings are fixed here; the library returns keyed cells and
// leaves presentation to the caller. `before` is a cue word shown ahead of the
// pronoun; `after` puts the pronoun behind the form ("fala tu", "não fales tu").
// `onInfinitive` marks the tenses formed by adding an ending to the infinitive.
function ptLayout(lang) {
  const subjunctive = lang === 'pt-BR' ? 'Subjuntivo' : 'Conjuntivo'
  return [
    { heading: 'Indicativo', tenses: [
      { key: 'present_indicative', name: 'presente' },
      { key: 'preterite', name: 'pretérito perfeito' },
      { key: 'past_imperfect_indicative', name: 'pretérito imperfeito' },
      { key: 'past_pluperfect', name: 'pretérito mais-que-perfeito' },
      { key: 'future_indicative', name: 'futuro', onInfinitive: true },
    ] },
    { heading: subjunctive, tenses: [
      { key: 'present_subjunctive', name: 'presente', before: 'que' },
      { key: 'past_imperfect_subjunctive', name: 'pretérito imperfeito', before: 'se' },
      { key: 'future_subjunctive', name: 'futuro', before: 'quando', onInfinitive: true },
    ] },
    { heading: 'Imperativo', tenses: [
      { key: 'imperative_affirmative', name: 'afirmativo', after: true },
      { key: 'imperative_negative', name: 'negativo', before: 'não', after: true },
    ] },
    { heading: 'Condicional', tenses: [{ key: 'conditional', name: 'condicional', onInfinitive: true }] },
    { heading: 'Infinitivo pessoal', tenses: [{ key: 'personal_infinitive', name: 'infinitivo pessoal', onInfinitive: true }] },
  ]
}

// Split a form for highlighting, the way the old site's markup did: an ending
// added to the whole infinitive ("falar" + "ei") in the tenses built on it, an
// ending on the stem ("fal" + "o"), or a form that shares neither and is shown as
// irregular. pôr and its compounds have no -ar/-er/-ir stem to share.
function splitForm(infinitive, form, onInfinitive) {
  if (form === infinitive) return { stem: form, suffix: '', className: '' }
  if (onInfinitive && form.startsWith(infinitive)) {
    return { stem: infinitive, suffix: form.slice(infinitive.length), className: 'append' }
  }
  const stem = /[aei]r$/.test(infinitive) ? infinitive.slice(0, -2) : ''
  if (stem && form.length > stem.length && form.startsWith(stem)) {
    return { stem, suffix: form.slice(stem.length), className: 'suffix' }
  }
  return { stem: '', suffix: form, className: 'irregular' }
}

function ptCell(infinitive, forms, pronoun, pronounAfter, onInfinitive) {
  // Alternatives (ouço / oiço) are shown together and not highlighted.
  const split = forms.length === 1
    ? splitForm(infinitive, forms[0], onInfinitive)
    : { stem: forms.join(' / '), suffix: '', className: '' }
  return { pronoun, pronounAfter, ...split }
}

function ptSections(lang, data) {
  const cells = new Map(data.cells.map(c => [`${c.tense}|${c.person}`, c.forms]))
  const sections = []

  for (const { heading, tenses } of ptLayout(lang)) {
    const out = []
    for (const { key, name, before = '', after = false, onInfinitive = false } of tenses) {
      const rows = []
      for (const person of PT_PERSONS) {
        const forms = cells.get(`${key}|${person}`)
        if (!forms) continue
        const label = after ? PT_IMPERATIVE[person] : PT_PRONOUNS[person]
        const pronoun = after ? before : [before, label].filter(Boolean).join(' ')
        rows.push([ptCell(data.infinitive, forms, pronoun, after ? label : '', onInfinitive)])
      }
      if (rows.length) out.push({ name, rows })
    }
    if (out.length) sections.push({ heading, tenses: out })
  }

  // Participles have no person. The past participle comes back as two rows —
  // the regular one (with ter/haver) and the short one (with ser/estar) — which
  // only differ for verbs like aceitar (aceitado / aceite).
  const plain = forms => [{ pronoun: '', pronounAfter: '', stem: forms.join(' / '), suffix: '', className: '' }]
  const regular = cells.get('past_participle|inv')
  const short = cells.get('past_participle|short')
  const gerund = cells.get('present_participle|inv')
  const nominal = []
  if (regular) {
    const rows = [plain(regular)]
    if (short && short.join() !== regular.join()) rows.push(plain(short))
    nominal.push({ name: 'particípio passado', rows })
  }
  if (gerund) nominal.push({ name: 'gerúndio', rows: [plain(gerund)] })
  if (nominal.length) sections.push({ heading: 'Formas nominais', tenses: nominal })

  return sections
}

export async function conjugatePt(verb, lang) {
  const sections = ptSections(lang, await fetchVerb(lang, verb))
  if (!sections.length) throw new ConjugationError('No conjugation data found', 404)
  return sections
}

// ── Italian ───────────────────────────────────────────────────────────────────

// Shown from the blocks as the source prints them, not from the keyed cells:
// the cells leave out the compound tenses (see the library's docs/design.txt).
export async function conjugateIt(verb) {
  const data = await fetchVerb('it', verb)
  const moods = new Map()

  for (const block of data.blocks) {
    // Titles read "<Mood> <Tense>", e.g. "Indicativo Passato prossimo".
    const space = block.title.indexOf(' ')
    const mood = space >= 0 ? block.title.substring(0, space) : block.title
    const name = space >= 0 ? block.title.substring(space + 1) : block.title
    const rows = block.rows.map(row => [{
      pronoun: [row.particle, row.pronoun].filter(Boolean).join(' '),
      stem: [row.auxiliary, row.form].filter(Boolean).join(' '),
      suffix: '',
      className: '',
    }])
    if (!moods.has(mood)) moods.set(mood, { heading: mood, tenses: [] })
    moods.get(mood).tenses.push({ name, rows })
  }

  const sections = [...moods.values()]
  if (!sections.length) throw new ConjugationError('No conjugation data found', 404)
  return sections
}
