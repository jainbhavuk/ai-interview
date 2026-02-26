import {
  NICE_TO_HAVE_MARKERS,
  REQUIRED_MARKERS,
  SKILL_KEYWORDS,
} from "../constants/interview";

/**
 * Normalizes free-form text for simple rule-based parsing.
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toUniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitLines(rawText) {
  return String(rawText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitSentences(rawText) {
  return String(rawText || "")
    .split(/[.!?\n]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Extracts known skills from text using keyword matching.
 * @param {string} rawText
 * @returns {string[]}
 */
export function extractSkills(rawText) {
  const text = normalizeText(rawText);

  return SKILL_KEYWORDS.filter((skill) => {
    const pattern = new RegExp(
      `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    return pattern.test(text);
  });
}

/**
 * Attempts to identify years of experience from text.
 * @param {string} rawText
 * @returns {number}
 */
export function extractYearsOfExperience(rawText) {
  const text = normalizeText(rawText);
  const directMatch = text.match(/(\d{1,2})\+?\s*(years|yrs)/i);

  if (!directMatch) {
    return 0;
  }

  return Number(directMatch[1]) || 0;
}

/**
 * Extracts project-like lines from resume text.
 * @param {string} rawText
 * @returns {string[]}
 */
export function extractProjects(rawText) {
  const lines = splitLines(rawText);
  const projectMarkers = [
    "project",
    "built",
    "developed",
    "implemented",
    "launched",
  ];

  const projectLines = lines.filter((line) =>
    projectMarkers.some((marker) => line.toLowerCase().includes(marker)),
  );

  return toUniqueList(projectLines).slice(0, 5);
}

function classifyJdSkill(sentence, skill) {
  const normalized = normalizeText(sentence);
  const hasSkill = new RegExp(
    `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  ).test(normalized);

  if (!hasSkill) {
    return null;
  }

  if (REQUIRED_MARKERS.some((marker) => normalized.includes(marker))) {
    return "required";
  }

  if (NICE_TO_HAVE_MARKERS.some((marker) => normalized.includes(marker))) {
    return "niceToHave";
  }

  return "neutral";
}

/**
 * Parses resume text into structured profile data.
 * @param {string} rawText
 * @returns {{skills: string[], yearsExperience: number, projects: string[]}}
 */
export function parseResume(rawText) {
  return {
    skills: extractSkills(rawText),
    yearsExperience: extractYearsOfExperience(rawText),
    projects: extractProjects(rawText),
  };
}

/**
 * Parses JD text into required and optional signals.
 * @param {string} rawText
 * @returns {{requiredSkills: string[], niceToHaveSkills: string[], responsibilities: string[]}}
 */
export function parseJobDescription(rawText) {
  const sentences = splitSentences(rawText);
  const requiredSkills = [];
  const niceToHaveSkills = [];

  sentences.forEach((sentence) => {
    SKILL_KEYWORDS.forEach((skill) => {
      const category = classifyJdSkill(sentence, skill);

      if (category === "required") {
        requiredSkills.push(skill);
      } else if (category === "niceToHave") {
        niceToHaveSkills.push(skill);
      }
    });
  });

  const responsibilities = sentences
    .filter((sentence) =>
      /build|design|deliver|own|improve|lead|collaborate/i.test(sentence),
    )
    .slice(0, 6);

  return {
    requiredSkills: toUniqueList(requiredSkills),
    niceToHaveSkills: toUniqueList(niceToHaveSkills),
    responsibilities: toUniqueList(responsibilities),
  };
}
