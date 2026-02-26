import { SKILL_KEYWORDS } from '../constants/interview'

function round(value) {
  return Math.round(value * 10) / 10
}

function average(list) {
  if (!list.length) {
    return 0
  }

  const total = list.reduce((sum, value) => sum + value, 0)
  return round(total / list.length)
}

function findMentionedSkills(text) {
  const normalized = String(text || '').toLowerCase()

  return SKILL_KEYWORDS.filter((skill) => {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return pattern.test(normalized)
  })
}

/**
 * Computes simple rubric signals for one answer.
 * @param {string} answer
 * @param {{competency: string}} question
 * @returns {{score: number, feedback: string[], signals: {wordCount: number}}}
 */
export function evaluateAnswer(answer, question) {
  const cleanAnswer = String(answer || '').trim()
  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length

  const hasMetric = /\b\d+(\.\d+)?%?\b/.test(cleanAnswer)
  const hasContext = /(when|while|during|at|project|team|customer)/i.test(cleanAnswer)
  const hasTradeOff = /(trade[\s-]?off|because|decided|alternative|constraint)/i.test(cleanAnswer)
  const hasAction = /(built|improved|implemented|designed|fixed|led)/i.test(cleanAnswer)

  let score = 1
  if (wordCount >= 25) score += 1
  if (hasContext) score += 1
  if (hasAction) score += 1
  if (hasMetric || hasTradeOff) score += 1

  const feedback = []
  if (wordCount < 25) feedback.push('Add more depth and structure in your explanation.')
  if (!hasMetric) feedback.push('Include at least one measurable outcome.')
  if (!hasTradeOff && question.competency === 'technical') {
    feedback.push('Mention trade-offs or why you chose one approach over another.')
  }

  return {
    score: Math.min(score, 5),
    feedback,
    signals: { wordCount },
  }
}

/**
 * Builds a final report from transcript and extracted profiles.
 * @param {{
 * candidateName: string,
 * templateLabel: string,
 * durationMinutes: number,
 * transcript: Array,
 * jdProfile: {requiredSkills: string[]},
 * resumeProfile: {skills: string[]}
 * }} params
 * @returns {{
 * candidateName: string,
 * templateLabel: string,
 * overallScore: number,
 * totalAnswers: number,
 * competencyScores: Array<{competency: string, score: number}>,
 * strengths: string[],
 * improvements: string[],
 * matchedSkills: string[],
 * missingRequiredSkills: string[]
 * }}
 */
export function buildInterviewReport({
  candidateName,
  templateLabel,
  durationMinutes,
  transcript,
  jdProfile,
  resumeProfile,
}) {
  const answered = transcript.filter((entry) => !entry.skipped)
  const scores = answered.map((entry) => entry.evaluation.score)
  const overallScore = average(scores)

  const competencyMap = new Map()
  answered.forEach((entry) => {
    const key = entry.competency || 'general'
    const list = competencyMap.get(key) || []
    list.push(entry.evaluation.score)
    competencyMap.set(key, list)
  })

  const competencyScores = [...competencyMap.entries()].map(([competency, values]) => ({
    competency,
    score: average(values),
  }))

  const coveredSkills = new Set()
  answered.forEach((entry) => {
    findMentionedSkills(`${entry.prompt} ${entry.answer}`).forEach((skill) => coveredSkills.add(skill))
  })

  const matchedSkills = jdProfile.requiredSkills.filter((skill) => coveredSkills.has(skill))
  const missingRequiredSkills = jdProfile.requiredSkills.filter((skill) => !coveredSkills.has(skill))

  const strengths = answered
    .slice()
    .sort((a, b) => b.evaluation.score - a.evaluation.score)
    .slice(0, 3)
    .map((entry) => `Strong ${entry.competency || 'general'} response: "${entry.prompt}"`)

  const lowSignalEntries = answered
    .filter((entry) => entry.evaluation.score <= 3)
    .slice(0, 2)
    .map((entry) => `Improve depth for: "${entry.prompt}"`)

  const improvements = [
    ...lowSignalEntries,
    ...missingRequiredSkills.slice(0, 3).map((skill) => `Practice role-specific examples for "${skill}".`),
  ]

  return {
    candidateName,
    templateLabel,
    durationMinutes,
    overallScore,
    totalAnswers: answered.length,
    competencyScores,
    strengths: strengths.length ? strengths : ['Your answers were consistent; focus on adding stronger metrics.'],
    improvements: improvements.length
      ? improvements
      : ['Increase specificity with metrics and concrete decision trade-offs.'],
    matchedSkills,
    missingRequiredSkills,
    resumeSkills: resumeProfile.skills,
  }
}
