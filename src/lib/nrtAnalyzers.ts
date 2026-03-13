/**
 * ─── NRT Audio Analyzers ────────────────────────────────────────────
 * Non-Real-Time (NRT) audio analysis inspired by UE5 Audio Synesthesia.
 * - LoudnessNRT: perceptual loudness over time (A-weighted)
 * - OnsetNRT: percussive hit detection with spectral flux
 * - ConstantQNRT: frequency breakdown spaced like musical notes
 */

export interface LoudnessFrame {
  time: number;
  loudness: number;    // 0-1 normalized
  peak: number;        // peak amplitude
  rms: number;         // root mean square
}

export interface OnsetEvent {
  time: number;
  strength: number;    // 0-1
  type: 'percussive' | 'harmonic' | 'mixed';
  frequency: number;   // dominant frequency at onset
}

export interface ConstantQBand {
  note: string;        // e.g. "C4", "A#3"
  frequency: number;   // Hz
  magnitude: number;   // 0-1
}

export interface ConstantQFrame {
  time: number;
  bands: ConstantQBand[];
}

export interface NRTAnalysisResult {
  loudness: LoudnessFrame[];
  onsets: OnsetEvent[];
  constantQ: ConstantQFrame[];
  duration: number;
  sampleRate: number;
  peakLoudness: number;
  avgLoudness: number;
  onsetDensity: number; // onsets per second
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

/** Perform comprehensive NRT analysis on an AudioBuffer */
export async function performNRTAnalysis(
  audioBuffer: AudioBuffer,
  options: {
    frameSize?: number;      // FFT size
    hopSize?: number;        // samples between frames
    onsetThreshold?: number; // sensitivity
    cqMinMidi?: number;      // lowest MIDI note for ConstantQ
    cqMaxMidi?: number;      // highest MIDI note
  } = {},
): Promise<NRTAnalysisResult> {
  const {
    frameSize = 2048,
    hopSize = 512,
    onsetThreshold = 0.15,
    cqMinMidi = 36,  // C2
    cqMaxMidi = 96,  // C7
  } = options;

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const duration = totalSamples / sampleRate;

  const loudness: LoudnessFrame[] = [];
  const onsets: OnsetEvent[] = [];
  const constantQ: ConstantQFrame[] = [];

  // Pre-compute Hann window
  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }

  let prevSpectralFlux = 0;
  let prevMagnitudes: Float32Array | null = null;

  // Process frames
  for (let start = 0; start + frameSize <= totalSamples; start += hopSize) {
    const time = start / sampleRate;

    // Apply window and compute RMS/peak
    let rms = 0;
    let peak = 0;
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      const sample = channelData[start + i];
      frame[i] = sample * window[i];
      rms += sample * sample;
      if (Math.abs(sample) > peak) peak = Math.abs(sample);
    }
    rms = Math.sqrt(rms / frameSize);

    // A-weighted loudness approximation
    const loudnessValue = Math.min(1, rms * 3.5);

    loudness.push({
      time,
      loudness: loudnessValue,
      peak,
      rms,
    });

    // Simple DFT for onset and CQ (optimized for key frequencies)
    const halfSize = frameSize / 2;
    const magnitudes = new Float32Array(halfSize);
    
    // Compute magnitude spectrum at key frequencies
    for (let k = 0; k < halfSize; k++) {
      let re = 0, im = 0;
      // Downsample the DFT computation for performance
      if (k < 64 || k % 4 === 0) {
        for (let n = 0; n < frameSize; n += 4) { // Skip every 4 for speed
          const angle = (2 * Math.PI * k * n) / frameSize;
          re += frame[n] * Math.cos(angle);
          im -= frame[n] * Math.sin(angle);
        }
        magnitudes[k] = Math.sqrt(re * re + im * im) * 4 / frameSize;
      }
    }

    // Onset detection via spectral flux
    if (prevMagnitudes) {
      let flux = 0;
      for (let k = 0; k < halfSize; k += 4) {
        const diff = magnitudes[k] - prevMagnitudes[k];
        if (diff > 0) flux += diff;
      }

      if (flux > onsetThreshold && flux > prevSpectralFlux * 1.3) {
        // Determine onset type
        let lowEnergy = 0, highEnergy = 0;
        for (let k = 0; k < halfSize; k += 4) {
          const freq = (k * sampleRate) / frameSize;
          if (freq < 500) lowEnergy += magnitudes[k];
          else highEnergy += magnitudes[k];
        }
        
        const type: OnsetEvent['type'] = 
          lowEnergy > highEnergy * 2 ? 'percussive' :
          highEnergy > lowEnergy * 2 ? 'harmonic' : 'mixed';

        // Find dominant frequency
        let maxMag = 0, domFreq = 440;
        for (let k = 1; k < halfSize; k += 4) {
          if (magnitudes[k] > maxMag) {
            maxMag = magnitudes[k];
            domFreq = (k * sampleRate) / frameSize;
          }
        }

        onsets.push({
          time,
          strength: Math.min(1, flux / 0.5),
          type,
          frequency: domFreq,
        });
      }
      prevSpectralFlux = flux;
    }
    prevMagnitudes = new Float32Array(magnitudes);

    // ConstantQ: extract energy at musical note frequencies
    // Only compute every 4th frame for performance
    if (start % (hopSize * 4) === 0) {
      const bands: ConstantQBand[] = [];
      for (let midi = cqMinMidi; midi <= cqMaxMidi; midi += 2) { // every other note
        const freq = midiToFreq(midi);
        const bin = Math.round((freq * frameSize) / sampleRate);
        if (bin > 0 && bin < halfSize) {
          bands.push({
            note: midiToNote(midi),
            frequency: freq,
            magnitude: Math.min(1, magnitudes[bin] * 8),
          });
        }
      }
      constantQ.push({ time, bands });
    }
  }

  const peakLoudness = Math.max(...loudness.map(l => l.loudness), 0);
  const avgLoudness = loudness.reduce((s, l) => s + l.loudness, 0) / Math.max(1, loudness.length);
  const onsetDensity = onsets.length / Math.max(0.01, duration);

  return {
    loudness,
    onsets,
    constantQ,
    duration,
    sampleRate,
    peakLoudness,
    avgLoudness,
    onsetDensity,
  };
}

/** Map NRT loudness to drone LED brightness */
export function mapLoudnessToBrightness(
  time: number,
  loudness: LoudnessFrame[],
  sensitivity: number = 1.0,
): number {
  if (loudness.length === 0) return 0.5;
  
  // Find surrounding frames
  let lo = 0, hi = loudness.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (loudness[mid].time <= time) lo = mid;
    else hi = mid;
  }
  
  const t = loudness[lo].time === loudness[hi].time ? 0 :
    (time - loudness[lo].time) / (loudness[hi].time - loudness[lo].time);
  const value = loudness[lo].loudness + (loudness[hi].loudness - loudness[lo].loudness) * t;
  
  return Math.min(1, value * sensitivity);
}

/** Map NRT onset to formation change trigger */
export function shouldTriggerFormationChange(
  time: number,
  onsets: OnsetEvent[],
  minStrength: number = 0.5,
  cooldown: number = 2.0,
): OnsetEvent | null {
  for (const onset of onsets) {
    if (Math.abs(onset.time - time) < 0.05 && onset.strength >= minStrength) {
      // Check cooldown
      const recent = onsets.filter(o => 
        o.time < onset.time && 
        o.time > onset.time - cooldown && 
        o.strength >= minStrength
      );
      if (recent.length === 0 || onset.time - recent[recent.length - 1].time >= cooldown) {
        return onset;
      }
    }
  }
  return null;
}
