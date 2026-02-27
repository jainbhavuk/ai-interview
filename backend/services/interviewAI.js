import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createLLM } from '../config/llmConfig.js';

let _llm = null;
function getLLM() {
  if (!_llm) _llm = createLLM();
  return _llm;
}

const BEHAVIORAL_QUESTIONS = [
  "Tell me about a time you had to meet a tight deadline. How did you handle it?",
  "Describe a situation where you had to work with a difficult team member.",
  "Give an example of a time you had to learn a new technology quickly.",
  "Tell me about a project you're most proud of and why.",
  "Describe a time you had to take leadership without being asked.",
  "Give an example of how you handled a disagreement with a colleague.",
  "Tell me about a time you failed and what you learned from it.",
  "Describe a situation where you had to prioritize multiple tasks.",
  "Give an example of how you've mentored or helped others.",
  "Tell me about a time you had to adapt to major changes.",
  "Describe a complex problem you solved and your approach.",
  "Give an example of how you handle stress and pressure.",
  "Tell me about a time you had to communicate bad news.",
  "Describe a situation where you went above and beyond.",
  "Give an example of how you handle constructive criticism.",
  "Tell me about a time you had to make a quick decision.",
  "Describe a situation where you improved a process.",
  "Give an example of how you handle competing priorities.",
  "Tell me about a time you had to persuade others.",
  "Describe a situation where you had to work with limited resources.",
  "Give an example of how you handle ambiguity.",
  "Tell me about a time you had to collaborate across teams.",
  "Describe a situation where you had to be creative.",
  "Give an example of how you handle mistakes.",
  "Tell me about a time you had to motivate others.",
  "Describe a situation where you had to negotiate.",
  "Give an example of how you handle multiple deadlines.",
  "Tell me about a time you had to work independently.",
  "Describe a situation where you had to present to stakeholders.",
  "Give an example of how you handle conflicting requirements.",
  "Tell me about a time you had to troubleshoot under pressure.",
  "Describe a situation where you had to delegate tasks.",
  "Give an example of how you handle customer feedback.",
  "Tell me about a time you had to learn from failure.",
  "Describe a situation where you had to be diplomatic.",
  "Give an example of how you handle tight budgets.",
  "Tell me about a time you had to innovate.",
  "Describe a situation where you had to mediate conflict.",
  "Give an example of how you handle scope changes.",
  "Tell me about a time you had to work with incomplete information.",
  "Give an example of how you handle ethical dilemmas.",
  "Tell me about a time you had to rebuild trust.",
  "Describe a situation where you had to say no.",
  "Give an example of how you handle virtual collaboration.",
  "Tell me about a time you had to pivot quickly.",
  "Describe a situation where you had to manage expectations.",
  "Give an example of how you handle cultural differences.",
  "Tell me about a time you had to recover from setbacks."
];

const INTRODUCTION_TEMPLATES = [
  "Hi [Name]! Welcome, it's great to meet you. I've reviewed your resume and I'm impressed with your background. Before we dive into the technical questions, I'd love to hear a bit about yourself and your experience.",
  "Hello [Name]! Thanks for joining me today. I've had a chance to look through your resume and it looks really impressive. To get started, could you tell me a little about your professional journey and what brings you here?",
  "Hi [Name]! Great to connect with you. Your background looks really interesting based on your resume. I'd love to hear your story first - could you introduce yourself and share what you're most passionate about in your work?",
  "Welcome [Name]! It's a pleasure to meet you. I've reviewed your experience and I'm excited to learn more about you. To kick things off, could you tell me about your professional background and what you enjoy most about your field?",
  "Hi there [Name]! Thanks for taking the time to interview with me. Your resume shows some really impressive work. Before we get into the technical details, I'd love to hear about your journey and what motivates you in your career."
];

async function generateInterviewStructure(config) {
  const system = new SystemMessage(
    `JSON only. You must respond with valid JSON containing exactly two keys: "introduction" and "questions". 
    The introduction should be warm, welcoming, and human-like. Ask the candidate to introduce themselves.
    Generate specific technical questions based on resume and job description. No generic questions like "tell me about yourself" in the questions array.
    
    IMPORTANT: Make questions feel personalized by referencing specific resume content:
    - Instead of "Tell me about your experience", say "I see you worked at [Company] on your resume. Can you tell me more about your role there?"
    - Instead of "What projects did you work on", say "Your resume mentions [Project]. What was your biggest challenge with that project?"
    - Instead of "What skills do you have", say "You listed [Skill] on your resume. How did you use that in your last project?"
    - Use variations like: "As you mentioned in your resume...", "I noticed on your CV...", "Based on your experience with...", "You mentioned working with..."
    - For follow-ups: "How did you improve that?", "What was the outcome?", "Did you face any challenges with that?"
    
    Use the provided introduction template exactly as given, just replace [Name] with the candidate name.`,
  );

  const resumeSummary = config?.resumeText || "No resume";
  const jdSummary = config?.jdText || "No job description";
  const candidateName = config?.candidateName || "Candidate";
  const domain = config?.domain || "software";
  const questionCount = config?.durationMinutes === 10 ? 5 : config?.durationMinutes === 20 ? 7 : 8;

  const maxChars = 18000;
  const combinedText = `${resumeSummary} ${jdSummary}`;
  
  let finalResumeText = resumeSummary;
  let finalJdText = jdSummary;
  
  if (combinedText.length > maxChars) {
    const RESUME_RATIO = resumeSummary.length / combinedText.length;
    const JD_RATIO = jdSummary.length / combinedText.length;
    
    // Truncate both proportionally to maintain balance
    finalResumeText = resumeSummary.slice(0, Math.floor(maxChars * RESUME_RATIO));
    finalJdText = jdSummary.slice(0, Math.floor(maxChars * JD_RATIO));
  }

  const behavioralCount =
    config?.durationMinutes === 10
      ? 1
      : config?.durationMinutes === 20
        ? 1
        : 2;
  const shuffledBehavioral = [...BEHAVIORAL_QUESTIONS].sort(
    () => Math.random() - 0.5,
  );
  const selectedBehavioral = shuffledBehavioral.slice(0, behavioralCount);
  
  const randomIntro = INTRODUCTION_TEMPLATES[Math.floor(Math.random() * INTRODUCTION_TEMPLATES.length)];
  const personalizedIntro = randomIntro.replace(/\[Name\]/g, candidateName);
  
  const human = new HumanMessage(
    `${domain} ${config?.yoe || "unknown"} ${config?.durationMinutes || 15}min
${candidateName}
Resume: ${finalResumeText}
JD: ${finalJdText}

CRITICAL: You must respond with valid JSON exactly in this format:
{"introduction":"${personalizedIntro}","questions":[{"id":"q1","prompt":"Describe a specific ${domain} project you worked on and the technical challenges you faced.","competency":"technical","type":"main","followUps":[{"id":"q1_f1","prompt":"How did you approach solving those challenges?"}]}]}

Use this exact introduction: "${personalizedIntro}"

REMEMBER: Make questions feel personalized by referencing specific resume content:
- Use phrases like "I see on your resume...", "You mentioned...", "Based on your experience with..."
- Reference actual companies, projects, skills, and achievements from the resume
- Ask follow-ups like "How did you improve that?", "What was the outcome?", "What challenges did you face?"
- Vary your approach - don't use the same template repeatedly

Generate ${questionCount - 3} specific technical questions about ${domain} skills and projects. I will add 3 behavioral questions separately. The introduction must come first and ask for self-introduction.

Behavioral questions to include:
${selectedBehavioral.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
  );

  try {
    const response = await getLLM().invoke([system, human]);
    const text = response?.content?.trim() || "";
    const clean = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(clean);

    const flatQuestions = [];
    parsed?.questions?.forEach((q) => {
      flatQuestions?.push({
        id: q?.id,
        prompt: q?.prompt,
        competency: q?.competency,
        type: "main",
      });
      q?.followUps?.forEach((f) => {
        flatQuestions?.push({
          id: f?.id,
          prompt: f?.prompt,
          competency: q?.competency,
          type: "followup",
          parentQuestion: q?.prompt,
        });
      });
    });

    const behavioralQuestions = selectedBehavioral.map((q, i) => ({
      id: `b${i + 1}`,
      prompt: q,
      competency: "behavioral",
      type: "main",
    }));

    return {
      introduction: parsed?.introduction,
      questions: [...flatQuestions, ...behavioralQuestions],
    };
  } catch (error) {
    console.error("Structure generation error:", error);
    throw new Error("Failed to generate interview structure");
  }
}

async function evaluateAnswer(question, answer, conversationHistory) {
  const system = new SystemMessage(
    `JSON only. Evaluate answer quality and provide feedback.

Return JSON with keys:
- score (1-5)
- feedback (array of short strings)
- needsFollowUp (boolean)
- followUpQuestion (string, optional)
- needsElaboration (boolean, optional)
- isRelevant (boolean, required)

Rules for scoring:
- 1: No answer, completely irrelevant, or single words like "great", "alright", "ok"
- 2: Very short answer (<10 words) or vague without technical details
- 3: Adequate answer with some details but lacks depth
- 4: Good answer with solid technical details and examples
- 5: Excellent answer with comprehensive details, examples, and insights

Rules for isRelevant:
- Set to false if answer is completely unrelated to the question
- Set to false if answer is generic filler like "I don't know", "no idea", "not sure", "skip", "pass"
- Set to false if answer talks about completely different topic
- Set to true only if answer attempts to address the question

Rules for needsElaboration:
- Set to true if answer is too short (<15 words) for a technical question
- Set to true if answer is vague (e.g., "great", "alright", "ok", "fine", "good")
- Set to true if answer lacks expected technical depth
- Set to true if answer doesn't address the core of the question

If isRelevant is false, provide followUpQuestion asking user to stay on topic and answer the actual question.

If needsElaboration is true, provide followUpQuestion asking for more details.

Rules for followUpQuestion:
- Only ask if needsElaboration is true or isRelevant is false
- The follow-up MUST be specific to the question/answer content
- Do NOT ask generic questions like "How do you overcome challenges?"
- Keep it one sentence.`,
  );

  const context =
    conversationHistory
      ?.slice(-1)
      ?.map(
        (t) =>
          `Q:${t?.prompt || t?.question || "N/A"}\nA:${t?.answer || "N/A"}`,
      )
      ?.join("\n") || "";

  const human = new HumanMessage(
    `Q:${question || "N/A"}
A:${answer || "N/A"}
C:${context}

{"score":3,"feedback":["Good answer"],"needsFollowUp":false,"needsElaboration":false,"isRelevant":true}`,
  );

  try {
    const response = await getLLM().invoke([system, human]);
    const text = response?.content?.trim() || "";
    const clean = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(clean);
    const followUp = String(parsed?.followUpQuestion || "").trim();
    const genericFollowUpPattern =
      /(overcome|tackle|handle)\s+(hurdles|challenges|difficulties)|how\s+did\s+you\s+(overcome|tackle|handle)/i;

    if (parsed?.isRelevant === false && followUp) {
      return {
        ...parsed,
        needsFollowUp: true,
        followUpQuestion: followUp,
      };
    }

    if (parsed?.needsElaboration && followUp) {
      return {
        ...parsed,
        needsFollowUp: true,
        followUpQuestion: followUp,
      };
    }

    if (parsed?.needsFollowUp && followUp && genericFollowUpPattern.test(followUp)) {
      return {
        ...parsed,
        needsFollowUp: false,
        followUpQuestion: "",
      };
    }

    return parsed;
  } catch (error) {
    console.error("Evaluation error:", error);
    throw new Error("Failed to evaluate answer");
  }
}

async function handleUserResponse(input, currentQuestion, yoe, context) {
  const getExperienceGuidance = (yoe) => {
    if (yoe === "Fresher") return "patient and encouraging";
    if (yoe === "1 year") return "encouraging";
    if (yoe === "2 years") return "balanced";
    if (yoe === "3 years") return "professional";
    if (yoe === "5 years") return "direct but respectful";
    if (yoe === "10+ years") return "concise and professional";
    return "balanced";
  };

  const guidance = getExperienceGuidance(yoe);

  const system = new SystemMessage(
    `You are an empathetic AI interviewer. Analyze user responses and determine intent. Respond with valid JSON.
    
    Possible intents:
    - "answer": User is answering the question
    - "thinking": User needs time to think (includes "hmm", "let me think", "that's a good question")
    - "clarify": User wants clarification ("can you explain", "what do you mean")
    - "repeat": User wants question repeated ("repeat", "again", "pardon")
    - "ready": User is ready to proceed ("okay", "alright", "ready", "sure")
    - "timeout": Handle timeout situations
    - "offer_options": Offer to repeat or skip question
    - "give_more_time": Give user more thinking time
    - "empty": No meaningful response
    
    CRITICAL: You MUST use these exact response templates. Do NOT generate generic responses like "great", "alright", "thanks".
    
    For detailed, satisfactory answers, choose ONE of these:
    - "Hmm, okay, that sounds great."
    - "You know, thanks, that makes sense."
    - "Well, got it, that's helpful."
    - "Right, good, I understand now."
    - "Actually, perfect, that clarifies it."
    
    For encouragement, choose ONE of these:
    - "Hey, great example, thanks."
    - "Good point, keep going."
    - "Right, thanks for sharing that."
    - "Yeah, that's helpful, thanks."
    
    For empathy, choose ONE of these:
    - "Look, take your time."
    - "No rush at all."
    - "Well, complex topic - go step by step."
    - "Right, that makes sense."
    
    For curiosity, choose ONE of these:
    - "Whoa, really? Tell me more."
    - "Interesting! What happened?"
    - "Fascinating! How so?"
    - "Wow! What was challenging?"
    
    For nervousness, choose ONE of these:
    - "No pressure - take your time."
    - "Hey, it's okay - I'm here to help."
    - "Don't worry - just your thoughts."
    
    For irrelevant answers, choose ONE of these:
    - "Look, I get it, but let's focus on the question I asked."
    - "That's interesting, but could you answer my specific question?"
    - "Hey, I appreciate that, but let's stay on topic please."
    - "Well, let me rephrase - I'm asking about [topic]."
    
    For vague answers needing elaboration, choose ONE of these:
    - "Could you provide more specific details?"
    - "That's helpful, but can you elaborate more?"
    - "I need more detail to understand your experience."
    - "Hey, can you share a specific example?"
    
    NEVER use single words like "Great", "Alright", "OK", "Good" as responses. Always use full sentences from the templates above.`,
  );

  const human = new HumanMessage(
    `Q:${currentQuestion || "N/A"}
U:"${input || "N/A"}"
YOE:${yoe || "unknown"}(${guidance})
C:${context}

Respond with JSON like: 
{"intent":"thinking","response":"Take your time.","extraTime":20}
or {"intent":"clarify","response":"Well, let me rephrase that."}
or {"intent":"offer_options","response":"Repeat or skip?"}
or {"intent":"answer","response":"Hmm, okay, that sounds great.","shouldProceed":true}
or {"intent":"thinking","response":"No pressure - take your time.","extraTime":15}`,
  );

  try {
    const response = await getLLM().invoke([system, human]);
    const text = response?.content?.trim() || "";
    const clean = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error("Response handling error:", error);
    throw new Error("Failed to handle user response");
  }
}

async function generateFinalReport(transcript, config) {
  const calculateFallbackScore = (transcript) => {
    if (!transcript || transcript.length === 0) return 2.5;
    
    const scores = transcript
      .map(t => t?.evaluation?.score)
      .filter(s => s && typeof s === 'number');
    
    if (scores.length === 0) return 2.5;
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  const system = new SystemMessage(
    `JSON only. Generate interview evaluation report based on actual performance.

Calculate overallScore by averaging all individual question scores from the transcript.
If no scores are available in transcript, analyze answer quality and assign appropriate score.

Return JSON with:
- overallScore (1-5, calculated from actual performance)
- strengths (array of specific strengths demonstrated)
- improvements (array of specific areas to improve)`,
  );

  const conversation = transcript
    ?.map(
      (t) =>
        `Q:${t?.prompt || t?.question || "N/A"}\nA:${t?.answer || "N/A"}`,
    )
    ?.join("\n") || "";

  const human = new HumanMessage(
    `${config?.candidateName || "Candidate"} ${config?.domain || "software"} ${config?.yoe || "unknown"}
${conversation}

Generate performance-based evaluation.`,
  );

  try {
    const response = await getLLM().invoke([system, human]);
    const text = response?.content?.trim() || "";
    const clean = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(clean);

    return {
      overallScore:
        parsed?.overallScore ?? parsed?.interviewEvaluation?.overallScore ?? calculateFallbackScore(transcript),
      strengths: parsed?.strengths?.length
        ? parsed?.strengths
        : ["Completed the interview"],
      improvements: parsed?.improvements?.length
        ? parsed?.improvements
        : ["Continue practicing"],
      competencyScores: parsed?.competencyScores || {},
    };
  } catch (error) {
    console.error("Report generation error:", error);
    const fallbackScore = calculateFallbackScore(transcript);
    return {
      overallScore: fallbackScore,
      strengths: ["Completed interview"],
      improvements: ["Continue practicing"],
      competencyScores: {},
    };
  }
}

export { generateInterviewStructure, evaluateAnswer, handleUserResponse, generateFinalReport };
