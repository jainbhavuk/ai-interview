import styles from "./InterviewReport.module.css";

export function InterviewReport({ report, onStartOver }) {
  return (
    <section className={styles.card} aria-labelledby="report-title">
      <header className={styles.header}>
        <div className={styles.scoreBadge} role="status" aria-live="polite">
          <span>Overall</span>
          <strong>{report?.overallScore !== undefined ? Math.round(report?.overallScore) : 0}/5</strong>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h3>Competency Scores</h3>
          <ul>
            {Array.isArray(report?.competencyScores) &&
            report.competencyScores.length > 0 ? (
              report.competencyScores.map((item, index) => (
                <li key={item?.competency || `competency-${index}`}>
                  <span>{item?.competency || "Unknown"}</span>
                  <strong>{item?.score || 0}/5</strong>
                </li>
              ))
            ) : (
              <li>No competency data available</li>
            )}
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
            {Array.isArray(report?.strengths) && report.strengths.length > 0 ? (
              report.strengths.map((item, index) => (
                <li key={item || `strength-${index}`}>{item || "Strength"}</li>
              ))
            ) : (
              <li>No strengths identified</li>
            )}
          </ul>
        </div>

        <div className={styles.panel}>
          <h3>Improvements</h3>
          <ul>
            {Array.isArray(report?.improvements) &&
            report.improvements.length > 0 ? (
              report.improvements.map((item, index) => (
                <li key={item || `improvement-${index}`}>
                  {item || "Improvement"}
                </li>
              ))
            ) : (
              <li>No improvements needed</li>
            )}
          </ul>
        </div>
      </div>

      <div className={styles.actionContainer}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onStartOver}
        >
          Start New Mock Interview
        </button>
      </div>
    </section>
  );
}
