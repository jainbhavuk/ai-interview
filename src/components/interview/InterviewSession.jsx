import { useEffect, useRef, useState } from "react";
import { useInterviewEngine } from "../../hooks/useInterviewEngine";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { handleUserResponse } from "../../services/ai/interviewAI";
import styles from "./InterviewSession.module.css";

export function InterviewSession({ config, onComplete, onAbort }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [phase, setPhase] = useState("ready");
  const [statusMessage, setStatusMessage] = useState(
    "Preparing personalized interview...",
  );
  const [systemError, setSystemError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isUserThinking, setIsUserThinking] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState(null);
  const [aiSubtitle, setAiSubtitle] = useState("");

  const turnTimerRef = useRef(null);
  const responseTimeoutRef = useRef(null);
  const interviewRef = useRef(null);
  const stopListeningRef = useRef(() => {});
  const cancelVoiceRef = useRef(() => {});

  const interview = useInterviewEngine(config);
  const speech = useSpeechRecognition();
  const voice = useSpeechSynthesis();

  const visibleError = systemError || speech?.error || voice?.error;
  const candidateInitials =
    config?.candidateName
      ?.split(/\s+/)
      ?.filter(Boolean)
      ?.slice(0, 2)
      ?.map((part) => part?.[0]?.toUpperCase())
      ?.join("") || "U";

  useEffect(() => {
    if (interview?.report && !isEnding) {
      try {
        setStatusMessage("Interview complete! Generating your report...");
        if (typeof onComplete === 'function') {
          onComplete(interview?.report);
        }
      } catch (error) {
        console.error('Error completing interview:', error);
        setSystemError('Failed to complete interview. Please try again.');
      }
    }
  }, [interview?.report, onComplete, isEnding]);

  useEffect(() => {
    interviewRef.current = interview;
    stopListeningRef.current = speech.stopListening;
    cancelVoiceRef.current = voice.cancel;
  }, [interview, speech.stopListening, voice.cancel]);

  useEffect(() => {
    if (!interview?.isGenerating && !interview?.currentQuestion) {
      setStatusMessage("Interview preparation failed. Please try again.");
    } else if (!interview?.isGenerating) {
      setStatusMessage("Ready to start your personalized interview.");
    }
  }, [interview?.isGenerating, interview?.currentQuestion]);

  function clearTurnTimer() {
    if (turnTimerRef.current) {
      window.clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }

  function clearResponseTimer() {
    if (responseTimeoutRef.current) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }

  function startResponseTimer() {
    clearResponseTimer();
    responseTimeoutRef.current = window.setTimeout(() => {
      // Check if user might be thinking (long pause)
      if (!isUserThinking && phase === 'listening') {
        setIsUserThinking(true);
        setThinkingStartTime(Date.now());
        setStatusMessage("Take your time to think...");
        
        // Give more time for thinking
        responseTimeoutRef.current = window.setTimeout(() => {
          handleResponseTimeout();
        }, 20000); // Increased to 20 seconds to avoid premature analysis
      } else {
        handleResponseTimeout();
      }
    }, 12000); // Increased from 8 to 12 seconds to allow natural pauses
  }

  async function handleResponseTimeout() {
    if (!hasStarted || isProcessing || isEnding) return;
    
    const thinkingDuration = thinkingStartTime ? (Date.now() - thinkingStartTime) / 1000 : 0;
    
    // Use AI to decide how to handle timeout
    try {
      const timeoutResponse = await handleUserResponse(
        thinkingDuration > 5 ? "long_thinking_timeout" : "short_timeout",
        interview?.currentQuestion?.prompt || "",
        interview?.transcript || [],
        config?.yoe,
      );

      if (timeoutResponse?.intent === "offer_options") {
        setStatusMessage("Would you like me to repeat the question, or shall we continue?");
        speakLine(timeoutResponse?.response || "Would you like me to repeat the question, or would you prefer to skip this one and continue?", "listen");
        setIsUserThinking(false);
        setThinkingStartTime(null);
      } else if (timeoutResponse?.intent === "give_more_time") {
        setStatusMessage("Take your time...");
        speakLine(timeoutResponse?.response || "Take your time. I'm here when you're ready.", "wait");
        // Reset timer for more time
        responseTimeoutRef.current = window.setTimeout(() => {
          handleResponseTimeout();
        }, 20000);
      } else {
        // Default handling
        setStatusMessage("Taking longer than expected? Need more time?");
        setPhase("processing");
        speakLine(timeoutResponse?.response || "Would you like more time to think, or should I repeat the question?", "listen");
      }
    } catch (error) {
      console.error("AI timeout handling failed:", error);
      // Fallback to manual handling
      setStatusMessage("Taking longer than expected? Need more time?");
      setPhase("processing");
      speakLine("Would you like more time to think, or should I repeat the question?", "listen");
    }
  }

  async function handleUserInput(userInput) {
    if (!hasStarted || isProcessing) return;

    setIsProcessing(true);
    setPhase("processing");
    clearResponseTimer();

    try {
      const response = await handleUserResponse(
        userInput,
        interview?.currentQuestion?.prompt || "",
        interview?.transcript || [],
        config?.yoe,
      );

      if (response?.intent === "clarify" || response?.intent === "repeat") {
        speakLine(
          response?.response ||
            interview?.currentQuestion?.prompt ||
            "Let me repeat the question.",
          "listen",
        );
      } else if (response?.intent === "thinking") {
        const extraTime = response?.extraTime || 20;
        setIsUserThinking(true);
        setThinkingStartTime(Date.now());
        setStatusMessage(`Take your time... (${extraTime}s)`);
        speakLine(response?.response || "Take your time. I'll wait while you think.", "wait");
        
        setTimeout(() => {
          startListeningMode();
        }, 2000);
        
        // Extended timeout for thinking
        responseTimeoutRef.current = window.setTimeout(() => {
          handleResponseTimeout();
        }, extraTime * 1000);
      } else if (response?.intent === "ready") {
        setStatusMessage("Ready when you are...");
        setTimeout(() => {
          startListeningMode();
        }, 1000);
      } else if (response?.intent === "answer") {
        await handleListeningFinished(userInput);
      } else {
        speakLine(
          response?.response || "Please answer the question.",
          "listen",
        );
      }
    } catch (error) {
      console.error("User input handling error:", error);
      speakLine("Could you please repeat that?", "listen");
    } finally {
      setIsProcessing(false);
    }
  }

  function scheduleNextQuestion(delay = 1000) {
    if (isEnding) return;
    
    clearTurnTimer();
    turnTimerRef.current = window.setTimeout(() => {
      const runtime = interviewRef.current;
      if (!runtime || runtime.isComplete || runtime.report || isEnding) return;
      const nextQuestion = runtime.currentQuestion;
      if (nextQuestion) {
        askQuestionByPrompt(nextQuestion.prompt);
      }
    }, delay);
  }

  async function handleListeningFinished(answer) {
    const runtime = interviewRef.current;
    if (!runtime || runtime.isComplete || runtime.report || isProcessing || isEnding)
      return;

    const cleanAnswer = String(answer || "").trim();

    // Use AI to determine how to handle the response
    try {
      const response = await handleUserResponse(
        cleanAnswer || "empty_response",
        interview?.currentQuestion?.prompt || "",
        interview?.transcript || [],
        config?.yoe,
      );

      if (response?.intent === "thinking") {
        setIsUserThinking(true);
        setThinkingStartTime(Date.now());
        setStatusMessage("Take your time to formulate your answer...");
        speakLine(response?.response || "Take your time. I'll wait while you think.", "wait");
        setTimeout(() => {
          startListeningMode();
        }, 2000);
        return;
      }

      if (response?.intent === "clarify" || response?.intent === "repeat") {
        await handleUserInput(cleanAnswer);
        return;
      }

      if (response?.intent === "ready") {
        setStatusMessage("Ready when you are...");
        setTimeout(() => {
          startListeningMode();
        }, 1000);
        return;
      }

      if (!cleanAnswer || response?.intent === "empty") {
        if (!isEnding) {
          if (isUserThinking) {
            setStatusMessage("Still thinking? Take your time, or let me know if you'd like to skip.");
            speakLine("Still thinking? That's perfectly fine. Take your time, or let me know if you'd like me to repeat the question or move on to the next one.", "listen");
          } else {
            setStatusMessage("No response detected. Please try again.");
            speakLine(response?.response || "I didn't catch that. Could you please answer?", "listen");
          }
        }
        return;
      }

    } catch (error) {
      console.error("AI response analysis failed:", error);
      // Fallback to manual handling if AI fails
    }

    setSystemError("");
    setPhase("processing");
    setStatusMessage("Analyzing your response...");
    setIsProcessing(true);

    // Don't process if interview is ending
    if (isEnding) {
      return;
    }

    try {
      const result = await runtime.submitAnswer(cleanAnswer, "voice");
      speech.resetTranscript();

      if (!result.ok) {
        setPhase("error");
        setSystemError(result.message);
        return;
      }

      if (result.isComplete) {
        setStatusMessage("Interview complete. Generating your report...");
        setIsProcessing(false);
        return;
      }

      // Use simple acknowledgments instead of AI feedback for voice
      const acknowledgments = [
        "Okay",
        "Great", 
        "Got it",
        "Thanks",
        "Good",
        "Alright",
        "Understood",
        "Perfect"
      ];
      const feedbackText = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

      speakLine(feedbackText, "wait");

      // Give user a moment before next question
      setTimeout(() => {
        scheduleNextQuestion(1200);
      }, 2000);
    } catch (err) {
      setPhase("error");
      setSystemError("Something went wrong while processing your answer.");
      console.error("[InterviewSession] submitAnswer error:", err);
    } finally {
      setIsProcessing(false);
    }
  }

  function startListeningMode() {
    if (isEnding) return;
    
    try {
      if (speech.isListening) {
        speech.stopListening();
      }

      speech.resetTranscript();
      setIsUserThinking(false);
      setThinkingStartTime(null);
      
      // Add safety timeout to prevent getting stuck
      const listeningTimeout = setTimeout(() => {
        if (speech.isListening && phase === 'listening') {
          console.warn('Listening mode stuck, forcing restart');
          speech.stopListening();
          setTimeout(() => {
            startListeningMode();
          }, 100);
        }
      }, 30000); // 30 second safety timeout

      const started = speech.startListening({
        continuous: false,
        interimResults: true,
        language: "en-US",
        onEnd: (transcript) => {
          clearTimeout(listeningTimeout);
          handleListeningFinished(transcript);
        },
        onError: (message) => {
          clearTimeout(listeningTimeout);
          if (message.includes("already started")) {
            return;
          }
          setPhase("error");
          setSystemError("");
        },
      });

      if (started) {
        setPhase("listening");
        setStatusMessage("Listening...");
        startResponseTimer();
      }
    } catch (error) {
      console.error("Speech recognition error:", error);
      setPhase("error");
      setSystemError("");
      setStatusMessage("Listening...");
      startResponseTimer();
    }
  }

  function speakLine(line, onEndAction = "listen") {
    if (!line || isEnding) return;

    setSystemError("");
    setPhase("ai-speaking");
    setStatusMessage("Interviewer speaking...");
    setAiSubtitle(line);
    clearResponseTimer();

    if (!voice.isSupported) {
      if (onEndAction === "listen" && !isEnding) startListeningMode();
      if (onEndAction === "wait" && !isEnding) scheduleNextQuestion();
      return;
    }

    const started = voice.speak(line, {
      onEnd: () => {
        if (onEndAction === "listen" && !isEnding) startListeningMode();
        if (onEndAction === "wait" && !isEnding) scheduleNextQuestion();
      },
    });

    if (!started) {
      if (onEndAction === "listen" && !isEnding) startListeningMode();
      if (onEndAction === "wait" && !isEnding) scheduleNextQuestion();
    }
  }

  function handleEndInterview() {
    clearTurnTimer();
    clearResponseTimer();
    voice.cancel();
    speech.stopListening();
    setIsProcessing(true);
    setIsEnding(true);
    setIsUserThinking(false);
    setThinkingStartTime(null);
    setPhase("ending");
    setStatusMessage("Ending interview...");
    
    // Add timeout to show "generating report" message
    setTimeout(() => {
      setStatusMessage("Generating your interview report...");
    }, 2000);
    
    interview.endInterviewNow();
  }

  function askQuestionByPrompt(prompt) {
    if (!prompt) return;
    speech.resetTranscript();
    speakLine(prompt, "listen");
  }

  function handleStartInterview() {
    if (interview?.isGenerating) {
      setStatusMessage("Still preparing your interview...");
      return;
    }

    if (!interview?.currentQuestion) {
      setSystemError("Failed to generate interview questions.");
      return;
    }

    setHasStarted(true);
    setStatusMessage("Starting interview...");

    if (interview?.introduction) {
      speakLine(interview?.introduction, "listen");
    } else {
      askQuestionByPrompt(
        interview?.currentQuestion?.prompt || "Tell me about your experience.",
      );
    }
  }

  useEffect(() => {
    return () => {
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      if (responseTimeoutRef.current)
        window.clearTimeout(responseTimeoutRef.current);
      cancelVoiceRef.current();
      stopListeningRef.current();
    };
  }, []);

  useEffect(() => {
    interviewRef.current = interview;
  }, [interview]);

  if (interview?.isGenerating) {
    return (
      <section className={styles.stage}>
        <div className={styles.leftStage}>
          <div className={styles.voiceStage}>
            <div className={styles.orbWrap} data-phase="processing">
              <span className={styles.orb} />
            </div>
            <p className={styles.liveTag}>
              Generating personalized interview...
            </p>
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
            <div className={styles.avatar}>{candidateInitials || "U"}</div>
            <div className={styles.userMeta}>
              <p>{config?.candidateName}</p>
              <span>Preparing...</span>
            </div>
          </div>
        </aside>
      </section>
    );
  }

  if (!interview?.currentQuestion) {
    return (
      <section className={styles.card}>
        <p>Failed to generate interview questions.</p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onAbort}
        >
          Exit Session
        </button>
      </section>
    );
  }

  return (
    <section className={styles.stage} aria-labelledby="voice-interview-title">
      <div className={styles.leftStage}>
        <header className={styles.headline}>
          <h2 id="voice-interview-title">
            {interview?.templateLabel} Interview
          </h2>
          <span>
            {interview?.progress?.current}/{interview?.progress?.total}
          </span>
        </header>

        <div
          className={styles.speechBubble}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.bubbleDot} />
          {phase === "ai-speaking" ? (
            <p>
              <strong>AI:</strong> {aiSubtitle}
            </p>
          ) : phase === "listening" ? (
            <p>
              <strong>You:</strong>{" "}
              {speech?.interimTranscript || speech?.finalTranscript || "..."}
            </p>
          ) : (
            <p>
              <strong>AI:</strong> {statusMessage}
            </p>
          )}
        </div>

        <div className={styles.voiceStage}>
          <div className={styles.orbWrap} data-phase={phase}>
            <span className={styles.orb} />
          </div>
          {phase === "listening" && (
            <p className={styles.liveTag}>Listening...</p>
          )}
          {isProcessing && <p className={styles.liveTag}>Processing...</p>}
        </div>

        <div className={styles.controls}>
          {!hasStarted && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleStartInterview}
              disabled={interview?.isGenerating}
            >
              {interview?.isGenerating ? "Preparing..." : "Start Interview"}
            </button>
          )}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleEndInterview}
            disabled={isProcessing || interview?.isComplete}
          >
            End Interview
          </button>
        </div>

        {!voice?.isSupported && (
          <p className={styles.warning}>
            Voice playback unavailable in this browser.
          </p>
        )}
        {!speech?.isSupported && (
          <p className={styles.error}>
            Microphone speech recognition unavailable.
          </p>
        )}
        {visibleError && visibleError.trim() && (
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
          <div className={styles.avatar}>{candidateInitials || "U"}</div>
          <div className={styles.userMeta}>
            <p>{config?.candidateName}</p>
            <span>{phase === "listening" ? "Speaking" : "Ready"}</span>
          </div>
        </div>
      </aside>

      <p className={styles.srOnly}>{interview?.currentQuestion?.prompt}</p>
    </section>
  );
}
