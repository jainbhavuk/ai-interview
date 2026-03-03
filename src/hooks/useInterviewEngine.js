import { useState, useEffect, useRef } from "react";
import {
  generateInterviewStructure,
  evaluateAnswer,
  generateFinalReport,
} from "../services/ai/interviewAI";

function normalizeQuestionItem(item, defaults = {}) {
  if (!item) return null;
  const prompt = String(item?.prompt || "").trim();
  if (!prompt) return null;
  return {
    id: item?.id,
    prompt,
    competency: item?.competency ?? defaults?.competency,
    type: item?.type || defaults?.type || "main",
    parentQuestion: item?.parentQuestion ?? defaults?.parentQuestion,
  };
}

function flattenQuestions(structure) {
  const flat = [];
  const questions = Array.isArray(structure?.questions) ? structure.questions : [];
  questions.forEach((q) => {
    // Backend may already return a flat list (with `type`) OR a nested list with followUps.
    const main = normalizeQuestionItem(q, { type: "main" });
    if (main) flat.push(main);

    if (Array.isArray(q?.followUps) && q.followUps.length > 0) {
      q.followUps.forEach((fu) => {
        const follow = normalizeQuestionItem(fu, {
          competency: q?.competency,
          type: "followup",
          parentQuestion: main?.prompt || q?.prompt,
        });
        if (follow) flat.push(follow);
      });
    }
  });

  // De-dupe by normalized prompt to avoid accidental repeats from model output
  const seen = new Set();
  return flat.filter((item) => {
    const key = String(item?.prompt || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useInterviewEngine(config) {
  const [interviewStructure, setInterviewStructure] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [isGenerating, setIsGenerating] = useState(true);
  const [report, setReport] = useState(null);

  const allQuestions = useRef([]);
  const stateRef = useRef({ transcript, currentQuestionIndex });
  const dynamicFollowUpsAddedRef = useRef(0);
  const CONSECUTIVE_SKIP_ATTEMPTS = useRef(0);
  const RETRY_STATE_REF = useRef({ questionId: null, count: 0 });

  function getMainCompletionStats(conversation) {
    const transcriptItems = Array.isArray(conversation) ? conversation : [];
    const totalMain = (allQuestions?.current || []).filter((q) => q?.type === "main")
      .length;

    const answeredMain = transcriptItems.filter((t) => {
      if (!t) return false;
      if (t.skipped) return false;
      if (t.type !== "main") return false;
      const answer = String(t.answer || "").trim();
      return Boolean(answer);
    }).length;

    const ratio = totalMain > 0 ? answeredMain / totalMain : 0;
    return { answeredMain, totalMain, ratio };
  }

  useEffect(() => {
    stateRef.current = { transcript, currentQuestionIndex };
  }, [transcript, currentQuestionIndex]);

  useEffect(() => {
    async function generateStructure() {
      try {
        setIsGenerating(true);
        dynamicFollowUpsAddedRef.current = 0;
        CONSECUTIVE_SKIP_ATTEMPTS.current = 0;
        const structure = await generateInterviewStructure(config);
        setInterviewStructure(structure);
        allQuestions.current = flattenQuestions(structure);
      } catch (error) {
        console.error("Failed to generate interview:", error);
        // Fallback questions
        allQuestions.current = [
          {
            id: "fallback1",
            prompt: `Tell me about your experience with ${config.domain} development.`,
            competency: "experience",
            type: "main",
          },
          {
            id: "fallback2",
            prompt: "What projects are you most proud of?",
            competency: "projects",
            type: "main",
          },
        ];
        setInterviewStructure({
          introduction: `Hi ${config?.candidateName}, hope you're having a good day! Let's start with you sharing a bit about yourself and your experience, then we'll proceed with some questions.`,
          questions: allQuestions?.current,
        });
      } finally {
        setIsGenerating(false);
      }
    }

    generateStructure();
  }, [config]);

  const currentQuestion = allQuestions?.current?.[currentQuestionIndex] || null;
  const isComplete = Boolean(report);

  async function submitAnswer(answer, inputMode = "voice") {
    if (!currentQuestion || isComplete)
      return { ok: false, message: "No active question" };

    const cleanAnswer = String(answer || "").trim();
    if (!cleanAnswer) return { ok: false, message: "Answer cannot be empty" };

    const isFirstAnsweredQuestion = (stateRef?.current?.transcript || []).length === 0;
    const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
    const MIN_FIRST_ANSWER_WORDS = 50;

    // Check for skip attempts
    const isSkipAttempt = /^(i don't know|idk|no idea|not sure|skip|pass|can't answer|don't know)$/i.test(cleanAnswer);
    
    if (isSkipAttempt) {
      CONSECUTIVE_SKIP_ATTEMPTS.current += 1;
      
      // If user has tried to skip 2+ times, move to next question
      if (CONSECUTIVE_SKIP_ATTEMPTS.current >= 2) {
        CONSECUTIVE_SKIP_ATTEMPTS.current = 0; // Reset counter
        
        // Add a note about the skipped question
        const skipEntry = {
          id: `${currentQuestion?.id || "unknown"}_answer`,
          questionId: currentQuestion?.id || "unknown",
          prompt: currentQuestion?.prompt || "",
          answer: cleanAnswer,
          competency: currentQuestion?.competency || "general",
          type: currentQuestion?.type || "main",
          skipped: true,
          inputMode,
          evaluation: { score: 1, feedback: ["Question skipped"], needsFollowUp: false },
          answeredAt: new Date().toISOString(),
        };
        
        const newTranscript = [
          ...(stateRef?.current?.transcript || []),
          skipEntry,
        ];
        setTranscript(newTranscript);

        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);

        if (nextIndex >= allQuestions?.current?.length) {
          await generateReport(newTranscript);
          return { ok: true, evaluation: { score: 1, feedback: ["Question skipped"] }, isComplete: true };
        }

        return { ok: true, evaluation: { score: 1, feedback: ["Moving to next question"] }, isComplete: false };
      }
    } else {
      // Reset counter if user provides a real answer
      CONSECUTIVE_SKIP_ATTEMPTS.current = 0;
    }

    try {
      const evaluation = await evaluateAnswer(
        currentQuestion?.prompt || "",
        cleanAnswer,
        stateRef?.current?.transcript || [],
      );

      const isLowQualityForFirst =
        isFirstAnsweredQuestion && wordCount < MIN_FIRST_ANSWER_WORDS;
      const needsRetry =
        isLowQualityForFirst ||
        evaluation?.isRelevant === false ||
        evaluation?.needsElaboration === true;

      if (needsRetry) {
        const qid = currentQuestion?.id || "unknown";
        if (RETRY_STATE_REF.current.questionId !== qid) {
          RETRY_STATE_REF.current = { questionId: qid, count: 1 };
        } else {
          RETRY_STATE_REF.current = {
            questionId: qid,
            count: (RETRY_STATE_REF.current.count || 0) + 1,
          };
        }

        const fallbackPrompt = isLowQualityForFirst
          ? "Could you describe your experience in more detail? Aim for around 3–5 sentences."
          : "Could you add a bit more detail and keep it specific to the question?";

        // Don't advance question index; InterviewSession will re-prompt and re-listen.
        return {
          ok: true,
          evaluation,
          isComplete: false,
          needsRetry: true,
          retryPrompt: String(evaluation?.followUpQuestion || "").trim() || fallbackPrompt,
          retryCount: RETRY_STATE_REF.current.count,
        };
      }

      // Reset retry state after a satisfactory answer
      RETRY_STATE_REF.current = { questionId: null, count: 0 };

      const answerEntry = {
        id: `${currentQuestion?.id || "unknown"}_answer`,
        questionId: currentQuestion?.id || "unknown",
        prompt: currentQuestion?.prompt || "",
        answer: cleanAnswer,
        competency: currentQuestion?.competency || "general",
        type: currentQuestion?.type || "main",
        inputMode,
        evaluation,
        answeredAt: new Date().toISOString(),
      };

      const newTranscript = [
        ...(stateRef?.current?.transcript || []),
        answerEntry,
      ];
      setTranscript(newTranscript);

      const maxDynamicFollowUps =
        config?.durationMinutes === 10
          ? 1
          : config?.durationMinutes === 20
            ? 2
            : 3;
      const isAlreadyADeepQuestion =
        currentQuestion?.type === "followup" ||
        currentQuestion?.type === "dynamic_followup";

      if (
        evaluation?.needsFollowUp &&
        evaluation?.followUpQuestion &&
        dynamicFollowUpsAddedRef.current < maxDynamicFollowUps &&
        !isAlreadyADeepQuestion
      ) {
        const followUpEntry = {
          id: `fu_${Date.now()}`,
          prompt: evaluation?.followUpQuestion || "",
          competency: currentQuestion?.competency || "general",
          type: "dynamic_followup",
          parentQuestion: currentQuestion?.prompt || "",
        };

        allQuestions?.current?.splice(
          currentQuestionIndex + 1,
          0,
          followUpEntry,
        );

        dynamicFollowUpsAddedRef.current += 1;
      }

      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);

      if (nextIndex >= allQuestions?.current?.length) {
        await generateReport(newTranscript);
        return { ok: true, evaluation, isComplete: true };
      }

      return { ok: true, evaluation, isComplete: false };
    } catch (error) {
      console.error("Answer submission error:", error);
      return { ok: false, message: "Failed to process answer" };
    }
  }

  async function generateReport(conversation) {
    try {
      const { answeredMain, totalMain, ratio } = getMainCompletionStats(conversation);
      if (ratio < 0.5) {
        const incomplete = {
          incomplete: true,
          counting: "main",
          answeredCount: answeredMain,
          total: totalMain,
          requiredRatio: 0.5,
        };
        setReport(incomplete);
        return incomplete;
      }

      const finalReport = await generateFinalReport(conversation, config);
      setReport(finalReport);
      return finalReport;
    } catch (error) {
      console.error("Report generation error:", error);
      const fallbackReport = {
        overallScore: 3,
        strengths: ["Completed interview"],
        improvements: ["Continue practicing"],
        competencyScores: {},
        recommendation: "consider",
        summary: "Interview completed successfully",
      };
      setReport(fallbackReport);
      return fallbackReport;
    }
  }

  function skipQuestion() {
    if (!currentQuestion) return;

    const skipEntry = {
      id: `${currentQuestion?.id || "unknown"}_skipped`,
      questionId: currentQuestion?.id || "unknown",
      prompt: currentQuestion?.prompt || "",
      answer: "",
      competency: currentQuestion?.competency || "general",
      type: currentQuestion?.type || "main",
      skipped: true,
      evaluation: { score: 1, feedback: ["Question skipped"] },
      answeredAt: new Date().toISOString(),
    };

    const newTranscript = [...(stateRef?.current?.transcript || []), skipEntry];
    setTranscript(newTranscript);

    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);

    if (nextIndex >= allQuestions?.current?.length) {
      generateReport(newTranscript);
    }
  }

  function endInterviewNow() {
    generateReport(stateRef?.current?.transcript || []);
  }

  return {
    introduction: interviewStructure?.introduction || "",
    templateLabel: `${config?.domain || "Software"} Engineer`,
    progress: {
      current: Math.min(
        currentQuestionIndex + 1,
        allQuestions?.current?.length || 0,
      ),
      total: allQuestions?.current?.length || 0,
    },
    currentQuestion,
    transcript,
    isComplete,
    isGenerating,
    report,
    submitAnswer,
    skipQuestion,
    endInterviewNow,
  };
}
