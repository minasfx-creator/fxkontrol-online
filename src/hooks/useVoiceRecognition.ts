/**
 * useVoiceRecognition — Web Speech API hook for voice commands (STT)
 * Alexa-style: starts listening, transcribes in real-time, auto-submits after silence.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type VoiceState = 'idle' | 'listening' | 'processing';

export function useVoiceRecognition(opts: {
  onTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  autoSubmitDelay?: number;
  lang?: string;
}) {
  const { onTranscript, onFinalTranscript, autoSubmitDelay = 1500, lang = 'pt-BR' } = opts;
  const [state, setState] = useState<VoiceState>('idle');
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTextRef = useRef('');

  // Stable refs for callbacks and state to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState('idle');
  }, []);

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    stopListening();
    finalTextRef.current = '';

    const recognition = new SpeechRec();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState('listening');

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }

      const current = (final + interim).trim();
      onTranscriptRef.current(current);

      if (final) {
        finalTextRef.current = final.trim();
        if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
        autoSubmitTimer.current = setTimeout(() => {
          if (finalTextRef.current) {
            onFinalTranscriptRef.current(finalTextRef.current);
            finalTextRef.current = ''; // Prevent double-fire
            stopListening();
          }
        }, autoSubmitDelay);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('[VoiceRecognition] error:', e.error);
      }
      setState('idle');
    };

    recognition.onend = () => {
      // If we still have pending text, submit it
      if (finalTextRef.current && stateRef.current === 'listening') {
        onFinalTranscriptRef.current(finalTextRef.current);
        finalTextRef.current = ''; // Prevent double-fire
      }
      setState('idle');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, autoSubmitDelay, stopListening]);

  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    };
  }, []);

  return { state, supported, toggle, startListening, stopListening };
}
