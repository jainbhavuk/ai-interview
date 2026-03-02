import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Browser speech recognition wrapper with minimal controls.
 * @returns {{
 * isSupported: boolean,
 * isListening: boolean,
 * finalTranscript: string,
 * interimTranscript: string,
 * error: string,
 * startListening: (options?: {continuous?: boolean, interimResults?: boolean, lang?: string}) => boolean,
 * stopListening: () => void,
 * resetTranscript: () => void
 * }}
 */
export function useSpeechRecognition() {
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const onEndRef = useRef(null);
  const onErrorRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let nextFinalText = "";
      let nextInterimText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || "";

        if (result.isFinal) {
          // Keep filler words for non-native speakers - they're natural thinking sounds
          // Only remove obvious errors, not natural speech patterns
          const cleanTranscript = transcript.replace(/\b(repeated|duplicate|same word)\b/gi, '').trim();
          nextFinalText += `${cleanTranscript} `;
        } else {
          nextInterimText += `${transcript} `;
        }
      }

      if (nextFinalText.trim()) {
        setFinalTranscript((prev) => {
          const next = `${prev} ${nextFinalText}`.trim();
          finalTranscriptRef.current = next;
          return next;
        });
      }

      setInterimTranscript(nextInterimText.trim());
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      if (typeof onEndRef.current === "function") {
        onEndRef.current(finalTranscriptRef.current.trim());
      }
    };

    recognition.onerror = (event) => {
      const errorMessage = event.error || "Speech recognition failed.";
      // Don't set error for common issues that shouldn't show to user
      const suppressedErrors = ['network', 'no-speech', 'aborted', 'service-not-allowed', 'not-allowed'];
      if (suppressedErrors.some(err => errorMessage.toLowerCase().includes(err))) {
        setError("");
      } else {
        setError(errorMessage);
      }
      setIsListening(false);
      if (typeof onErrorRef.current === "function") {
        onErrorRef.current(errorMessage);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
      onEndRef.current = null;
      onErrorRef.current = null;
    };
  }, [isSupported]);

  function startListening(options = {}) {
    if (!recognitionRef.current || isListening) {
      return false;
    }

    recognitionRef.current.continuous = Boolean(options.continuous);
    recognitionRef.current.interimResults = options.interimResults ?? true;
    recognitionRef.current.lang = options.lang || "en-US";
    
    // More patient settings for non-native speakers
    if (options.maxAlternatives) {
      recognitionRef.current.maxAlternatives = options.maxAlternatives;
    }
    
    // Disable strict grammar for more flexible recognition
    if (options.grammars === null) {
      recognitionRef.current.grammars = null;
    }

    onEndRef.current = options.onEnd || null;
    onErrorRef.current = options.onError || null;

    setFinalTranscript("");
    setInterimTranscript("");
    setError("");
    finalTranscriptRef.current = "";

    try {
      recognitionRef.current.start();
      return true;
    } catch (error) {
      console.error("Speech recognition start failed:", error);
      return false;
    }
  }

  function stopListening() {
    if (!recognitionRef.current || !isListening) {
      return;
    }

    recognitionRef.current.stop();
  }

  function resetTranscript() {
    setFinalTranscript("");
    setInterimTranscript("");
    setError("");
    finalTranscriptRef.current = "";
  }

  return {
    isSupported,
    isListening,
    finalTranscript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
