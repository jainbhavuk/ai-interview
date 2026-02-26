export const INTERVIEW_TEMPLATES = [
  {
    id: "frontend",
    label: "Frontend Engineer",
    description:
      "React-heavy product interviews with architecture and UI trade-offs.",
  },
  {
    id: "dsa",
    label: "DSA / Problem Solving",
    description: "Algorithmic thinking, complexity analysis, and optimization.",
  },
  {
    id: "behavioral",
    label: "Behavioral",
    description: "Communication, ownership, and collaboration stories.",
  },
];

export const BASE_QUESTION_BANK = {
  frontend: [
    {
      prompt:
        "Tell me about a React feature you built end-to-end and what technical decisions mattered most.",
      competency: "technical",
    },
    {
      prompt:
        "How do you approach state management in a medium-to-large frontend application?",
      competency: "technical",
    },
    {
      prompt:
        "Describe a performance issue you found in the UI and how you diagnosed and fixed it.",
      competency: "problem-solving",
    },
    {
      prompt:
        "How do you ensure accessibility and responsive behavior while shipping quickly?",
      competency: "quality",
    },
  ],
  dsa: [
    {
      prompt:
        "Walk me through a problem where you started with a brute-force solution and optimized it.",
      competency: "problem-solving",
    },
    {
      prompt:
        "How do you decide between a hash map, heap, and sorting strategy in interview problems?",
      competency: "technical",
    },
    {
      prompt:
        "When discussing complexity, how do you communicate trade-offs clearly to an interviewer?",
      competency: "communication",
    },
    {
      prompt:
        "Tell me about a time your first algorithm idea failed and what you changed.",
      competency: "adaptability",
    },
  ],
  behavioral: [
    {
      prompt:
        "Tell me about a high-stakes conflict in your team and how you resolved it.",
      competency: "collaboration",
    },
    {
      prompt:
        "Describe a situation where you took ownership without being asked by your manager.",
      competency: "ownership",
    },
    {
      prompt:
        "Share an example of receiving difficult feedback and what you changed afterward.",
      competency: "self-awareness",
    },
    {
      prompt:
        "How do you prioritize when deadlines, product pressure, and technical debt all collide?",
      competency: "judgment",
    },
  ],
};

export const SKILL_KEYWORDS = [
  "react",
  "javascript",
  "typescript",
  "node",
  "express",
  "next.js",
  "redux",
  "css",
  "html",
  "tailwind",
  "graphql",
  "rest",
  "sql",
  "postgres",
  "mongodb",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "testing",
  "jest",
  "cypress",
  "microservices",
];

export const REQUIRED_MARKERS = [
  "must",
  "required",
  "strong",
  "need",
  "minimum",
];

export const NICE_TO_HAVE_MARKERS = [
  "preferred",
  "plus",
  "good to have",
  "nice to have",
];
