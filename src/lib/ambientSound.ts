/**
 * AmbientSoundEngine — BR2049 Web Audio API Synthesizer
 * Generates ambient hum, navigation bleeps, boot sweeps, and error tones.
 * No external audio files required.
 */

type SoundType = 'nav' | 'click' | 'boot' | 'error';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private _volume: number;
  private _muted: boolean;
  private _humming = false;
  private _initialized = false;

  constructor() {
    this._volume = parseFloat(localStorage.getItem('fxk-ambient-volume') ?? '0.3');
    this._muted = localStorage.getItem('fxk-ambient-muted') === 'true';
  }

  private init() {
    if (this._initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;
    } catch {
      // Web Audio not supported
    }
  }

  private ensureResumed() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  get volume() { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('fxk-ambient-volume', String(this._volume));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx!.currentTime, 0.05);
    }
  }

  get muted() { return this._muted; }
  set muted(m: boolean) {
    this._muted = m;
    localStorage.setItem('fxk-ambient-muted', String(m));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : this._volume, this.ctx!.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.muted = !this._muted;
  }

  startHum() {
    if (this._humming) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.ensureResumed();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.015;

    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.value = 55;

    this.humOsc.connect(filter);
    filter.connect(this.humGain);
    this.humGain.connect(this.masterGain);
    this.humOsc.start();
    this._humming = true;
  }

  stopHum() {
    if (this.humOsc) {
      try { this.humOsc.stop(); } catch {}
      this.humOsc = null;
    }
    this.humGain = null;
    this._humming = false;
  }

  play(sound: SoundType) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    this.ensureResumed();
    const t = this.ctx.currentTime;

    switch (sound) {
      case 'nav': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
      case 'click': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.025);
        break;
      }
      case 'boot': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }
      case 'error': {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 440;
        osc2.type = 'sine';
        osc2.frequency.value = 466;
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.12);
        osc2.stop(t + 0.12);
        break;
      }
    }
  }
}

export const ambientSound = new AmbientSoundEngine();
