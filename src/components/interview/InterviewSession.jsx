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
  const endInterviewTimeoutsRef = useRef({ reportMessage: null, forceComplete: null });
  const endingRequestedRef = useRef(false);
  const awaitingIntroductionRef = useRef(false);
  const interviewRef = useRef(null);
  const stopListeningRef = useRef(() => {});
  const cancelVoiceRef = useRef(() => {});
  const INTRO_NUDGE_COUNT_REF = useRef(0);
  const LAST_ASKED_QUESTION_REF = useRef(null);

  const interview = useInterviewEngine(config);
  const speech = useSpeechRecognition();
  const voice = useSpeechSynthesis();

  const visibleError = systemError || speech?.error || voice?.error;
  const userStatusLabel =
    phase === "listening"
      ? "Speaking"
      : phase === "ai-speaking"
        ? "Listening"
        : phase === "processing"
          ? "Processing"
          : phase === "ending"
            ? "Ending"
            : phase === "error"
              ? "Error"
              : "Ready";
  const candidateInitials =
    config?.candidateName
      ?.split(/\s+/)
      ?.filter(Boolean)
      ?.slice(0, 2)
      ?.map((part) => part?.[0]?.toUpperCase())
      ?.join("") || "U";

  function clearEndInterviewTimeouts() {
    if (endInterviewTimeoutsRef.current?.reportMessage) {
      window.clearTimeout(endInterviewTimeoutsRef.current.reportMessage);
      endInterviewTimeoutsRef.current.reportMessage = null;
    }
    if (endInterviewTimeoutsRef.current?.forceComplete) {
      window.clearTimeout(endInterviewTimeoutsRef.current.forceComplete);
      endInterviewTimeoutsRef.current.forceComplete = null;
    }
  }

  useEffect(() => {
    if (!interview?.report) return;

    clearEndInterviewTimeouts();

    try {
      setStatusMessage("Interview complete! Showing your report...");
      if (typeof onComplete === "function") {
        onComplete(interview.report);
      }
    } catch (error) {
      console.error("Error completing interview:", error);
      setSystemError("Failed to complete interview. Please try again.");
      setPhase("error");
      setIsProcessing(false);
    }
  }, [interview?.report, onComplete]);

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
    // Much more relaxed timing for non-native speakers
    responseTimeoutRef.current = window.setTimeout(() => {
      // Check if user might be thinking (long pause)
      if (!isUserThinking && phase === 'listening') {
        setIsUserThinking(true);
        setThinkingStartTime(Date.now());
        setStatusMessage("Take your time to think...");
        
        // Give much more time for thinking - non-native speakers need extra time
        responseTimeoutRef.current = window.setTimeout(() => {
          handleResponseTimeout();
        }, 30000); // 30 seconds for thinking time
      } else {
        handleResponseTimeout();
      }
    }, 20000); // 20 seconds before considering thinking (was 12)
  }

  async function handleResponseTimeout() {
    if (!hasStarted || isProcessing || isEnding || endingRequestedRef.current)
      return;
    
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

  function scheduleNextQuestion(delay = 1000) {
    if (isEnding || endingRequestedRef.current) return;

    console.log("[InterviewSession] Scheduling next question with delay:", delay);
    clearTurnTimer();
    turnTimerRef.current = window.setTimeout(() => {
      const runtime = interviewRef.current;
      if (!runtime || runtime.isComplete || runtime.report || isEnding) {
        console.log("[InterviewSession] Skipping next question - interview ended or complete");
        return;
      }
      const nextQuestion = runtime.currentQuestion;
      if (nextQuestion && nextQuestion.prompt !== LAST_ASKED_QUESTION_REF.current) {
        console.log("[InterviewSession] Asking next question:", nextQuestion.prompt);
        LAST_ASKED_QUESTION_REF.current = nextQuestion.prompt;
        askQuestionByPrompt(nextQuestion.prompt);
      } else {
        console.log("[InterviewSession] No new question available or duplicate question");
      }
    }, delay);
  }

  async function handleListeningFinished(answer) {
    const runtime = interviewRef.current;
    if (
      !runtime ||
      runtime.isComplete ||
      runtime.report ||
      isProcessing ||
      isEnding ||
      endingRequestedRef.current ||
      voice.isSpeaking
    )
      return;

    setIsProcessing(true);

    // Avoid processing if speech recognition emitted an error (e.g. permissions or no-speech)
    if (speech?.error || phase === "error") {
      console.log("[InterviewSession] Skipping analysis due to existing error state:", speech?.error);
      setIsProcessing(false);
      return;
    }

    if (awaitingIntroductionRef.current) {
      console.log("[InterviewSession] Processing introduction response");
      awaitingIntroductionRef.current = false;
      setSystemError("");
      setPhase("processing");
      setStatusMessage("Got it. Let's continue...");

      const acknowledgments = [
        "Great.",
        "Thanks.",
        "Got it.",
        "Perfect.",
      ];
      const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      speakLine(ack, "wait");

      setTimeout(() => {
        const runtime = interviewRef.current;
        const nextPrompt = runtime?.currentQuestion?.prompt;
        console.log("[InterviewSession] After intro - checking for next question:", nextPrompt);
        console.log("[InterviewSession] Runtime state:", {
          hasCurrentQuestion: !!runtime?.currentQuestion,
          isComplete: runtime?.isComplete,
          hasReport: !!runtime?.report
        });
        
        if (nextPrompt && !endingRequestedRef.current && !isEnding) {
          console.log("[InterviewSession] Asking first question after introduction");
          askQuestionByPrompt(nextPrompt);
        } else {
          console.error("[InterviewSession] No question available after introduction");
          setPhase("error");
          setSystemError("Failed to get first question after introduction.");
        }
      }, 900);
      return;
    }

    const cleanAnswer = String(answer || "").trim();
    console.log("[InterviewSession] Processing answer:", cleanAnswer);

    // Use AI to determine how to handle the response
    try {
      const response = await handleUserResponse(
        cleanAnswer || "empty_response",
        interview?.currentQuestion?.prompt || "",
        interview?.transcript || [],
        config?.yoe,
      );

      console.log("[InterviewSession] AI response analysis:", response);

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
        setStatusMessage("Sure — let me repeat that for you.");
        speakLine(
          interview?.currentQuestion?.prompt || "Let me repeat the question.",
          "listen",
        );
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
        console.log("[InterviewSession] Empty response detected, cleanAnswer:", cleanAnswer, "response:", response);
        if (!isEnding) {
          if (isUserThinking) {
            setStatusMessage("Still thinking? Take your time, or let me know if you'd like to skip.");
          } else {
            setStatusMessage("I didn't catch that. Could you please share your thoughts?");
          }
          speakLine("I didn't quite catch that. Could you please try again?", "listen");
        }
        setIsProcessing(false);
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
    if (isEnding || endingRequestedRef.current) {
      return;
    }

    try {
      console.log("[InterviewSession] Submitting answer to runtime:", cleanAnswer);
      const result = await runtime.submitAnswer(cleanAnswer, "voice");
      speech.resetTranscript();

      console.log("[InterviewSession] Runtime submitAnswer result:", result);

      if (!result.ok) {
        console.error("[InterviewSession] Runtime submitAnswer failed:", result);
        setPhase("error");
        setSystemError(result.message);
        setIsProcessing(false);
        return;
      }

      if (result.isComplete) {
        console.log("[InterviewSession] Interview is complete");
        setStatusMessage("Interview complete. Generating your report...");
        setIsProcessing(false);
        return;
      }

      // Use empathetic human-like responses instead of AI feedback for voice
      const acknowledgments = [
        "I see, that sounds like quite a journey.",
        "That must have been quite challenging for you.",
        "I understand, that takes real dedication.",
        "That's really interesting, tell me more.",
        "I can imagine that wasn't easy.",
        "That sounds like a valuable experience.",
        "I appreciate you sharing that with me.",
        "That gives me a good picture of your approach.",
      ];
      const feedbackText = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      console.log("[InterviewSession] Speaking acknowledgment:", feedbackText);

      speakLine(feedbackText, "wait");

      // Give user a moment before next question
      setTimeout(() => {
        if (!endingRequestedRef.current && !isEnding) {
          console.log("[InterviewSession] Scheduling next question");
          scheduleNextQuestion(1200);
        }
      }, 2000);
    } catch (err) {
      console.error("[InterviewSession] submitAnswer error:", err);
      setPhase("error");
      setSystemError("Something went wrong while processing your answer.");
    } finally {
      setIsProcessing(false);
    }
  }

  function startListeningMode() {
    if (isEnding || endingRequestedRef.current || voice.isSpeaking) return;
    
    console.log("[InterviewSession] Starting listening mode");
    
    try {
      if (speech.isListening) {
        console.log("[InterviewSession] Stopping existing speech recognition");
        speech.stopListening();
      }

      speech.resetTranscript();
      setIsUserThinking(false);
      setThinkingStartTime(null);
      
      // Add safety timeout to prevent getting stuck
      const listeningTimeout = setTimeout(() => {
        if (speech.isListening && phase === 'listening') {
          console.warn('[InterviewSession] Listening mode stuck, forcing restart');
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
        // More patient settings for non-native speakers
        maxAlternatives: 3, // Allow more alternative interpretations
        onEnd: (transcript) => {
          clearTimeout(listeningTimeout);
          console.log("[InterviewSession] Speech recognition ended with transcript:", transcript);
          handleListeningFinished(transcript);
        },
        onError: (message) => {
          clearTimeout(listeningTimeout);
          console.error("[InterviewSession] Speech recognition error:", message);
          if (message.includes("already started")) {
            return;
          }
          setPhase("error");
          setSystemError("");
        },
      });

      if (started) {
        console.log("[InterviewSession] Speech recognition started successfully");
        setPhase("listening");
        setStatusMessage("Listening...");
        startResponseTimer();
      } else {
        console.error("[InterviewSession] Failed to start speech recognition");
      }
    } catch (error) {
      console.error("[InterviewSession] Speech recognition error:", error);
      setPhase("error");
      setSystemError("");
      setStatusMessage("Listening...");
      startResponseTimer();
    }
  }

function askQuestionByPrompt(prompt) {
    if (!prompt || isEnding || endingRequestedRef.current) return;

    console.log("[InterviewSession] Asking question by prompt:", prompt);
    setPhase("ai-speaking");
    setStatusMessage("Interviewer speaking...");
    setAiSubtitle(prompt);
    clearResponseTimer();
    clearTurnTimer();

    if (!voice.isSupported) {
      console.log("[InterviewSession] Voice not supported, using text fallback for question");
      const readingTime = Math.max(prompt.length * 80, 3000);
      setTimeout(() => {
        if (endingRequestedRef.current) return;
        startListeningMode();
      }, readingTime);
      return;
    }

    const started = voice.speak(prompt, {
      onEnd: () => {
        console.log("[InterviewSession] Question speech finished, starting listening");
        if (endingRequestedRef.current) return;
        startListeningMode();
      },
    });

    if (!started) {
      console.error("[InterviewSession] Failed to start question speech");
      if (endingRequestedRef.current) return;
      startListeningMode();
    } else {
      console.log("[InterviewSession] Question speech started successfully");
    }
  }

function speakLine(line, onEndAction = "listen") {
    if (!line || isEnding || endingRequestedRef.current) return;

    console.log("[InterviewSession] Speaking line:", line, "with action:", onEndAction);
    setSystemError("");
    setPhase("ai-speaking");
    setStatusMessage("Interviewer speaking...");
    setAiSubtitle(line);
    clearResponseTimer();

    if (!voice.isSupported) {
      console.log("[InterviewSession] Voice not supported, using text fallback");
      // For non-voice browsers, simulate speech timing
      const readingTime = Math.max(line.length * 80, 2000);
      setTimeout(() => {
        if (endingRequestedRef.current) return;
        if (onEndAction === "listen" && !isEnding && !endingRequestedRef.current)
          startListeningMode();
        if (onEndAction === "wait" && !isEnding && !endingRequestedRef.current) {
          // Do nothing - let setTimeout handle the transition
        }
      }, readingTime);
      return;
    }

    const started = voice.speak(line, {
      onEnd: () => {
        console.log("[InterviewSession] Voice synthesis finished for:", line);
        if (endingRequestedRef.current) return;
        if (onEndAction === "listen" && !isEnding) startListeningMode();
        // For wait action, don't do anything here - let setTimeout handle it
      },
    });

    if (!started) {
      console.error("[InterviewSession] Failed to start voice synthesis for:", line);
      if (endingRequestedRef.current) return;
      if (onEndAction === "listen" && !isEnding) startListeningMode();
      // For wait action, do nothing - let setTimeout handle it
    } else {
      console.log("[InterviewSession] Voice synthesis started successfully");
    }
  }

  function handleEndInterview() {
    endingRequestedRef.current = true;
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

    clearEndInterviewTimeouts();

    endInterviewTimeoutsRef.current.reportMessage = window.setTimeout(() => {
      setStatusMessage("Generating your interview report...");
    }, 1000);

    endInterviewTimeoutsRef.current.forceComplete = window.setTimeout(() => {
      console.warn("Interview ending stuck, forcing completion");
      setSystemError(
        "Interview completion is taking longer than expected. Please try starting a new interview.",
      );
      setPhase("error");
      setIsProcessing(false);
    }, 45000);

    interview.endInterviewNow();
  }

  function handleStartInterview() {
    if (interview?.isGenerating) {
      setStatusMessage("Still preparing your interview...");
      return;
    }

    if (!interview?.currentQuestion) {
      console.error("[InterviewSession] No current question available");
      setSystemError("Failed to generate interview questions.");
      return;
    }

    console.log("[InterviewSession] Starting interview with first question:", interview?.currentQuestion?.prompt);
    setHasStarted(true);
    setStatusMessage("Starting interview...");

    if (interview?.introduction) {
      console.log("[InterviewSession] Speaking introduction:", interview?.introduction);
      awaitingIntroductionRef.current = true;
      speakLine(interview?.introduction, "listen");
    } else {
      console.log("[InterviewSession] No introduction, asking first question directly");
      askQuestionByPrompt(
        interview?.currentQuestion?.prompt || "Tell me about your experience.",
      );
    }
  }

  useEffect(() => {
    return () => {
      endingRequestedRef.current = true;
      if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
      if (responseTimeoutRef.current)
        window.clearTimeout(responseTimeoutRef.current);
      cancelVoiceRef.current();
      stopListeningRef.current();
      clearEndInterviewTimeouts();
    };
  }, []);

  useEffect(() => {
    interviewRef.current = interview;
  }, [interview]);

  if (interview?.isGenerating) {
    return (
      <section className={styles.stage}>
        <div className={styles.leftStage}>
          <header className={styles.headline}>
            <h2 id="voice-interview-title">Generating...</h2>
            <span>...</span>
          </header>

          <div
            className={styles.speechBubble}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.bubbleDot} />
            <p>
              <strong>Status:</strong> Preparing your interview questions...
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

  if (hasStarted && !interview?.currentQuestion && !interview?.report) {
    return (
      <section className={styles.stage} aria-labelledby="voice-interview-title">
        <div className={styles.leftStage}>
          <header className={styles.headline}>
            <h2 id="voice-interview-title">Finalizing</h2>
            <span>...</span>
          </header>

          <div
            className={styles.speechBubble}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.bubbleDot} />
            <p>
              <strong>Status:</strong> Generating your interview report...
            </p>
          </div>

          <div className={styles.voiceStage}>
            <div className={styles.orbWrap} data-phase="processing">
              <span className={styles.orb} />
            </div>
            <p className={styles.liveTag}>Processing...</p>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleEndInterview}
            >
              End Interview
            </button>
          </div>
        </div>
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
        </header>

        <div
          className={styles.speechBubble}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.bubbleDot} />
          {phase === "ai-speaking" ? (
            <p>
              <strong>Interviewer:</strong> {aiSubtitle}
            </p>
          ) : phase === "listening" ? (
            <p>
              <strong>You (speaking):</strong>{" "}
              {speech?.interimTranscript || speech?.finalTranscript || "..."}
            </p>
          ) : (
            <p>
              <strong>Status:</strong> {statusMessage}
            </p>
          )}
        </div>

        <div className={styles.voiceStage}>
          <div className={styles.orbWrap} data-phase={phase}>
            <span className={styles.orb} />
          </div>
          {phase === "listening" && (
            <p className={styles.liveTag}>You are speaking...</p>
          )}
          {phase === "ai-speaking" && (
            <p className={styles.liveTag}>Interviewer is speaking...</p>
          )}
          {isProcessing && phase !== "listening" && phase !== "ai-speaking" && (
            <p className={styles.liveTag}>Processing...</p>
          )}
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
            <span>{userStatusLabel}</span>
          </div>
        </div>
      </aside>

      <p className={styles.srOnly}>{interview?.currentQuestion?.prompt}</p>
    </section>
  );
}
