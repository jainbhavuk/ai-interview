import { useEffect, useRef, useState } from 'react'
import { useInterviewEngine } from '../../hooks/useInterviewEngine'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { handleUserResponse } from '../../services/ai/interviewAI'
import styles from './InterviewSession.module.css'

export function InterviewSession({ config, onComplete, onAbort }) {
  const [hasStarted, setHasStarted] = useState(false)
  const [phase, setPhase] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Preparing personalized interview...')
  const [systemError, setSystemError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiSubtitle, setAiSubtitle] = useState('')

  const turnTimerRef = useRef(null)
  const responseTimeoutRef = useRef(null)
  const interviewRef = useRef(null)
  const stopListeningRef = useRef(() => {})
  const cancelVoiceRef = useRef(() => {})

  const interview = useInterviewEngine(config)
  const speech = useSpeechRecognition()
  const voice = useSpeechSynthesis()

  const visibleError = systemError || speech.error || voice.error
  const candidateInitials = config.candidateName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  useEffect(() => {
    if (interview.report) {
      onComplete(interview.report)
    }
  }, [interview.report, onComplete])

  useEffect(() => {
    interviewRef.current = interview
    stopListeningRef.current = speech.stopListening
    cancelVoiceRef.current = voice.cancel
  }, [interview, speech.stopListening, voice.cancel])

  useEffect(() => {
    if (!interview.isGenerating && !interview.currentQuestion) {
      setStatusMessage('Interview preparation failed. Please try again.')
    } else if (!interview.isGenerating) {
      setStatusMessage('Ready to start your personalized interview.')
    }
  }, [interview.isGenerating, interview.currentQuestion])

  function clearTurnTimer() {
    if (turnTimerRef.current) {
      window.clearTimeout(turnTimerRef.current)
      turnTimerRef.current = null
    }
  }

  function clearResponseTimer() {
    if (responseTimeoutRef.current) {
      window.clearTimeout(responseTimeoutRef.current)
      responseTimeoutRef.current = null
    }
  }

  function startResponseTimer() {
    clearResponseTimer()
    responseTimeoutRef.current = window.setTimeout(() => {
      handleResponseTimeout()
    }, 10000) // 10 seconds
  }

  async function handleResponseTimeout() {
    if (!hasStarted || isProcessing) return
    
    setStatusMessage('Taking longer than expected? Need more time?')
    setPhase('processing')
    
    const timeoutResponse = await handleUserResponse(
      'timeout',
      interview.currentQuestion?.prompt || '',
      interview.transcript,
      config.yoe
    )
    
    if (timeoutResponse.intent === 'timeout') {
      speakLine(timeoutResponse.response || 'Would you like more time to think, or should I repeat the question?', 'listen')
    }
  }

  async function handleUserInput(userInput) {
    if (!hasStarted || isProcessing) return

    setIsProcessing(true)
    setPhase('processing')
    clearResponseTimer()

    try {
      const response = await handleUserResponse(
        userInput,
        interview.currentQuestion?.prompt || '',
        interview.transcript,
        config.yoe
      )

      if (response.intent === 'clarify' || response.intent === 'repeat') {
        speakLine(response.response || interview.currentQuestion?.prompt || 'Let me repeat the question.', 'listen')
      } else if (response.intent === 'thinking') {
        const extraTime = response.extraTime || 30
        setStatusMessage(`Take your time... (${extraTime}s)`)
        speakLine(response.response || 'Take your time.', 'wait')
        
        setTimeout(() => {
          askQuestionByPrompt(interview.currentQuestion?.prompt || '')
        }, extraTime * 1000)
      } else if (response.intent === 'answer') {
        await handleListeningFinished(userInput)
      } else {
        speakLine(response.response || 'Please answer the question.', 'listen')
      }
    } catch (error) {
      console.error('User input handling error:', error)
      speakLine('Could you please repeat that?', 'listen')
    } finally {
      setIsProcessing(false)
    }
  }

  function scheduleNextQuestion(delay = 1000) {
    clearTurnTimer()
    turnTimerRef.current = window.setTimeout(() => {
      const runtime = interviewRef.current
      if (!runtime || runtime.isComplete || runtime.report) return
      const nextQuestion = runtime.currentQuestion
      if (nextQuestion) {
        askQuestionByPrompt(nextQuestion.prompt)
      }
    }, delay)
  }

  async function handleListeningFinished(answer) {
    const runtime = interviewRef.current
    if (!runtime || runtime.isComplete || runtime.report || isProcessing) return

    const cleanAnswer = String(answer || '').trim()
    const lowerAnswer = cleanAnswer.toLowerCase()

    // Check for human-like responses that need special handling
    const thinkingPhrases = ['let me think', 'give me a moment', 'i need time', 'let me consider']
    const clarifyPhrases = ['can you explain', 'didnt get that', 'can you repeat', 'what do you mean', 'clarify']
    const repeatPhrases = ['repeat', 'again', 'say that again', 'didnt hear']

    if (thinkingPhrases.some(phrase => lowerAnswer.includes(phrase))) {
      await handleUserInput(cleanAnswer)
      return
    }

    if (clarifyPhrases.some(phrase => lowerAnswer.includes(phrase)) || repeatPhrases.some(phrase => lowerAnswer.includes(phrase))) {
      await handleUserInput(cleanAnswer)
      return
    }

    if (!cleanAnswer) {
      setStatusMessage('No response detected. Please try again.')
      speakLine('I didn\'t catch that. Could you please answer?', 'listen')
      return
    }

    setSystemError('')
    setPhase('processing')
    setStatusMessage('Analyzing your response...')
    setIsProcessing(true)

    try {
      const result = await runtime.submitAnswer(cleanAnswer, 'voice')
      speech.resetTranscript()

      if (!result.ok) {
        setPhase('error')
        setSystemError(result.message)
        return
      }

      if (result.isComplete) {
        setStatusMessage('Interview complete. Generating your report...')
        return
      }

      const evaluation = result.evaluation
      let feedbackText = ''

      if (evaluation.feedback && evaluation.feedback.length > 0) {
        feedbackText = evaluation.feedback[0]
      } else {
        const neutralResponses = [
          "Good point, let's continue.",
          "Thanks for sharing.",
          "I understand.",
          "That makes sense."
        ]
        feedbackText = neutralResponses[Math.floor(Math.random() * neutralResponses.length)]
      }

      speakLine(feedbackText, 'wait')
      
      setTimeout(() => {
        scheduleNextQuestion(800)
      }, 1200)

    } catch (err) {
      setPhase('error')
      setSystemError('Something went wrong while processing your answer.')
      console.error('[InterviewSession] submitAnswer error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  function startListeningMode() {
    if (!speech.isSupported) {
      setPhase('error')
      setSystemError('Speech recognition is unavailable in this browser. Use Chrome or Edge.')
      return
    }

    speech.resetTranscript()
    const started = speech.startListening({
      continuous: false,
      interimResults: true,
      lang: 'en-US',
      onEnd: handleListeningFinished,
      onError: (message) => {
        setPhase('error')
        setSystemError(message)
      },
    })

    if (!started) {
      setPhase('error')
      setSystemError('Microphone could not start. Please allow mic permission and retry.')
      return
    }

    setSystemError('')
    setPhase('listening')
    setStatusMessage('Listening...')
    startResponseTimer()
  }

  function speakLine(line, onEndAction = 'listen') {
    if (!line) return

    setSystemError('')
    setPhase('ai-speaking')
    setStatusMessage('Interviewer speaking...')
    setAiSubtitle(line)
    clearResponseTimer()

    if (!voice.isSupported) {
      if (onEndAction === 'listen') startListeningMode()
      if (onEndAction === 'wait') scheduleNextQuestion()
      return
    }

    const started = voice.speak(line, {
      rate: 0.85,
      onEnd: () => {
        if (onEndAction === 'listen') startListeningMode()
        if (onEndAction === 'wait') scheduleNextQuestion()
      },
    })

    if (!started) {
      if (onEndAction === 'listen') startListeningMode()
      if (onEndAction === 'wait') scheduleNextQuestion()
    }
  }

  function askQuestionByPrompt(prompt) {
    speech.resetTranscript()
    speakLine(prompt, 'listen')
  }

  function handleStartInterview() {
    if (interview.isGenerating) {
      setStatusMessage('Still preparing your interview...')
      return
    }

    if (!interview.currentQuestion) {
      setSystemError('Failed to generate interview questions.')
      return
    }

    setHasStarted(true)
    setStatusMessage('Starting interview...')
    
    if (interview.introduction) {
      speakLine(interview.introduction, 'wait')
    } else {
      askQuestionByPrompt(interview.currentQuestion.prompt)
    }
  }

  function handleRepeatQuestion() {
    if (!hasStarted || !interview.currentQuestion || isProcessing) return
    askQuestionByPrompt(interview.currentQuestion.prompt)
  }

  function handleEndInterview() {
    clearTurnTimer()
    clearResponseTimer()
    voice.cancel()
    speech.stopListening()
    setIsProcessing(true)
    setStatusMessage('Ending interview...')
    interview.endInterviewNow()
  }

  useEffect(() => {
    return () => {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current)
      if (responseTimeoutRef.current) window.clearTimeout(responseTimeoutRef.current)
      cancelVoiceRef.current()
      stopListeningRef.current()
    }
  }, [])

  if (interview.isGenerating) {
    return (
      <section className={styles.stage}>
        <div className={styles.leftStage}>
          <div className={styles.voiceStage}>
            <div className={styles.orbWrap} data-phase="processing">
              <span className={styles.orb} />
            </div>
            <p className={styles.liveTag}>Generating personalized interview...</p>
          </div>
        </div>
        <aside className={styles.rightRail}>
          <div className={styles.aiCard}>
            <div className={styles.aiCore} data-phase="processing">
              <span />
            </div>
            <p>AI Interviewer</p>
          </div>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{candidateInitials || 'U'}</div>
            <div className={styles.userMeta}>
              <p>{config.candidateName}</p>
              <span>Preparing...</span>
            </div>
          </div>
        </aside>
      </section>
    )
  }

  if (!interview.currentQuestion) {
    return (
      <section className={styles.card}>
        <p>Failed to generate interview questions.</p>
        <button type="button" className={styles.secondaryButton} onClick={onAbort}>
          Exit Session
        </button>
      </section>
    )
  }

  return (
    <section className={styles.stage} aria-labelledby="voice-interview-title">
      <div className={styles.leftStage}>
        <header className={styles.headline}>
          <h2 id="voice-interview-title">{interview.templateLabel} Interview</h2>
          <span>
            {interview.progress.current}/{interview.progress.total}
          </span>
        </header>

        <div className={styles.speechBubble} aria-live="polite" aria-atomic="true">
          <div className={styles.bubbleDot} />
          {phase === 'ai-speaking' ? (
            <p><strong>AI:</strong> {aiSubtitle}</p>
          ) : phase === 'listening' ? (
            <p><strong>You:</strong> {speech.interimTranscript || speech.finalTranscript || '...'}</p>
          ) : (
            <p>{statusMessage}</p>
          )}
        </div>

        <div className={styles.voiceStage}>
          <div className={styles.orbWrap} data-phase={phase}>
            <span className={styles.orb} />
          </div>
          {phase === 'listening' && <p className={styles.liveTag}>Listening...</p>}
          {isProcessing && <p className={styles.liveTag}>Processing...</p>}
        </div>

        <div className={styles.controls}>
          {!hasStarted && (
            <button 
              type="button" 
              className={styles.primaryButton} 
              onClick={handleStartInterview}
              disabled={interview.isGenerating}
            >
              {interview.isGenerating ? 'Preparing...' : 'Start Interview'}
            </button>
          )}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleRepeatQuestion}
            disabled={!hasStarted || voice.isSpeaking || isProcessing}
          >
            Repeat
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleEndInterview}
            disabled={isProcessing || interview.isComplete}
          >
            End Interview
          </button>
        </div>

        {!voice.isSupported && <p className={styles.warning}>Voice playback unavailable in this browser.</p>}
        {!speech.isSupported && <p className={styles.error}>Microphone speech recognition unavailable.</p>}
        {visibleError && (
          <p className={styles.error} role="alert">
            {visibleError}
          </p>
        )}
      </div>

      <aside className={styles.rightRail}>
        <div className={styles.aiCard}>
          <div className={styles.aiCore} data-phase={phase}>
            <span />
          </div>
          <p>AI Interviewer</p>
        </div>

        <div className={styles.userCard}>
          <div className={styles.avatar}>{candidateInitials || 'U'}</div>
          <div className={styles.userMeta}>
            <p>{config.candidateName}</p>
            <span>{phase === 'listening' ? 'Speaking' : 'Ready'}</span>
          </div>
        </div>
      </aside>

      <p className={styles.srOnly}>{interview.currentQuestion.prompt}</p>
    </section>
  )
}
