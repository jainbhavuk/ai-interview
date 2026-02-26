import { useEffect, useMemo, useRef, useState } from 'react'

const PREFERRED_VOICE_HINTS = [
  'google us english',
  'microsoft aria',
  'microsoft guy',
  'microsoft jenny',
  'english united states',
  'samantha',
]

function scoreVoice(voice) {
  const name = String(voice?.name || '').toLowerCase()
  const lang = String(voice?.lang || '').toLowerCase()
  let score = 0

  if (lang.startsWith('en-us')) score += 5
  else if (lang.startsWith('en')) score += 3

  PREFERRED_VOICE_HINTS.forEach((hint, index) => {
    if (name.includes(hint)) {
      score += 10 - index
    }
  })

  if (voice?.localService) score += 1
  return score
}

function selectBestVoice(voices) {
  if (!voices.length) {
    return null
  }

  return voices
    .slice()
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
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
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState('')
  const [voices, setVoices] = useState([])
  const utteranceRef = useRef(null)

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)
  }, [])

  useEffect(() => {
    if (!isSupported) {
      return undefined
    }

    const syncVoices = () => {
      const nextVoices = window.speechSynthesis.getVoices()
      setVoices(nextVoices)
    }

    syncVoices()
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncVoices)
    }
  }, [isSupported])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      utteranceRef.current = null
    }
  }, [])

  const preferredVoice = useMemo(() => selectBestVoice(voices), [voices])

  function cancel() {
    if (!isSupported) {
      return
    }

    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  function speak(text, options = {}) {
    if (!isSupported) {
      return false
    }

    const cleanText = String(text || '').trim()
    if (!cleanText) {
      return false
    }

    cancel()
    setError('')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.voice = options.voice || preferredVoice || null
    utterance.lang = options.lang || utterance.voice?.lang || 'en-US'
    utterance.rate = options.rate || 0.96
    utterance.pitch = options.pitch || 0.95
    utterance.volume = options.volume || 1

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      if (typeof options.onEnd === 'function') {
        options.onEnd()
      }
    }

    utterance.onerror = (event) => {
      setError(event.error || 'Speech synthesis failed.')
      setIsSpeaking(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    return true
  }

  return {
    isSupported,
    isSpeaking,
    error,
    speak,
    cancel,
  }
}
