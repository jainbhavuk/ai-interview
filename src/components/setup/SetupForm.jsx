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
  const [resumeFileName, setResumeFileName] = useState("");
  const [isResumeUploading, setIsResumeUploading] = useState(false);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [jdText, setJdText] = useState("");
  const [domain, setDomain] = useState("Frontend");
  const [yoe, setYoe] = useState("1 year");
  const [error, setError] = useState("");

  async function getPermissionState(name) {
    try {
      const status = await navigator?.permissions?.query?.({ name });
      return status?.state || "unknown";
    } catch {
      return "unknown";
    }
  }

  async function handleFileUpload(event, target) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (target === "resume") {
        setIsResumeUploading(true);
        setResumeFileName(file?.name || "");
        // Prevent showing stale "uploaded" UI while a new resume is being parsed.
        setResumeText("");
      }
      const { text } = await readTextFile(file);
      if (target === "resume") {
        setResumeText(text);
      } else if (target === "jd") {
        setJdText(text);
      }
      setError("");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      if (target === "resume") {
        setIsResumeUploading(false);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!candidateName.trim()) {
      setError("Candidate name is required.");
      return;
    }

    if (!resumeText.trim()) {
      setError("Resume is required.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Microphone permissions are required. This browser is not supported.");
      return;
    }

    setError("");
    setIsRequestingPermissions(true);

    try {
      const micState = await getPermissionState("microphone");
      if (micState === "denied") {
        setError(
          "Microphone permission is blocked for this site. Please enable it in your browser site settings (lock icon in the address bar) and reload.",
        );
        return;
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream?.getTracks?.().forEach((t) => t?.stop?.());

      let nextCameraAllowed = false;
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        camStream?.getTracks?.().forEach((t) => t?.stop?.());
        nextCameraAllowed = true;
      } catch {
        nextCameraAllowed = false;
      }

      onStartInterview({
        candidateName: candidateName.trim(),
        durationMinutes: Number(durationMinutes),
        resumeText,
        jdText,
        domain,
        yoe,
        cameraAllowed: nextCameraAllowed,
      });
    } catch {
      const micState = await getPermissionState("microphone");
      if (micState === "denied") {
        setError(
          "Microphone permission is blocked for this site. Please enable it in your browser site settings (lock icon in the address bar) and reload.",
        );
      } else {
        setError("Microphone permission is required to start the interview.");
      }
    } finally {
      setIsRequestingPermissions(false);
    }
  }

  const canStartInterview =
    !!candidateName.trim() &&
    !!resumeText.trim() &&
    !isResumeUploading &&
    !isRequestingPermissions;

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
          />
        </div>

        <div className={styles.row}>
          <label htmlFor="resumeFile">
            Resume <span className={styles.requiredStar}>*</span> (PDF only, max
            1MB)
          </label>
          <div className={styles.fileWrapper}>
            <input
              id="resumeFile"
              type="file"
              accept=".pdf"
              onChange={(event) => handleFileUpload(event, "resume")}
              className={styles.fileInput}
              disabled={isResumeUploading}
            />
            <label htmlFor="resumeFile" className={styles.fileButton}>
              {isResumeUploading ? "Uploading..." : "Choose Resume File"}
            </label>
            <span className={styles.fileName}>
              {isResumeUploading
                ? "Uploading..."
                : resumeText
                  ? "Resume uploaded ✓"
                  : "No file chosen"}
            </span>
          </div>
          {!isResumeUploading && !resumeText && (
            <div className={styles.helperText}>Resume is required to start.</div>
          )}
          {isResumeUploading && (
            <div className={styles.filePreviewUploading} aria-live="polite">
              Uploading resume{resumeFileName ? `: ${resumeFileName}` : ""}...
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={!canStartInterview}
          title={!resumeText.trim() ? "Resume is required to start." : ""}
        >
          {isResumeUploading
            ? "Uploading Resume..."
            : isRequestingPermissions
              ? "Requesting permissions..."
              : "Start Interview"}
        </button>
      </form>
    </section>
  );
}
