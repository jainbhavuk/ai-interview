import { BASE_QUESTION_BANK, INTERVIEW_TEMPLATES } from '../constants/interview'
import { parseJobDescription, parseResume } from './textParser'

let questionCounter = 0

function createQuestionId() {
  questionCounter += 1
  return `q_${questionCounter}`
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function findTemplateById(templateId) {
  return INTERVIEW_TEMPLATES.find((template) => template.id === templateId) || INTERVIEW_TEMPLATES[0]
}

function createQuestion(prompt, competency, source, meta = {}) {
  return {
    id: createQuestionId(),
    prompt,
    competency,
    source,
    isFollowUp: false,
    ...meta,
  }
}

function getSharedSkills(resumeSkills, jdSkills) {
  const jdSet = new Set(jdSkills)
  return resumeSkills.filter((skill) => jdSet.has(skill))
}

function getGapSkills(resumeSkills, requiredSkills) {
  const resumeSet = new Set(resumeSkills)
  return requiredSkills.filter((skill) => !resumeSet.has(skill))
}

function createPersonalizedQuestions(profile, jdProfile) {
  const questions = []
  const matchedSkills = getSharedSkills(profile.skills, jdProfile.requiredSkills).slice(0, 2)
  const gapSkills = getGapSkills(profile.skills, jdProfile.requiredSkills).slice(0, 2)

  matchedSkills.forEach((skill) => {
    questions.push(
      createQuestion(
        `Your resume and JD both emphasize ${skill}. Tell me about a real project where you used it and explain one trade-off you handled.`,
        'technical',
        'resume+jd',
        { skillTag: skill },
      ),
    )
  })

  gapSkills.forEach((skill) => {
    questions.push(
      createQuestion(
        `This role requires ${skill}, but it is less visible in your resume. How would you ramp up fast and deliver in your first 30 days?`,
        'adaptability',
        'jd-gap',
        { skillTag: skill },
      ),
    )
  })

  if (profile.projects[0]) {
    questions.push(
      createQuestion(
        `Walk me through this resume claim: "${profile.projects[0]}". What was the problem, solution, and measurable impact?`,
        'communication',
        'resume-project',
      ),
    )
  }

  return questions
}

/**
 * Builds a question plan from template + resume + JD signals.
 * @param {{
 * candidateName: string,
 * templateId: string,
 * durationMinutes: number,
 * resumeText: string,
 * jdText: string
 * }} config
 * @returns {{
 * template: {id: string, label: string},
 * resumeProfile: {skills: string[], yearsExperience: number, projects: string[]},
 * jdProfile: {requiredSkills: string[], niceToHaveSkills: string[], responsibilities: string[]},
 * questions: Array,
 * followUpBudget: number,
 * totalTurnsLimit: number
 * }}
 */
export function buildInterviewPlan(config) {
  const template = findTemplateById(config.templateId)
  const resumeProfile = parseResume(config.resumeText)
  const jdProfile = parseJobDescription(config.jdText)

  const baseQuestions =
    BASE_QUESTION_BANK[template.id]?.map((question) =>
      createQuestion(question.prompt, question.competency, 'template'),
    ) || []

  const personalizedQuestions = createPersonalizedQuestions(resumeProfile, jdProfile)
  const maxMainQuestions = clamp(Math.round((config.durationMinutes || 20) / 3), 4, 9)

  const introQuestion = createQuestion(
    `Hi ${config.candidateName}. Give me a 60-second introduction tailored to this role.`,
    'communication',
    'intro',
  )

  const mergedQuestions = [introQuestion, ...baseQuestions, ...personalizedQuestions]
    .filter((question, index, list) => list.findIndex((item) => item.prompt === question.prompt) === index)
    .slice(0, maxMainQuestions)

  return {
    template,
    resumeProfile,
    jdProfile,
    questions: mergedQuestions,
    followUpBudget: clamp(Math.floor(maxMainQuestions / 2), 2, 5),
    totalTurnsLimit: maxMainQuestions + 4,
  }
}

function includesMetric(answer) {
  return /\b\d+(\.\d+)?%?\b/.test(answer)
}

function includesDepthSignal(answer) {
  return /(because|trade[\s-]?off|challenge|decision|first|second|finally|impact)/i.test(answer)
}

/**
 * Generates a deterministic follow-up question from answer quality signals.
 * @param {{
 * question: {prompt: string, competency: string, skillTag?: string},
 * answer: string,
 * jdProfile: {requiredSkills: string[]}
 * }} params
 * @returns {{id: string, prompt: string, competency: string, source: string, isFollowUp: boolean, parentPrompt: string}|null}
 */
export function generateFollowUpQuestion({ question, answer, jdProfile }) {
  const cleanAnswer = String(answer || '').trim()
  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length

  if (wordCount < 30) {
    return {
      id: createQuestionId(),
      prompt: 'Could you go one level deeper and walk through your exact approach step by step?',
      competency: question.competency,
      source: 'follow-up-depth',
      isFollowUp: true,
      parentPrompt: question.prompt,
    }
  }

  if (!includesMetric(cleanAnswer)) {
    return {
      id: createQuestionId(),
      prompt: 'What measurable outcome did this produce (latency, revenue, quality, speed, or user impact)?',
      competency: 'communication',
      source: 'follow-up-metrics',
      isFollowUp: true,
      parentPrompt: question.prompt,
    }
  }

  if (!includesDepthSignal(cleanAnswer) && question.competency === 'technical') {
    return {
      id: createQuestionId(),
      prompt: 'What alternatives did you evaluate, and why did you reject them?',
      competency: 'technical',
      source: 'follow-up-tradeoff',
      isFollowUp: true,
      parentPrompt: question.prompt,
    }
  }

  if (question.skillTag && jdProfile.requiredSkills.includes(question.skillTag)) {
    return {
      id: createQuestionId(),
      prompt: `If the team scales traffic by 3x, what would you change first in your ${question.skillTag} approach?`,
      competency: 'problem-solving',
      source: 'follow-up-scale',
      isFollowUp: true,
      parentPrompt: question.prompt,
    }
  }

  return null
}
