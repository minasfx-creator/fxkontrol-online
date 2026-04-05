/**
 * Synthetic holographic glitch sound using Web Audio API.
 * Short burst (~600ms) of filtered noise + sine chirp — subtle and sci-fi.
 */
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playGlitchBurst(volume = 0.12, pitchShift = 1) {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const dur = 0.6;

    // Master gain
    const master = ctx.createGain();
    master.gain.setValueAtTime(volume, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + dur);
    master.connect(ctx.destination);

    // Layer 1: Filtered white noise burst
    const bufLen = ctx.sampleRate * dur;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400 * pitchShift, now);
    bp.frequency.exponentialRampToValueAtTime(800 * pitchShift, now + dur);
    bp.Q.value = 4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);

    noiseSrc.connect(bp).connect(noiseGain).connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur);

    // Layer 2: Descending sine chirp (digital whine)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + dur * 0.5);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.4);

    osc.connect(oscGain).connect(master);
    osc.start(now);
    osc.stop(now + dur);

    // Layer 3: Short click/pop at start
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.value = 150;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickOsc.connect(clickGain).connect(master);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);
  } catch {
    // Silently fail — audio is non-critical
  }
}
