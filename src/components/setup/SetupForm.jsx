import { useState } from "react";
import { readTextFile } from "../../services/fileService";
import styles from "./SetupForm.module.css";

const DOMAINS = ["Frontend", "Backend", "Fullstack", "DevOps", "QA", "SRE"];
const YOE_OPTIONS = [
  "Fresher",
  "1 year",
  "2 years",
  "3 years",
  "5 years",
  "10+ years",
];

export function SetupForm({ onStartInterview }) {
  const [candidateName, setCandidateName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [domain, setDomain] = useState("Frontend");
  const [yoe, setYoe] = useState("1 year");
  const [error, setError] = useState("");

  async function handleFileUpload(event, target) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { text } = await readTextFile(file);
      if (target === "resume") {
        setResumeText(text);
      } else if (target === "jd") {
        setJdText(text);
      }
      setError("");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!candidateName.trim()) {
      setError("Candidate name is required.");
      return;
    }

    if (!resumeText.trim() && !jdText.trim()) {
      setError("Please provide either a resume or a job description.");
      return;
    }

    setError("");
    onStartInterview({
      candidateName: candidateName.trim(),
      durationMinutes: Number(durationMinutes),
      resumeText,
      jdText,
      domain,
      yoe,
    });
  }

  return (
    <section className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <label htmlFor="candidateName">Name</label>
          <input
            id="candidateName"
            value={candidateName}
            onChange={(event) => setCandidateName(event.target.value)}
            placeholder="Enter your name"
            autoComplete="name"
            required
          />
        </div>

        <div className={styles.rowGroup}>
          <div className={styles.row}>
            <label htmlFor="domain">Domain/Role</label>
            <select
              id="domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label htmlFor="yoe">Years of Experience</label>
            <select
              id="yoe"
              value={yoe}
              onChange={(event) => setYoe(event.target.value)}
            >
              {YOE_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <label htmlFor="duration">Preferred Interview Duration</label>
          <select
            id="duration"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          >
            <option value={10}>10 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
          </select>
        </div>

        <div className={styles.row}>
          <label htmlFor="jdText">Job Description</label>
          <textarea
            id="jdText"
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            placeholder="Paste the job description here..."
            rows={4}
            required={!resumeText.trim()}
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="resumeFile">Resume (PDF only, max 1MB)</label>
          <div className={styles.fileWrapper}>
            <input
              id="resumeFile"
              type="file"
              accept=".pdf"
              onChange={(event) => handleFileUpload(event, "resume")}
              className={styles.fileInput}
            />
            <label htmlFor="resumeFile" className={styles.fileButton}>
              Choose Resume File
            </label>
            <span className={styles.fileName}>
              {resumeText ? "File uploaded ✓" : "No file chosen"}
            </span>
          </div>
          {resumeText && (
            <div className={styles.filePreview}>
              Resume uploaded ✓ ({resumeText.length} characters)
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.primaryButton}>
          Start Interview
        </button>
      </form>
    </section>
  );
}
