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

function ConjugateSection({ section }) {
  return (
    <div className="conj-section">
      <h3 className="conj-heading">{section.heading}</h3>
      <div className="conj-tenses">
        {section.tenses.map((tense, i) => <ConjugateTable key={i} tense={tense} />)}
      </div>
    </div>
  )
}

export function Results({ sections }) {
  return (
    <div className="conj-output">
      {sections.map((section, i) => <ConjugateSection key={i} section={section} />)}
    </div>
  )
}
