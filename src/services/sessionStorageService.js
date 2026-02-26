const SESSION_KEY = 'ai_interviewer_session_snapshot'
const REPORT_KEY = 'ai_interviewer_latest_report'

function schedulePersist(task) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => task())
    return
  }

  setTimeout(task, 0)
}

/**
 * Persists in-progress interview state.
 * @param {object} snapshot
 */
export function saveSessionSnapshot(snapshot) {
  schedulePersist(() => localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot)))
}

/**
 * Persists latest generated report.
 * @param {object} report
 */
export function saveLatestReport(report) {
  schedulePersist(() => localStorage.setItem(REPORT_KEY, JSON.stringify(report)))
}

/**
 * Clears in-progress state after completion.
 */
export function clearSessionSnapshot() {
  localStorage.removeItem(SESSION_KEY)
}
