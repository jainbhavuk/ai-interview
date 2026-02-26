import styles from './InterviewReport.module.css'

export function InterviewReport({ report, onStartOver }) {
  return (
    <section className={styles.card} aria-labelledby="report-title">
      <header className={styles.header}>
        <div>
          <h2 id="report-title">Interview Report</h2>
          <p>
            Candidate: <strong>{report.candidateName}</strong> | Template:{' '}
            <strong>{report.templateLabel}</strong>
          </p>
        </div>
        <div className={styles.scoreBadge} role="status" aria-live="polite">
          <span>Overall</span>
          <strong>{report.overallScore}/5</strong>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3>Competency Scores</h3>
          <ul>
            {report.competencyScores.map((item) => (
              <li key={item.competency}>
                <span>{item.competency}</span>
                <strong>{item.score}/5</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <h3>JD Match</h3>
          <p>
            <strong>Matched skills:</strong>{' '}
            {report.matchedSkills.length ? report.matchedSkills.join(', ') : 'None detected'}
          </p>
          <p>
            <strong>Missing required:</strong>{' '}
            {report.missingRequiredSkills.length
              ? report.missingRequiredSkills.join(', ')
              : 'No critical gaps detected'}
          </p>
        </div>

        <div className={styles.panel}>
          <h3>Strengths</h3>
          <ul>
            {report.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <h3>Improvements</h3>
          <ul>
            {report.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <button type="button" className={styles.primaryButton} onClick={onStartOver}>
        Start New Mock Interview
      </button>
    </section>
  )
}
