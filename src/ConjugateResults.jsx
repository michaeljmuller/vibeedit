import { useState } from 'react'

function ConjugateCell({ cell }) {
  const { pronoun, stem, suffix, className } = cell
  const formEl = suffix
    ? <span>{stem}<span className={`conj-${className}`}>{suffix}</span></span>
    : <span>{stem}</span>
  return (
    <td className="conj-cell">
      {pronoun && <span className="conj-pronoun">{pronoun} </span>}
      {formEl}
    </td>
  )
}

function ConjugateSection({ section }) {
  const validTenses = section.tenses.filter(t => t.rows?.length > 0)
  if (validTenses.length === 0) return null
  const colCount = validTenses[0]?.rows[0]?.length ?? 1
  return (
    <table className="conj-table">
      <tbody>
        {validTenses.flatMap((tense, ti) => [
          tense.name ? (
            <tr key={`h-${ti}`}>
              <td colSpan={colCount} className={`conj-tense-name${ti > 0 ? ' conj-tense-gap' : ''}`}>{tense.name}</td>
            </tr>
          ) : null,
          ...tense.rows.map((row, ri) => (
            <tr key={`${ti}-${ri}`}>
              {row.map((cell, ci) => <ConjugateCell key={ci} cell={cell} />)}
            </tr>
          )),
        ].filter(Boolean))}
      </tbody>
    </table>
  )
}

function ConjugateGroup({ heading, sections }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="conj-group">
      <h3 className="conj-heading" onClick={() => setCollapsed(c => !c)}>
        <span className={`conj-heading-arrow${collapsed ? ' collapsed' : ''}`}>▾</span>
        {heading}
      </h3>
      {!collapsed && (
        <div className="conj-section">
          {sections.map((section, i) => (
            <ConjugateSection key={i} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Results({ sections }) {
  const visible = sections.filter(s => s.tenses.some(t => t.rows?.length > 0))

  const groups = []
  for (const section of visible) {
    const last = groups[groups.length - 1]
    if (!last || last.heading !== section.heading) {
      groups.push({ heading: section.heading, sections: [section] })
    } else {
      last.sections.push(section)
    }
  }

  return (
    <div className="conj-output">
      {groups.map((group, i) => (
        <ConjugateGroup key={i} heading={group.heading} sections={group.sections} />
      ))}
    </div>
  )
}
