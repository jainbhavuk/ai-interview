import styles from "./InterviewReport.module.css";

export function InterviewReport({ report, onStartOver }) {
  return (
    <section className={styles.card} aria-labelledby="report-title">
      <header className={styles.header}>
        <div>
          <h2 id="report-title">Interview Report</h2>
          <p>
            Candidate: <strong>{report?.candidateName || 'Unknown'}</strong> | Template:{" "}
            <strong>{report?.templateLabel ?? 'Interview'}</strong>
          </p>
        </div>
        <div className={styles.scoreBadge} role="status" aria-live="polite">
          <span>Overall</span>
          <strong>{report?.overallScore !== undefined ? Math.round(report?.overallScore) : 0}/5</strong>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3>Competency Scores</h3>
          <ul>
            {report?.competencyScores?.map?.((item, index) => (
              <li key={item?.competency || `competency-${index}`}>
                <span>{item?.competency || 'Unknown'}</span>
                <strong>{item?.score || 0}/5</strong>
              </li>
            )) || <li>No competency data available</li>}
          </ul>
        </div>

        <div className={styles.panel}>
          <h3>JD Match</h3>
          <p>
            <strong>Matched skills:</strong>{" "}
            {report?.matchedSkills?.length
              ? report.matchedSkills.join(", ")
              : "None detected"}
          </p>
          <p>
            <strong>Missing required:</strong>{" "}
            {report?.missingRequiredSkills?.length
              ? report.missingRequiredSkills.join(", ")
              : "No critical gaps detected"}
          </p>
        </div>

        <div className={styles.panel}>
          <h3>Strengths</h3>
          <ul>
            {report?.strengths?.map?.((item, index) => (
              <li key={item || `strength-${index}`}>{item || 'Strength'}</li>
            )) || <li>No strengths identified</li>}
          </ul>
        </div>

        <div className={styles.panel}>
          <h3>Improvements</h3>
          <ul>
            {report?.improvements?.map?.((item, index) => (
              <li key={item || `improvement-${index}`}>{item || 'Improvement'}</li>
            )) || <li>No improvements needed</li>}
          </ul>
        </div>
      </div>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={onStartOver}
      >
        Start New Mock Interview
      </button>
    </section>
  );
}
