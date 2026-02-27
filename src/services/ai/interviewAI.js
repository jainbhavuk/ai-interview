import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLLM } from "./llmConfig";

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
  "Describe a situation where you had to challenge assumptions.",
  "Give an example of how you handle team dynamics.",
  "Tell me about a time you had to deliver bad news.",
  "Describe a situation where you had to be resourceful.",
  "Give an example of how you handle ethical dilemmas.",
  "Tell me about a time you had to rebuild trust.",
  "Describe a situation where you had to say no.",
  "Give an example of how you handle virtual collaboration.",
  "Tell me about a time you had to pivot quickly.",
  "Describe a situation where you had to manage expectations.",
  "Give an example of how you handle cultural differences.",
  "Tell me about a time you had to recover from setbacks."
];

export async function generateInterviewStructure(config) {
  const system = new SystemMessage(
    `JSON only. You must respond with valid JSON containing exactly two keys: "introduction" and "questions". 
    The introduction should be warm, welcoming, and human-like. Ask the candidate to introduce themselves.
    Generate specific technical questions based on resume and job description. No generic questions like "tell me about yourself" in the questions array.
    
    Make the introduction conversational and friendly, like:
    "Hi [Name]! Welcome, it's great to meet you. How's your day going so far? Before we dive into the technical questions, I'd love to hear a bit about yourself - your background, experience, and what brings you here today."`,
  );

  const resumeSummary = config?.resumeText || "No resume";
  const jdSummary = config?.jdText || "No job description";
  
  // Ensure combined text doesn't exceed token limit (roughly 4 chars per token)
  const maxChars = 18000; // ~4500 tokens for prompt + response
  const combinedText = `${resumeSummary} ${jdSummary}`;
  
  let finalResumeText = resumeSummary;
  let finalJdText = jdSummary;
  
  if (combinedText.length > maxChars) {
    // Proportionally truncate both to fit within limit
    const resumeRatio = resumeSummary.length / combinedText.length;
    const jdRatio = jdSummary.length / combinedText.length;
    
    finalResumeText = resumeSummary.slice(0, Math.floor(maxChars * resumeRatio));
    finalJdText = jdSummary.slice(0, Math.floor(maxChars * jdRatio));
  }
  const questionCount =
    config?.durationMinutes === 10
      ? 5
      : config?.durationMinutes === 20
        ? 8
        : 10;
  const candidateName = config?.candidateName || "Candidate";
  const domain = config?.domain || "software";

  // Select 3 random behavioral questions
  const shuffledBehavioral = [...BEHAVIORAL_QUESTIONS].sort(() => Math.random() - 0.5);
  const selectedBehavioral = shuffledBehavioral.slice(0, 3);
  
  const human = new HumanMessage(
    `${domain} ${config?.yoe || "unknown"} ${config?.durationMinutes || 15}min
${candidateName}
Resume: ${finalResumeText}
JD: ${finalJdText}

CRITICAL: You must respond with valid JSON exactly in this format:
{"introduction":"Hi ${candidateName}, welcome! Please introduce yourself and tell me a bit about your experience and background.","questions":[{"id":"q1","prompt":"Describe a specific ${domain} project you worked on and the technical challenges you faced.","competency":"technical","type":"main","followUps":[{"id":"q1_f1","prompt":"How did you approach solving those challenges?"}]}]}

Generate ${questionCount - 3} specific technical questions about ${domain} skills and projects. I will add 3 behavioral questions separately. The introduction must come first and ask for self-introduction.

Behavioral questions to include:
${selectedBehavioral.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
  );

  try {
    const response = await getLLM().invoke([system, human]);
    const text = response?.content?.trim() || "";
    const clean = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(clean);
    
    // Ensure introduction always exists
    if (!parsed.introduction) {
      parsed.introduction = `Hi ${candidateName}! Welcome, it's great to meet you. How's your day going so far? Before we dive into the technical questions, I'd love to hear a bit about yourself - your background, experience, and what brings you here today.`;
    }
    
    // Add behavioral questions to the mix
    if (parsed.questions && Array.isArray(parsed.questions)) {
      // Insert behavioral questions at random positions
      const technicalQuestions = parsed.questions;
      const allQuestions = [];
      
      // Distribute behavioral questions throughout the interview
      const behavioralPositions = [];
      const totalQuestions = technicalQuestions.length + 3;
      
      // Generate 3 random positions (avoid first and last positions)
      while (behavioralPositions.length < 3) {
        const pos = Math.floor(Math.random() * (totalQuestions - 2)) + 1; // Positions 1 to total-2
        if (!behavioralPositions.includes(pos)) {
          behavioralPositions.push(pos);
        }
      }
      
      behavioralPositions.sort((a, b) => a - b);
      
      let techIndex = 0;
      let behavioralIndex = 0;
      
      for (let i = 0; i < totalQuestions; i++) {
        if (behavioralPositions.includes(i) && behavioralIndex < 3) {
          allQuestions.push({
            id: `behavioral_${behavioralIndex + 1}`,
            prompt: selectedBehavioral[behavioralIndex],
            competency: "behavioral",
            type: "main",
            followUps: []
          });
          behavioralIndex++;
        } else if (techIndex < technicalQuestions.length) {
          allQuestions.push(technicalQuestions[techIndex]);
          techIndex++;
        }
      }
      
      parsed.questions = allQuestions;
    }
    
    return parsed;
  } catch (error) {
    console.error("Interview generation error:", error);
    return {
      introduction: `Hi ${candidateName}! Welcome, it's great to meet you. How's your day going so far? Before we dive into the technical questions, I'd love to hear a bit about yourself - your background, experience, and what brings you here today.`,
      questions: [
        {
          id: "fallback1",
          prompt: `Describe a specific ${domain} project you're proud of and explain your role in it.`,
          competency: "experience",
          type: "main",
          followUps: [],
        },
        {
          id: "fallback2",
          prompt: `What technical challenges have you faced in ${domain} development?`,
          competency: "problem-solving",
          type: "main",
          followUps: [],
        },
        // Add 1 behavioral question as fallback
        {
          id: "fallback_behavioral",
          prompt: BEHAVIORAL_QUESTIONS[Math.floor(Math.random() * BEHAVIORAL_QUESTIONS.length)],
          competency: "behavioral",
          type: "main",
          followUps: [],
        },
      ],
    };
  }
}

export async function evaluateAnswer(question, answer, conversationHistory) {
  const system = new SystemMessage(
    `JSON only. Evaluate answer quality and provide feedback.`,
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

{"score":3,"feedback":["Good answer"],"needsFollowUp":false}`,
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
    console.error("Evaluation error:", error);
    return { score: 3, feedback: ["Unable to evaluate"], needsFollowUp: false };
  }
}

export async function handleUserResponse(
  userInput,
  currentQuestion,
  conversationHistory,
  yoe,
) {
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
    
    Provide appropriate, empathetic responses for each intent. Use natural, human-like language:
    - For encouragement: "Great example!", "That's exactly what I'm looking for", "I appreciate your honesty"
    - For empathy: "That sounds challenging", "Take your time, no rush", "I can see how that would be tough"
    - For curiosity: "Really? Tell me more about that", "Wow, I didn't expect that!", "That's fascinating"
    - For agreement: "I totally get that, same here", "That makes complete sense"
    - For appreciation: "Thanks for sharing that", "That gives me great insight"
    - For nervousness: "No pressure, think it through", "It's okay to take your time"`,
  );

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
  const context =
    conversationHistory
      ?.slice(-2)
      ?.map(
        (t) =>
          `Q:${t?.prompt || t?.question || "N/A"}\nA:${t?.answer || "N/A"}`,
      )
      ?.join("\n") || "";

  const human = new HumanMessage(
    `Q:${currentQuestion || "N/A"}
U:"${userInput || "N/A"}"
YOE:${yoe || "unknown"}(${guidance})
C:${context}

Respond with JSON like: 
{"intent":"thinking","response":"Take your time. I'll wait while you think about your answer.","extraTime":20}
or {"intent":"clarify","response":"Let me rephrase that for you. What I mean is..."}
or {"intent":"offer_options","response":"Would you like me to repeat the question, or would you prefer to skip this one and continue?"}
or {"intent":"answer","response":"That's a great example! Thanks for sharing that.","shouldProceed":true}
or {"intent":"thinking","response":"No pressure, think it through. I'm here when you're ready.","extraTime":15}`,
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
    console.error("User response handling error:", error);
    return {
      intent: "answer",
      response: "",
      shouldProceed: true,
      extraTime: 0,
    };
  }
}

export async function generateFinalReport(transcript, config) {
  const system = new SystemMessage(
    `JSON only. Generate interview evaluation report.`,
  );

  const conversation =
    transcript
      ?.map(
        (t) =>
          `Q:${t?.prompt || "N/A"}\nA:${t?.answer || "N/A"}\nS:${t?.evaluation?.score || 3}`,
      )
      ?.join("\n") || "";

  const human = new HumanMessage(
    `${config?.candidateName || "Candidate"} ${config?.domain || "software"} ${config?.yoe || "unknown"}
${conversation}

{"overallScore":3,"strengths":[],"improvements":[],"competencyScores":{},"recommendation":"consider","summary":"Interview completed"}`,
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
    console.error("Report generation error:", error);
    return {
      overallScore: 3,
      strengths: ["Completed interview"],
      improvements: ["Continue practicing"],
      competencyScores: {},
      recommendation: "consider",
      summary: "Interview completed successfully",
    };
  }
}
