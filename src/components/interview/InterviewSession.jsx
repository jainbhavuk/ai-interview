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
  const responseTimerTokenRef = useRef(0);
  const emptyResponseCountRef = useRef(0);
  const phaseRef = useRef(phase);
  const isUserThinkingRef = useRef(isUserThinking);
  const thinkingStartTimeRef = useRef(thinkingStartTime);
  const endInterviewTimeoutsRef = useRef({ reportMessage: null, forceComplete: null });
  const endingRequestedRef = useRef(false);
  const awaitingIntroductionRef = useRef(false);
  const interviewRef = useRef(null);
  const stopListeningRef = useRef(() => {});
  const cancelVoiceRef = useRef(() => {});
  const LAST_ASKED_QUESTION_REF = useRef(null);

  const interview = useInterviewEngine(config);
  const speech = useSpeechRecognition();
  const voice = useSpeechSynthesis();

  const visibleError = systemError || speech?.error || voice?.error;
  const userStatusLabel = (() => {
    switch (phase) {
      case "listening":
        return "Speaking";
      case "ai-speaking":
        return "Listening";
      case "processing":
        return "Processing";
      case "ending":
        return "Ending";
      case "error":
        return "Error";
      default:
        return "Ready";
    }
  })();
  const candidateInitials =
    config?.candidateName
      ?.split(/\s+/)
      ?.filter(Boolean)
      ?.slice(0, 2)
      ?.map((part) => part?.[0]?.toUpperCase())
      ?.join("") || "U";

  function clearEndInterviewTimeouts() {
    if (endInterviewTimeoutsRef.current?.reportMessage) {
      globalThis.clearTimeout(endInterviewTimeoutsRef.current.reportMessage);
      endInterviewTimeoutsRef.current.reportMessage = null;
    }
    if (endInterviewTimeoutsRef.current?.forceComplete) {
      globalThis.clearTimeout(endInterviewTimeoutsRef.current.forceComplete);
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
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    isUserThinkingRef.current = isUserThinking;
  }, [isUserThinking]);

  useEffect(() => {
    thinkingStartTimeRef.current = thinkingStartTime;
  }, [thinkingStartTime]);

  useEffect(() => {
    if (!interview?.isGenerating && !interview?.currentQuestion) {
      setStatusMessage("Interview preparation failed. Please try again.");
    } else if (!interview?.isGenerating) {
      setStatusMessage("Ready to start your personalized interview.");
    }
  }, [interview?.isGenerating, interview?.currentQuestion]);

  function clearTurnTimer() {
    if (turnTimerRef.current) {
      globalThis.clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }

  function clearResponseTimer() {
    if (responseTimeoutRef.current) {
      globalThis.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }

  function startResponseTimer() {
    clearResponseTimer();
    const token = ++responseTimerTokenRef.current;
    // Much more relaxed timing for non-native speakers
    responseTimeoutRef.current = globalThis.setTimeout(() => {
      if (token !== responseTimerTokenRef.current) return;
      // Check if user might be thinking (long pause)
      if (!isUserThinkingRef.current && phaseRef.current === "listening") {
        setIsUserThinking(true);
        setThinkingStartTime(Date.now());
        setStatusMessage("Take your time to think...");
        
        // Give much more time for thinking - non-native speakers need extra time
        responseTimeoutRef.current = globalThis.setTimeout(() => {
          if (token !== responseTimerTokenRef.current) return;
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
    
    const thinkingDuration = thinkingStartTimeRef.current
      ? (Date.now() - thinkingStartTimeRef.current) / 1000
      : 0;
    
    // Use AI to decide how to handle timeout
    try {
      const runtime = interviewRef.current;
      const timeoutResponse = await handleUserResponse(
        thinkingDuration > 5 ? "long_thinking_timeout" : "short_timeout",
        runtime?.currentQuestion?.prompt || "",
        config?.yoe,
        runtime?.transcript || [],
      );

      if (timeoutResponse?.intent === "offer_options") {
        setStatusMessage("Need a repeat or clarification?");
        speakLine(
          timeoutResponse?.response ||
            "No rush. Would you like me to repeat the question, clarify it, or would you prefer to skip and continue? You can say “repeat”, “clarify”, or “skip”.",
          "listen",
        );
        setIsUserThinking(false);
        setThinkingStartTime(null);
      } else if (timeoutResponse?.intent === "give_more_time") {
        setStatusMessage("Take your time...");
        speakLine(timeoutResponse?.response || "Take your time. I'm here when you're ready.", "wait");
        // Reset timer for more time
        responseTimeoutRef.current = globalThis.setTimeout(() => {
          handleResponseTimeout();
        }, 20000);
      } else {
        // Default handling
        setStatusMessage("Need a repeat or clarification?");
        setPhase("ai-speaking");
        speakLine(
          timeoutResponse?.response ||
            "Take your time. If you'd like, I can repeat or clarify the question. You can say “repeat” or “clarify”.",
          "listen",
        );
      }
    } catch (error) {
      console.error("AI timeout handling failed:", error);
      // Fallback to manual handling
      setStatusMessage("Need a repeat or clarification?");
      setPhase("ai-speaking");
      speakLine(
        "No rush. If you'd like, I can repeat or clarify the question. You can say “repeat” or “clarify”.",
        "listen",
      );
    }
  }

  function scheduleNextQuestion(delay = 1000, retries = 0) {
    if (isEnding || endingRequestedRef.current) return;

    console.log("[InterviewSession] Scheduling next question with delay:", delay);
    clearTurnTimer();
    turnTimerRef.current = globalThis.setTimeout(() => {
      const runtime = interviewRef.current;
      if (!runtime || runtime.isComplete || runtime.report || isEnding) {
        console.log("[InterviewSession] Skipping next question - interview ended or complete");
        return;
      }
      const nextQuestion = runtime.currentQuestion;
      if (nextQuestion && nextQuestion.prompt !== LAST_ASKED_QUESTION_REF.current) {
        console.log("[InterviewSession] Asking next question:", nextQuestion.prompt);
        askQuestionByPrompt(nextQuestion.prompt);
      } else {
        console.log("[InterviewSession] No new question available or duplicate question");
        if (retries < 12 && !endingRequestedRef.current && !isEnding) {
          scheduleNextQuestion(250, retries + 1);
        } else if (!endingRequestedRef.current && !isEnding) {
          setPhase("error");
          setSystemError("Interview got stuck while loading the next question. Please start a new session.");
          setIsProcessing(false);
        }
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

    clearResponseTimer();
    setIsProcessing(true);

    // Avoid processing if speech recognition emitted an error (e.g. permissions or no-speech)
    if (speech?.error || phase === "error") {
      console.log("[InterviewSession] Skipping analysis due to existing error state:", speech?.error);
      setIsProcessing(false);
      return;
    }

    const cleanAnswer = String(answer || "").trim();
    console.log("[InterviewSession] Processing answer:", cleanAnswer);

    try {
      // Handle simple voice commands locally (no extra buttons needed).
      const repeatNowPattern = /^(repeat|again|say again|one more time|pardon)$/i;
      const skipNowPattern = /^(skip|pass)$/i;
      const endNowPattern = /^(end interview|stop interview|finish interview)$/i;
      const clarifyNowPattern = /^(clarify|explain|what do you mean)$/i;

      if (endNowPattern.test(cleanAnswer)) {
        setIsProcessing(false);
        handleEndInterview();
        return;
      }

      if (repeatNowPattern.test(cleanAnswer)) {
        setStatusMessage("Sure — repeating the question.");
        setIsProcessing(false);
        askQuestionByPrompt(runtime?.currentQuestion?.prompt || "", { force: true });
        return;
      }

      if (clarifyNowPattern.test(cleanAnswer)) {
        setStatusMessage("Sure — I'll clarify.");
        setIsProcessing(false);
        try {
          const clarification = await handleUserResponse(
            "clarify",
            runtime?.currentQuestion?.prompt || "",
            config?.yoe,
            runtime?.transcript || [],
          );
          speakLine(
            String(clarification?.response || "Sure — let me rephrase that.").trim(),
            "wait",
          );
        } catch {
          speakLine("Sure — let me rephrase that.", "wait");
        }
        // After the clarification line, repeat the question to anchor the user.
        globalThis.setTimeout(() => {
          if (endingRequestedRef.current || isEnding) return;
          askQuestionByPrompt(runtime?.currentQuestion?.prompt || "", { force: true });
        }, 500);
        return;
      }

      if (skipNowPattern.test(cleanAnswer)) {
        setStatusMessage("Okay — skipping this question.");
        setIsProcessing(false);
        runtime.skipQuestion();
        scheduleNextQuestion(350);
        return;
      }

      // Handle introduction capture: only once, and never block progression.
      if (awaitingIntroductionRef.current) {
        console.log("[InterviewSession] Processing introduction response");
        awaitingIntroductionRef.current = false;
        emptyResponseCountRef.current = 0;
        setSystemError("");
        setPhase("processing");
        setStatusMessage("Thanks — let's start.");
        setIsProcessing(false);
        scheduleNextQuestion(400);
        return;
      }

      // If user is explicitly trying to skip/pass, bypass intent gating and let runtime handle skip logic.
      const skipAttemptPattern =
        /^(i don't know|idk|no idea|not sure|skip|pass|can't answer|dont know|don't know)$/i;

      if (!cleanAnswer) {
        emptyResponseCountRef.current += 1;
      } else {
        emptyResponseCountRef.current = 0;
      }

      if (!cleanAnswer) {
        // Avoid infinite "I didn't catch that" loops.
        if (emptyResponseCountRef.current >= 2) {
          setStatusMessage("Repeating the question...");
          setIsProcessing(false);
          askQuestionByPrompt(runtime?.currentQuestion?.prompt || "", { force: true });
          return;
        }

        setStatusMessage("Need a repeat or clarification?");
        setIsProcessing(false);
        speakLine(
          "I didn't catch anything. Would you like me to repeat the question or clarify it? You can say “repeat” or “clarify”.",
          "listen",
        );
        return;
      }

      if (!skipAttemptPattern.test(cleanAnswer)) {
        // Use AI to determine how to handle meta responses (thinking/clarify/repeat/ready).
        const response = await handleUserResponse(
          cleanAnswer || "empty_response",
          runtime?.currentQuestion?.prompt || "",
          config?.yoe,
          runtime?.transcript || [],
        );

        console.log("[InterviewSession] AI response analysis:", response);

        if (response?.intent === "thinking") {
          setIsUserThinking(true);
          setThinkingStartTime(Date.now());
          setStatusMessage("Take your time.");
          setIsProcessing(false);
          speakLine(response?.response || "Take your time.", "wait");
          setTimeout(() => {
            startListeningMode();
          }, 1200);
          return;
        }

        if (response?.intent === "clarify" || response?.intent === "repeat") {
          setStatusMessage("Sure — repeating the question.");
          setIsProcessing(false);
          askQuestionByPrompt(runtime?.currentQuestion?.prompt || "", { force: true });
          return;
        }

        if (response?.intent === "ready") {
          setStatusMessage("Go ahead.");
          setIsProcessing(false);
          setTimeout(() => {
            startListeningMode();
          }, 300);
          return;
        }

        if (response?.intent === "empty") {
          setStatusMessage("Please try again.");
          setIsProcessing(false);
          speakLine("Please try again.", "listen");
          return;
        }
      }

      setSystemError("");
      setPhase("processing");
      setStatusMessage("Analyzing your response...");

      // Don't process if interview is ending
      if (isEnding || endingRequestedRef.current) {
        setIsProcessing(false);
        return;
      }

      console.log("[InterviewSession] Submitting answer to runtime:", cleanAnswer);
      const result = await runtime.submitAnswer(cleanAnswer, "voice");
      speech.resetTranscript();

      console.log("[InterviewSession] Runtime submitAnswer result:", result);

      if (!result.ok) {
        console.error("[InterviewSession] Runtime submitAnswer failed:", result);
        setPhase("error");
        setSystemError(result.message);
        return;
      }

      if (result.needsRetry) {
        const retryPrompt = String(result.retryPrompt || "").trim();
        const extraHint =
          result.retryCount >= 2
            ? " You can also say “skip” to move on."
            : "";
        setStatusMessage("Please add a bit more detail.");
        if (retryPrompt) {
          speakLine(`${retryPrompt}${extraHint}`, "listen");
        } else {
          speakLine(`Could you add more detail?${extraHint}`, "listen");
        }
        return;
      }

      if (result.isComplete) {
        console.log("[InterviewSession] Interview is complete");
        setStatusMessage("Interview complete. Generating your report...");
        return;
      }

      // Proceed without robotic filler; follow-ups (if any) will be asked next by the engine.
      setStatusMessage("Next question...");
      scheduleNextQuestion(700);
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
      const listeningTimeout = globalThis.setTimeout(() => {
        if (speech.isListening && phaseRef.current === "listening") {
          console.warn('[InterviewSession] Listening mode stuck, forcing restart');
          speech.stopListening();
          globalThis.setTimeout(() => {
            startListeningMode();
          }, 100);
        }
      }, 30000); // 30 second safety timeout

      const started = speech.startListening({
        continuous: false,
        interimResults: true,
        lang: "en-US",
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
          setSystemError(message || "Speech recognition error.");
          setIsProcessing(false);
        },
      });

      if (started) {
        console.log("[InterviewSession] Speech recognition started successfully");
        setPhase("listening");
        setStatusMessage("Listening...");
        startResponseTimer();
      } else {
        console.error("[InterviewSession] Failed to start speech recognition");
        setPhase("error");
        setSystemError("Failed to start microphone listening.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("[InterviewSession] Speech recognition error:", error);
      setPhase("error");
      setSystemError("Microphone listening failed. Please check permissions and try again.");
      setIsProcessing(false);
    }
  }

  function askQuestionByPrompt(prompt, options = {}) {
    const force = Boolean(options?.force);
    const nextPrompt = String(prompt || "").trim();
    if (!nextPrompt || isEnding || endingRequestedRef.current) return;

    if (!force && nextPrompt === LAST_ASKED_QUESTION_REF.current) {
      console.log("[InterviewSession] Skipping duplicate question ask:", nextPrompt);
      return;
    }

    LAST_ASKED_QUESTION_REF.current = nextPrompt;
    emptyResponseCountRef.current = 0;
    setIsUserThinking(false);
    setThinkingStartTime(null);

    console.log("[InterviewSession] Asking question by prompt:", nextPrompt);
    setPhase("ai-speaking");
    setStatusMessage("Interviewer speaking...");
    setAiSubtitle(nextPrompt);
    clearResponseTimer();
    clearTurnTimer();

    if (!voice.isSupported) {
      console.log("[InterviewSession] Voice not supported, using text fallback for question");
      const readingTime = Math.max(nextPrompt.length * 80, 3000);
      globalThis.setTimeout(() => {
        if (endingRequestedRef.current) return;
        startListeningMode();
      }, readingTime);
      return;
    }

    const started = voice.speak(nextPrompt, {
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
      globalThis.setTimeout(() => {
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

    endInterviewTimeoutsRef.current.reportMessage = globalThis.setTimeout(() => {
      setStatusMessage("Generating your interview report...");
    }, 1000);

    endInterviewTimeoutsRef.current.forceComplete = globalThis.setTimeout(() => {
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
      askQuestionByPrompt(interview?.currentQuestion?.prompt || "Tell me about your experience.");
    }
  }

  useEffect(() => {
    return () => {
      endingRequestedRef.current = true;
      if (turnTimerRef.current) globalThis.clearTimeout(turnTimerRef.current);
      if (responseTimeoutRef.current)
        globalThis.clearTimeout(responseTimeoutRef.current);
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
        {visibleError?.trim() && (
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
