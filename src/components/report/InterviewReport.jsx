import styles from "./InterviewReport.module.css";

export function InterviewReport({ report, onStartOver }) {
  if (report?.incomplete) {
    const answered = Number(report?.answeredCount || 0);
    const total = Number(report?.total || 0);
    const requiredRatio = Number(report?.requiredRatio || 0.5);
    const requiredCount = Math.max(1, Math.ceil(total * requiredRatio));
    const label = report?.counting === "main" ? "core questions" : "questions";

    return (
      <section className={styles.card} aria-labelledby="report-title">
        <header className={styles.header}>
          <div className={styles.scoreBadge} role="status" aria-live="polite">
            <span>Report</span>
            <strong>Unavailable</strong>
          </div>
        </header>

        <div className={styles.grid}>
          <div className={styles.panel}>
            <h3>Thank you</h3>
            <p>
              Your report can only be generated if you complete at least{" "}
              <strong>50%</strong> of the interview.
            </p>
            <p>
              Progress: <strong>{answered}</strong> / <strong>{total}</strong>{" "}
              {label} answered. (Minimum needed: <strong>{requiredCount}</strong>)
            </p>
          </div>
        </div>

        <div className={styles.actionContainer}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onStartOver}
          >
            Take Interview Again
          </button>
        </div>
      </section>
    );
  }

  const competencyRows = (() => {
    if (Array.isArray(report?.competencyScores)) return report.competencyScores;
    if (report?.competencyScores && typeof report.competencyScores === "object") {
      return Object.entries(report.competencyScores).map(([competency, score]) => ({
        competency,
        score,
      }));
    }
    return [];
  })();

  const hasJdMatchData =
    Array.isArray(report?.matchedSkills) ||
    Array.isArray(report?.missingRequiredSkills);

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
            {competencyRows.length > 0 ? (
              competencyRows.map((item, index) => (
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
          {hasJdMatchData ? (
            <>
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
            </>
          ) : (
            <p>Not available in this report.</p>
          )}
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
