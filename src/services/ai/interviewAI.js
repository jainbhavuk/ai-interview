import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLLM } from './llmConfig'

let _llm = null
function getLLM() {
  if (!_llm) _llm = createLLM()
  return _llm
}

export async function generateInterviewStructure(config) {
  const system = new SystemMessage(
    `JSON only.`
  )

  const resumeSummary = config.resumeText ? config.resumeText.slice(0, 300) + '...' : 'No resume'
  const jdSummary = config.jdText.slice(0, 500) + '...'

  const questionCount = config.durationMinutes === 10 ? 5 : config.durationMinutes === 20 ? 8 : 10

  const getExperienceLevel = (yoe) => {
    if (yoe === 'Fresher') return 'entry'
    if (yoe === '1 year') return 'junior'
    if (yoe === '2 years') return 'junior'
    if (yoe === '3 years') return 'mid'
    if (yoe === '5 years') return 'senior'
    if (yoe === '10+ years') return 'lead'
    return 'mid'
  }

  const experienceLevel = getExperienceLevel(config.yoe)

  const human = new HumanMessage(
    `${config.domain} ${config.yoe} ${experienceLevel} ${config.durationMinutes}min
${config.candidateName}
Resume: ${resumeSummary}
JD: ${jdSummary}

{"introduction":"Hi ${config.candidateName}, hope you're having a good day! Let's start with you sharing a bit about yourself and your experience, then we'll proceed with some questions.","questions":[{"id":"q1","prompt":"?","competency":"tech","followUps":[{"id":"q1_f1","prompt":"?"},{"id":"q1_f2","prompt":"?"}]}]}

${questionCount} questions. Short.`
  )

  try {
    const response = await getLLM().invoke([system, human])
    const text = (response.content || '').trim()
    const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(clean)
    return parsed
  } catch (error) {
    console.error('Interview generation error:', error)
    throw new Error('Failed to generate interview questions')
  }
}

export async function evaluateAnswer(question, answer, conversationHistory) {
  const system = new SystemMessage(
    `JSON only.`
  )

  const context = conversationHistory.slice(-1).map(t => `Q:${t.question}\nA:${t.answer}`).join('\n')
  
  const human = new HumanMessage(
    `Q:${question}
A:${answer}
C:${context}

{"score":3,"feedback":["ok"],"needsFollowUp":false,"followUpQuestion":""}`
  )

  try {
    const response = await getLLM().invoke([system, human])
    const text = (response.content || '').trim()
    const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.error('Evaluation error:', error)
    return {
      score: 3,
      feedback: ['Unable to evaluate'],
      needsFollowUp: false
    }
  }
}

export async function handleUserResponse(userInput, currentQuestion, conversationHistory, yoe) {
  const system = new SystemMessage(
    `JSON only.`
  )

  const getExperienceGuidance = (yoe) => {
    if (yoe === 'Fresher') return 'patient'
    if (yoe === '1 year') return 'encourage'
    if (yoe === '2 years') return 'balanced'
    if (yoe === '3 years') return 'professional'
    if (yoe === '5 years') return 'direct'
    if (yoe === '10+ years') return 'concise'
    return 'balanced'
  }

  const guidance = getExperienceGuidance(yoe)
  const context = conversationHistory.slice(-1).map(t => `Q:${t.question}\nA:${t.answer}`).join('\n')

  const human = new HumanMessage(
    `Q:${currentQuestion}
U:"${userInput}"
YOE:${yoe}(${guidance})
C:${context}

{"intent":"answer","response":"","shouldProceed":true,"extraTime":0}`
  )

  try {
    const response = await getLLM().invoke([system, human])
    const text = (response.content || '').trim()
    const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.error('User response handling error:', error)
    return {
      intent: 'answer',
      response: '',
      shouldProceed: true,
      extraTime: 0
    }
  }
}

export async function generateFinalReport(transcript, config) {
  const system = new SystemMessage(
    `JSON only.`
  )

  const conversation = transcript.map(t => 
    `Q:${t.prompt}\nA:${t.answer}\nS:${t.evaluation.score}`
  ).join('\n')

  const human = new HumanMessage(
    `${config.candidateName} ${config.domain} ${config.yoe}
${conversation}

{"overallScore":3,"strengths":[],"improvements":[],"competencyScores":{},"recommendation":"consider","summary":"ok"}`
  )

  try {
    const response = await getLLM().invoke([system, human])
    const text = (response.content || '').trim()
    const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.error('Report generation error:', error)
    throw new Error('Failed to generate report')
  }
}

