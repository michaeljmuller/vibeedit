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

function ConjugateTable({ tense }) {
  return (
    <table className="conj-table">
      {tense.name && <caption>{tense.name}</caption>}
      <tbody>
        {tense.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <ConjugateCell key={j} cell={cell} />)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ConjugateSection({ section, showHeading }) {
  const validTenses = section.tenses.filter(t => t.rows?.length > 0)
  if (validTenses.length === 0) return null
  return (
    <div className="conj-section">
      {showHeading && <h3 className="conj-heading">{section.heading}</h3>}
      <div className="conj-tenses">
        {validTenses.map((tense, i) => <ConjugateTable key={i} tense={tense} />)}
      </div>
    </div>
  )
}

export function Results({ sections }) {
  const visible = sections.filter(s => s.tenses.some(t => t.rows?.length > 0))
  return (
    <div className="conj-output">
      {visible.map((section, i) => (
        <ConjugateSection
          key={i}
          section={section}
          showHeading={i === 0 || visible[i - 1].heading !== section.heading}
        />
      ))}
    </div>
  )
}
