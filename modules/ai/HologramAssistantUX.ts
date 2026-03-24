export type HologramMood = 'CALM' | 'FOCUS' | 'ALERT' | 'CINEMATIC';

export interface HologramTheme {
  core: string;
  aura: string;
  accent: string;
  opacity: number;
  blurPx: number;
}

export interface HologramFrame {
  mood: HologramMood;
  title: string;
  subtitle: string;
  chip: string;
  voiceHint?: string;
  animation: {
    pulseHz: number;
    driftPx: number;
    shimmer: number;
  };
  theme: HologramTheme;
}

const THEMES: Record<HologramMood, HologramTheme> = {
  CALM: { core: '#68D8FF', aura: '#3EC5FF', accent: '#FFB067', opacity: 0.56, blurPx: 12 },
  FOCUS: { core: '#55CCFF', aura: '#26B8FF', accent: '#FFC17A', opacity: 0.6, blurPx: 14 },
  ALERT: { core: '#FF9D62', aura: '#FF7E46', accent: '#FFD08A', opacity: 0.72, blurPx: 10 },
  CINEMATIC: { core: '#6BE0FF', aura: '#2FCBFF', accent: '#FFB86D', opacity: 0.62, blurPx: 16 },
};

export function buildHologramFrame(params: {
  riskDetected: boolean;
  cinematic: boolean;
  signalQuality: number;
  windMps: number;
}): HologramFrame {
  if (params.riskDetected) {
    return {
      mood: 'ALERT',
      title: 'Safety Envelope Active',
      subtitle: 'Input limited to protect the shot and aircraft',
      chip: 'OVERRIDE',
      voiceHint: 'Safety envelope engaged.',
      animation: { pulseHz: 1.25, driftPx: 2, shimmer: 0.85 },
      theme: THEMES.ALERT,
    };
  }

  if (params.cinematic) {
    return {
      mood: 'CINEMATIC',
      title: 'Cinematic Path Locked',
      subtitle: 'Framing bias widened for show impact',
      chip: 'CINE',
      voiceHint: 'Cinematic line stabilized.',
      animation: { pulseHz: 0.68, driftPx: 6, shimmer: 0.72 },
      theme: THEMES.CINEMATIC,
    };
  }

  if (params.windMps > 8 || params.signalQuality < 0.4) {
    return {
      mood: 'FOCUS',
      title: 'Stability Assist Running',
      subtitle: 'Compensating wind and preserving smooth motion',
      chip: 'ASSIST',
      voiceHint: 'Stability assist active.',
      animation: { pulseHz: 0.9, driftPx: 4, shimmer: 0.65 },
      theme: THEMES.FOCUS,
    };
  }

  return {
    mood: 'CALM',
    title: 'System Stable',
    subtitle: 'Telemetry nominal and trajectory clean',
    chip: 'OK',
    voiceHint: 'All systems stable.',
    animation: { pulseHz: 0.58, driftPx: 5, shimmer: 0.52 },
    theme: THEMES.CALM,
  };
}

export function getHologramUXTokens() {
  return {
    card: {
      borderRadius: 18,
      backdropBlur: 18,
      borderAlpha: 0.24,
      shadow: '0 20px 50px rgba(0,0,0,.38)',
    },
    spacing: {
      outer: 16,
      inner: 10,
    },
    motion: {
      microMs: 120,
      uiMs: 240,
      sceneMs: 400,
    },
    typography: {
      titleWeight: 600,
      bodyWeight: 450,
      captionWeight: 500,
    },
  };
}
