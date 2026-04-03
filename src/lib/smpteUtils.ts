/**
 * SMPTE Drop-Frame Timecode Formatter
 * Supports NDF (all rates) and DF (29.97 / 59.94)
 */

export interface SMPTEFormatted {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  dropFrame: boolean;
  text: string;
}

/**
 * Format seconds into SMPTE timecode string
 * @param seconds - absolute time in seconds
 * @param fps - frame rate (24, 25, 29.97, 30, 59.94, 60)
 * @param dropFrame - enable drop-frame mode (only valid for 29.97 / 59.94)
 */
export function formatSMPTE(seconds: number, fps: number = 30, dropFrame: boolean = false): SMPTEFormatted {
  if (seconds < 0) seconds = 0;

  const isDF = dropFrame && (Math.abs(fps - 29.97) < 0.1 || Math.abs(fps - 59.94) < 0.1);
  const nominalFps = Math.round(fps);

  if (isDF) {
    return formatDropFrame(seconds, fps, nominalFps);
  }

  const totalFrames = Math.floor(seconds * nominalFps);
  const frames = totalFrames % nominalFps;
  const totalSeconds = Math.floor(totalFrames / nominalFps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hrs = Math.floor(totalMinutes / 60) % 24;

  const text = `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}:${pad2(frames)}`;
  return { hours: hrs, minutes: mins, seconds: secs, frames, dropFrame: false, text };
}

function formatDropFrame(seconds: number, fps: number, nominalFps: number): SMPTEFormatted {
  // Drop-frame: skip frame numbers 00 and 01 at the start of each minute
  // EXCEPT minutes divisible by 10
  const dropFrames = nominalFps === 30 ? 2 : 4; // 29.97 drops 2, 59.94 drops 4
  const framesPerHour = Math.round(fps * 3600);
  const framesPerMin = Math.round(fps * 60);
  const framesPerTenMin = Math.round(fps * 600);

  let totalFrames = Math.round(seconds * fps);

  const d = Math.floor(totalFrames / framesPerTenMin);
  const m = totalFrames % framesPerTenMin;

  if (m > dropFrames) {
    totalFrames += dropFrames * (9 * d + Math.floor((m - dropFrames) / (framesPerMin - dropFrames)));
  } else {
    totalFrames += dropFrames * 9 * d;
  }

  const frames = totalFrames % nominalFps;
  const secs = Math.floor(totalFrames / nominalFps) % 60;
  const mins = Math.floor(totalFrames / (nominalFps * 60)) % 60;
  const hrs = Math.floor(totalFrames / (nominalFps * 3600)) % 24;

  // DF uses semicolons between seconds and frames
  const text = `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)};${pad2(frames)}`;
  return { hours: hrs, minutes: mins, seconds: secs, frames, dropFrame: true, text };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
