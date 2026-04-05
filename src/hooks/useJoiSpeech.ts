/**
 * useJoiSpeech — Text-to-Speech hook using native SpeechSynthesis API
 * Selects best PT-BR female voice, provides speak/stop controls.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const VOICE_PREF_KEY = 'joi-voice-enabled';

function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  // Prefer pt-BR female voices
  const ptBrFemale = voices.filter(v => v.lang.startsWith('pt') && /female|feminino/i.test(v.name));
  if (ptBrFemale.length) return ptBrFemale[0];
  // Any pt-BR
  const ptBr = voices.filter(v => v.lang.startsWith('pt-BR'));
  if (ptBr.length) return ptBr[0];
  // Any pt
  const pt = voices.filter(v => v.lang.startsWith('pt'));
  if (pt.length) return pt[0];
  // Fallback to first available
  return voices[0] || null;
}

export function useJoiSpeech() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(VOICE_PREF_KEY) === 'true'; } catch { return false; }
  });
  const [speaking, setSpeaking] = useState(false);
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    try { localStorage.setItem(VOICE_PREF_KEY, String(enabled)); } catch {}
  }, [enabled]);

  // Load voices (they load async in some browsers)
  useEffect(() => {
    if (!supported) return;
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !enabled) return;
    // Strip markdown formatting for cleaner speech
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\|/g, ', ')
      .replace(/---+/g, '')
      .replace(/\[KMZ_READY\][\s\S]*?\[\/KMZ_READY\]/g, '')
      .trim();

    if (!clean) return;

    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    const voice = getBestVoice();
    if (voice) utt.voice = voice;
    utt.lang = 'pt-BR';
    utt.rate = 1.05;
    utt.pitch = 1.1;
    utt.volume = 0.85;

    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);

    utteranceRef.current = utt;
    speechSynthesis.speak(utt);
  }, [supported, enabled]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (!next) stop();
  }, [enabled, stop]);

  const speakSingle = useCallback((text: string) => {
    if (!supported) return;
    speechSynthesis.cancel();
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[KMZ_READY\][\s\S]*?\[\/KMZ_READY\]/g, '')
      .trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    const voice = getBestVoice();
    if (voice) utt.voice = voice;
    utt.lang = 'pt-BR';
    utt.rate = 1.05;
    utt.pitch = 1.1;
    utt.volume = 0.85;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    speechSynthesis.speak(utt);
  }, [supported]);

  return { enabled, speaking, supported, toggle, speak, stop, speakSingle };
}
