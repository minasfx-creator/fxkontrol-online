/**
 * Audio Synesthesia Engine
 * Beat detection, onset detection, and frequency analysis
 * for auto-syncing drone choreography with music.
 *
 * Uses Web Audio API for offline analysis.
 */

export interface Beat {
  time: number;       // seconds
  strength: number;   // 0-1 normalized
}

export interface Onset {
  time: number;
  type: 'kick' | 'snare' | 'hi-hat' | 'transient';
  energy: number;
}

export interface FrequencyBand {
  time: number;
  low: number;    // 20-250 Hz (bass)
  mid: number;    // 250-4000 Hz (vocals, instruments)
  high: number;   // 4000-20000 Hz (cymbals, sibilance)
}

export interface AudioAnalysisResult {
  beats: Beat[];
  onsets: Onset[];
  bpm: number;
  frequencies: FrequencyBand[];
  duration: number;
  peakTimes: number[];   // times of maximum energy
}

/**
 * Analyze an audio buffer for beats, onsets, and frequency content.
 * Performs offline analysis (NRT) for frame-accurate results.
 */
export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AudioAnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // mono analysis
  const duration = audioBuffer.duration;

  // === Beat Detection via Energy Flux ===
  const windowSize = Math.round(sampleRate * 0.02); // 20ms windows
  const hopSize = Math.round(windowSize / 2);
  const energyFrames: { time: number; energy: number }[] = [];

  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += channelData[i + j] * channelData[i + j];
    }
    energy = Math.sqrt(energy / windowSize);
    energyFrames.push({ time: i / sampleRate, energy });
  }

  // Compute spectral flux (difference between consecutive energy frames)
  const flux: { time: number; value: number }[] = [];
  for (let i = 1; i < energyFrames.length; i++) {
    const diff = Math.max(0, energyFrames[i].energy - energyFrames[i - 1].energy);
    flux.push({ time: energyFrames[i].time, value: diff });
  }

  // Adaptive threshold for onset detection
  const onsets: Onset[] = [];
  const thresholdWindow = 20; // frames for local average
  const thresholdMultiplier = 1.5;
  let lastOnsetTime = -0.1;

  for (let i = thresholdWindow; i < flux.length - thresholdWindow; i++) {
    let localMean = 0;
    for (let j = i - thresholdWindow; j < i + thresholdWindow; j++) {
      localMean += flux[j].value;
    }
    localMean /= thresholdWindow * 2;

    if (flux[i].value > localMean * thresholdMultiplier && flux[i].time - lastOnsetTime > 0.05) {
      lastOnsetTime = flux[i].time;

      // Classify onset by frequency content
      const sampleStart = Math.round(flux[i].time * sampleRate);
      const analyzeLen = Math.min(512, channelData.length - sampleStart);
      let lowE = 0, highE = 0;
      for (let j = 0; j < analyzeLen; j++) {
        const val = channelData[sampleStart + j] || 0;
        // Simple low-pass proxy
        if (j % 4 === 0) lowE += val * val;
        else highE += val * val;
      }

      let type: Onset['type'] = 'transient';
      if (lowE > highE * 2) type = 'kick';
      else if (highE > lowE * 3) type = 'hi-hat';
      else if (flux[i].value > localMean * 3) type = 'snare';

      onsets.push({
        time: flux[i].time,
        type,
        energy: flux[i].value,
      });
    }
  }

  // === Beat Detection via Autocorrelation ===
  const beats: Beat[] = [];
  const bpm = detectBPM(energyFrames, sampleRate, hopSize);

  if (bpm > 0) {
    const beatInterval = 60 / bpm;
    // Find first strong onset as beat anchor
    const anchor = onsets.length > 0 ? onsets[0].time : 0;
    for (let t = anchor; t < duration; t += beatInterval) {
      // Find nearest energy peak
      const nearestFrame = energyFrames.reduce((best, f) =>
        Math.abs(f.time - t) < Math.abs(best.time - t) ? f : best
      );
      beats.push({
        time: nearestFrame.time,
        strength: Math.min(1, nearestFrame.energy * 5),
      });
    }
  }

  // === Frequency Band Analysis ===
  const frequencies: FrequencyBand[] = [];
  const fftSize = 2048;
  const fftHop = Math.round(sampleRate * 0.05); // 50ms

  for (let i = 0; i < channelData.length - fftSize; i += fftHop) {
    // Simple energy in bands (approximation without full FFT)
    let low = 0, mid = 0, high = 0;
    for (let j = 0; j < fftSize; j++) {
      const val = channelData[i + j] * channelData[i + j];
      // Approximate band split by sample index modulation
      if (j < fftSize * 0.1) low += val;
      else if (j < fftSize * 0.5) mid += val;
      else high += val;
    }
    frequencies.push({
      time: i / sampleRate,
      low: Math.sqrt(low / (fftSize * 0.1)),
      mid: Math.sqrt(mid / (fftSize * 0.4)),
      high: Math.sqrt(high / (fftSize * 0.5)),
    });
  }

  // Peak times (top energy moments)
  const sortedEnergy = [...energyFrames].sort((a, b) => b.energy - a.energy);
  const peakTimes = sortedEnergy.slice(0, 20).map(f => f.time).sort((a, b) => a - b);

  return { beats, onsets, bpm, frequencies, duration, peakTimes };
}

/**
 * Detect BPM via autocorrelation of energy envelope.
 */
function detectBPM(
  energyFrames: { time: number; energy: number }[],
  sampleRate: number,
  hopSize: number,
): number {
  if (energyFrames.length < 100) return 0;

  const energies = energyFrames.map(f => f.energy);
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const centered = energies.map(e => e - mean);

  // Autocorrelation for lag range 60-200 BPM
  const framesPerSecond = sampleRate / hopSize;
  const minLag = Math.round(framesPerSecond * 60 / 200); // 200 BPM
  const maxLag = Math.round(framesPerSecond * 60 / 60);  // 60 BPM
  const maxSearch = Math.min(maxLag, centered.length / 2);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxSearch; lag++) {
    let corr = 0;
    const n = Math.min(centered.length - lag, 1000);
    for (let i = 0; i < n; i++) {
      corr += centered[i] * centered[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const bpm = (framesPerSecond * 60) / bestLag;
  return Math.round(bpm);
}

/**
 * Auto-generate formation change times aligned to beats.
 * Returns suggested start times for each formation segment.
 */
export function suggestFormationTimes(
  analysis: AudioAnalysisResult,
  formationCount: number,
  minHoldDuration: number = 4,
): { startTime: number; holdDuration: number }[] {
  const { beats, peakTimes, duration } = analysis;

  if (beats.length === 0 || formationCount <= 0) {
    // Fallback: evenly split
    const segLen = duration / formationCount;
    return Array.from({ length: formationCount }, (_, i) => ({
      startTime: i * segLen,
      holdDuration: segLen - 2,
    }));
  }

  // Use peak energy times as natural transition points
  const candidates = [...peakTimes].filter(t => t > 1 && t < duration - 2);

  // Add evenly-spaced beats as fallback
  const beatInterval = 60 / analysis.bpm;
  const measuresPerFormation = Math.max(2, Math.round(minHoldDuration / (beatInterval * 4)));
  const formationInterval = measuresPerFormation * beatInterval * 4;

  const suggestions: { startTime: number; holdDuration: number }[] = [];
  for (let i = 0; i < formationCount; i++) {
    const idealTime = i * formationInterval;
    // Snap to nearest beat
    const nearestBeat = beats.reduce((best, b) =>
      Math.abs(b.time - idealTime) < Math.abs(best.time - idealTime) ? b : best,
      beats[0],
    );
    suggestions.push({
      startTime: nearestBeat?.time ?? idealTime,
      holdDuration: Math.max(minHoldDuration, formationInterval - 3),
    });
  }

  return suggestions;
}
