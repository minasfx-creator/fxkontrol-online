/**
 * skycanvasAudioPeaks — decode an audio File and reduce to N min/max peak buckets.
 *
 * Uses OfflineAudioContext for off-main-thread decode (browser implements it on
 * a worker thread). Result is a flat Float32Array of length 2*buckets:
 * [min0, max0, min1, max1, ...].
 *
 * Pure helper, zero dependence on stores / safety / engine.
 */

export interface AudioPeaksResult {
  durationSec: number;
  sampleRate: number;
  channels: number;
  peaks: Float32Array; // [min,max] per bucket
  buckets: number;
}

export async function decodeAudioPeaks(file: File, buckets = 1024): Promise<AudioPeaksResult> {
  const arrayBuf = await file.arrayBuffer();

  // Use a regular AudioContext to decode then sum to mono peaks.
  const Ctor: typeof AudioContext =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error('AudioContext indisponível neste navegador');

  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    void ctx.close().catch(() => {});
  }

  const ch = decoded.numberOfChannels;
  const len = decoded.length;
  const samplesPerBucket = Math.max(1, Math.floor(len / buckets));
  const peaks = new Float32Array(buckets * 2);

  // Pull each channel's data once.
  const chData: Float32Array[] = [];
  for (let c = 0; c < ch; c++) chData.push(decoded.getChannelData(c));

  for (let b = 0; b < buckets; b++) {
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, len);
    let mn = 1.0;
    let mx = -1.0;
    for (let i = start; i < end; i++) {
      let v = 0;
      for (let c = 0; c < ch; c++) v += chData[c][i];
      v /= ch;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    peaks[b * 2] = mn;
    peaks[b * 2 + 1] = mx;
  }

  return {
    durationSec: decoded.duration,
    sampleRate: decoded.sampleRate,
    channels: ch,
    peaks,
    buckets,
  };
}
