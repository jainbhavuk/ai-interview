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
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);
  const ON_END_CALLBACK_REF = useRef(null);
  const IS_PROCESSING_REF = useRef(false);

  const isSupportedMemo = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window?.speechSynthesis && window?.SpeechSynthesisUtterance);
  }, []);

  useEffect(() => {
    setIsSupported(isSupportedMemo);
  }, [isSupportedMemo]);

  useEffect(() => {
    if (!isSupportedMemo) {
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
  }, [isSupportedMemo]);

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
    IS_PROCESSING_REF.current = false;
    utteranceRef.current = null;
    ON_END_CALLBACK_REF.current = null;
  }

  function speak(text, options = {}) {
    if (!isSupported || IS_PROCESSING_REF.current) {
      return false;
    }

    const cleanText = String(text || "").trim();
    if (!cleanText) {
      return false;
    }

    // Cancel any ongoing speech
    cancel();
    IS_PROCESSING_REF.current = true;
    setError("");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = options.voice || preferredVoice || null;
    utterance.lang = options.lang || utterance.voice?.lang || "en-US";
    
    // Natural speech parameters without artificial pauses
    utterance.rate = options.rate || getRandomInRange(0.9, 1.1);
    utterance.pitch = options.pitch || getRandomInRange(0.85, 1.05);
    utterance.volume = options.volume || 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      IS_PROCESSING_REF.current = false;
      if (typeof options.onEnd === "function") {
        options.onEnd();
      }
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setError("");
      setIsSpeaking(false);
      IS_PROCESSING_REF.current = false;
      // Always call onEnd to prevent getting stuck, even on errors
      if (typeof options.onEnd === "function") {
        options.onEnd();
      }
    };

    utteranceRef.current = utterance;
    ON_END_CALLBACK_REF.current = options.onEnd || null;
    
    try {
      window?.speechSynthesis?.speak(utterance);
      return true;
    } catch (error) {
      console.error("Speech synthesis failed:", error);
      setError("");
      setIsSpeaking(false);
      IS_PROCESSING_REF.current = false;
      if (typeof options.onEnd === "function") {
        options.onEnd();
      }
      return false;
    }
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
