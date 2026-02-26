import { useState } from "react";
import { InterviewSession } from "../components/interview/InterviewSession";
import { InterviewReport } from "../components/report/InterviewReport";
import { SetupForm } from "../components/setup/SetupForm";
import styles from "./App.module.css";

export default function App() {
  const [stage, setStage] = useState("setup");
  const [setupConfig, setSetupConfig] = useState(null);
  const [report, setReport] = useState(null);

  function handleStartInterview(config) {
    setSetupConfig(config);
    setReport(null);
    setStage("interview");
  }

  function handleInterviewComplete(nextReport) {
    setReport(nextReport);
    setStage("report");
  }

  function handleStartOver() {
    setSetupConfig(null);
    setReport(null);
    setStage("setup");
  }

  if (stage === "setup") {
    return (
      <div className={styles.fullScreen}>
        <div className={styles.heroSection}>
          <h1 className={styles.heroTitle}>Knoq</h1>
          <p className={styles.heroSubtitle}>
            Advanced Interview Intelligence System
          </p>
          <SetupForm onStartInterview={handleStartInterview} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.shell} ${stage === "interview" ? styles.shellInterview : ""}`}
    >
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      <header
        className={`${styles.header} ${stage === "interview" ? styles.headerInterview : ""}`}
      >
        {stage !== "interview" && (
          <div>
            <h1>Knoq</h1>
            <p>Tailored mock interviews for better prep!</p>
          </div>
        )}
        {stage === "interview" && (
          <h1 className={styles.interviewTitle}>Knoq Interview Session</h1>
        )}
        {stage !== "setup" && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleStartOver}
          >
            Start New Session
          </button>
        )}
      </header>

      <main
        id="main-content"
        className={`${styles.main} ${stage === "interview" ? styles.mainInterview : ""}`}
        tabIndex="-1"
      >
        {stage === "interview" && setupConfig && (
          <InterviewSession
            config={setupConfig}
            onComplete={handleInterviewComplete}
            onAbort={handleStartOver}
          />
        )}

        {stage === "report" && report && (
          <InterviewReport report={report} onStartOver={handleStartOver} />
        )}
      </main>
    </div>
  );
}
