import { useState, useEffect, useRef } from 'react'
import { generateInterviewStructure, evaluateAnswer, generateFinalReport } from '../services/ai/interviewAI'

export function useInterviewEngine(config) {
  const [interviewStructure, setInterviewStructure] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [transcript, setTranscript] = useState([])
  const [isGenerating, setIsGenerating] = useState(true)
  const [report, setReport] = useState(null)
  
  const allQuestions = useRef([])
  const stateRef = useRef({ transcript, currentQuestionIndex })

  useEffect(() => {
    stateRef.current = { transcript, currentQuestionIndex }
  }, [transcript, currentQuestionIndex])

  useEffect(() => {
    async function generateStructure() {
      try {
        setIsGenerating(true)
        const structure = await generateInterviewStructure(config)
        setInterviewStructure(structure)
        
        const flatQuestions = []
        structure.questions.forEach(q => {
          flatQuestions.push({
            id: q.id,
            prompt: q.prompt,
            competency: q.competency,
            type: 'main'
          })
          q.followUps.forEach(fu => {
            flatQuestions.push({
              id: fu.id,
              prompt: fu.prompt,
              competency: q.competency,
              type: 'followup',
              parentQuestion: q.prompt
            })
          })
        })
        
        allQuestions.current = flatQuestions
      } catch (error) {
        console.error('Failed to generate interview:', error)
        // Fallback questions
        allQuestions.current = [
          {
            id: 'fallback1',
            prompt: `Tell me about your experience with ${config.domain} development.`,
            competency: 'experience',
            type: 'main'
          },
          {
            id: 'fallback2',
            prompt: 'What projects are you most proud of?',
            competency: 'projects',
            type: 'main'
          }
        ]
        setInterviewStructure({
          introduction: `Hi ${config.candidateName}, hope you're having a good day! Let's start with you sharing a bit about yourself and your experience, then we'll proceed with some questions.`,
          questions: allQuestions.current
        })
      } finally {
        setIsGenerating(false)
      }
    }
    
    generateStructure()
  }, [config])

  const currentQuestion = allQuestions.current[currentQuestionIndex] || null
  const isComplete = Boolean(report)

  async function submitAnswer(answer, inputMode = 'voice') {
    if (!currentQuestion || isComplete) return { ok: false, message: 'No active question' }

    const cleanAnswer = String(answer || '').trim()
    if (!cleanAnswer) return { ok: false, message: 'Answer cannot be empty' }

    try {
      const evaluation = await evaluateAnswer(
        currentQuestion.prompt,
        cleanAnswer,
        stateRef.current.transcript
      )

      const answerEntry = {
        id: `${currentQuestion.id}_answer`,
        questionId: currentQuestion.id,
        prompt: currentQuestion.prompt,
        answer: cleanAnswer,
        competency: currentQuestion.competency,
        type: currentQuestion.type,
        inputMode,
        evaluation,
        answeredAt: new Date().toISOString()
      }

      const newTranscript = [...stateRef.current.transcript, answerEntry]
      setTranscript(newTranscript)

      if (evaluation.needsFollowUp && evaluation.followUpQuestion) {
        const followUpEntry = {
          id: `fu_${Date.now()}`,
          prompt: evaluation.followUpQuestion,
          competency: currentQuestion.competency,
          type: 'dynamic_followup',
          parentQuestion: currentQuestion.prompt
        }
        
        allQuestions.current.splice(currentQuestionIndex + 1, 0, followUpEntry)
      }

      const nextIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIndex)

      if (nextIndex >= allQuestions.current.length) {
        await generateReport(newTranscript)
        return { ok: true, evaluation, isComplete: true }
      }

      return { ok: true, evaluation, isComplete: false }
    } catch (error) {
      console.error('Answer submission error:', error)
      return { ok: false, message: 'Failed to process answer' }
    }
  }

  async function generateReport(conversation) {
    try {
      const finalReport = await generateFinalReport(conversation, config)
      setReport(finalReport)
      return finalReport
    } catch (error) {
      console.error('Report generation error:', error)
      const fallbackReport = {
        overallScore: 3,
        strengths: ['Completed interview'],
        improvements: ['Continue practicing'],
        competencyScores: {},
        recommendation: 'consider',
        summary: 'Interview completed successfully'
      }
      setReport(fallbackReport)
      return fallbackReport
    }
  }

  function skipQuestion() {
    if (!currentQuestion) return

    const skipEntry = {
      id: `${currentQuestion.id}_skipped`,
      questionId: currentQuestion.id,
      prompt: currentQuestion.prompt,
      answer: '',
      competency: currentQuestion.competency,
      type: currentQuestion.type,
      skipped: true,
      evaluation: { score: 1, feedback: ['Question skipped'] },
      answeredAt: new Date().toISOString()
    }

    const newTranscript = [...stateRef.current.transcript, skipEntry]
    setTranscript(newTranscript)

    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)

    if (nextIndex >= allQuestions.current.length) {
      generateReport(newTranscript)
    }
  }

  function endInterviewNow() {
    generateReport(stateRef.current.transcript)
  }

  return {
    introduction: interviewStructure?.introduction || '',
    templateLabel: `${config.domain} Engineer`,
    progress: {
      current: Math.min(currentQuestionIndex + 1, allQuestions.current.length),
      total: allQuestions.current.length
    },
    currentQuestion,
    transcript,
    isComplete,
    isGenerating,
    report,
    submitAnswer,
    skipQuestion,
    endInterviewNow
  }
}
