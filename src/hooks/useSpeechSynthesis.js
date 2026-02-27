import { useEffect, useMemo, useRef, useState } from "react";

const PREFERRED_VOICE_HINTS = [
  'english united states male',
  'alex',
  'daniel',
  'microsoft david',
  'microsoft mark',
  'google us english male',
  'english india male',
  'indian english male',
  'microsoft ravi',
  'microsoft heera',
];

function scoreVoice(voice) {
  const name = String(voice?.name || "").toLowerCase();
  const lang = String(voice?.lang || "").toLowerCase();
  let score = 0;

  if (lang.startsWith("en-us")) score += 10;
  else if (lang.startsWith("en-in")) score += 9;
  else if (lang.startsWith("en-gb")) score += 4;
  else if (lang.startsWith("en-au")) score += 3;
  else if (lang.startsWith("en")) score += 1;

  PREFERRED_VOICE_HINTS.forEach((hint, index) => {
    if (name.includes(hint)) {
      score += 10 - index;
    }
  });

  if (voice?.localService) score += 1;
  return score;
}

function selectBestVoice(voices) {
  if (!voices?.length) {
    return null;
  }

  // First try to find US English male voices
  const usVoices = voices.filter(voice => {
    const name = String(voice?.name || "").toLowerCase();
    const lang = String(voice?.lang || "").toLowerCase();
    const preferredHints = ['english united states male', 'alex', 'daniel', 'microsoft david', 'microsoft mark', 'google us english male'];
    return lang.startsWith("en-us") && preferredHints.some(hint => name.includes(hint));
  });

  if (usVoices?.length) {
    return usVoices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  // Then try to find Indian English male voices
  const indianVoices = voices.filter(voice => {
    const name = String(voice?.name || "").toLowerCase();
    const lang = String(voice?.lang || "").toLowerCase();
    const indianHints = ['english india male', 'indian english male', 'microsoft ravi', 'microsoft heera'];
    return lang.startsWith("en-in") && indianHints.some(hint => name.includes(hint));
  });

  if (indianVoices?.length) {
    return indianVoices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  // If no preferred voices, fall back to any male voice
  const maleVoices = voices.filter(voice => {
    const name = String(voice?.name || "").toLowerCase();
    const maleVoiceHints = ['microsoft david', 'microsoft mark', 'google us english male', 'alex', 'daniel', 'microsoft ravi', 'microsoft heera'];
    return maleVoiceHints.some(hint => name.includes(hint));
  });

  if (maleVoices?.length) {
    return maleVoices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  // Last resort: return the highest scored voice
  return voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

/**
 * Browser speech synthesis wrapper for interviewer voice output.
 * @returns {{
 * isSupported: boolean,
 * isSpeaking: boolean,
 * error: string,
 * speak: (text: string, options?: {rate?: number, pitch?: number, volume?: number, onEnd?: () => void}) => boolean,
 * cancel: () => void
 * }}
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window?.speechSynthesis && window?.SpeechSynthesisUtterance);
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    const syncVoices = () => {
      const nextVoices = window?.speechSynthesis?.getVoices() || [];
      setVoices(nextVoices);
    };

    syncVoices();
    window?.speechSynthesis?.addEventListener("voiceschanged", syncVoices);

    return () => {
      window?.speechSynthesis?.removeEventListener("voiceschanged", syncVoices);
    };
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window?.speechSynthesis) {
        window?.speechSynthesis?.cancel();
      }
      utteranceRef.current = null;
    };
  }, []);

  const preferredVoice = useMemo(() => selectBestVoice(voices), [voices]);

  function cancel() {
    if (!isSupported) {
      return;
    }

    window?.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  function speak(text, options = {}) {
    if (!isSupported) {
      return false;
    }

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return false;
    }

    cancel();
    setError("");

    // Add natural pauses and human-like speech patterns
    const processedText = addHumanLikePauses(cleanText);
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.voice = options.voice || preferredVoice || null;
    utterance.lang = options.lang || utterance.voice?.lang || "en-US";
    
    // Vary speech parameters for more natural delivery
    utterance.rate = options.rate || getRandomInRange(0.85, 1.0);
    utterance.pitch = options.pitch || getRandomInRange(0.8, 1.1);
    utterance.volume = options.volume || 1;
    
    // Add pauses between sentences
    utterance.pauseDuration = 200; // 200ms pause between sentences

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (typeof options.onEnd === "function") {
        options.onEnd();
      }
    };

    utterance.onerror = () => {
      // Don't show speech synthesis errors to user
      setError("");
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window?.speechSynthesis?.speak(utterance);
    return true;
  }

  // Add human-like pauses and emphasis
  function addHumanLikePauses(text) {
    return text
      // Add pauses after commas
      .replace(/,/g, ',...')
      // Add longer pauses after periods
      .replace(/\.\s+/g, '.... ')
      // Add pauses before important words
      .replace(/\b(important|crucial|key|critical|significant)\b/gi, '...$1')
      // Add emphasis for questions
      .replace(/\?$/, '?...')
      // Add natural thinking pauses
      .replace(/\b(when|where|how|what|why|describe|explain)\b/gi, '$1...');
  }

  // Generate random number in range for voice variation
  function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  return {
    isSupported,
    isSpeaking,
    error,
    speak,
    cancel,
  };
}
