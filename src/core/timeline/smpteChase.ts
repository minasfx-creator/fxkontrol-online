export interface SMPTEChaseOptions {
  deadbandSec?: number;
  softThresholdSec?: number;
  snapThresholdSec?: number;
  maxCorrectionPerTickSec?: number;
}

export interface SMPTEChaseResult {
  mode: 'ignore' | 'soft' | 'snap';
  nextTime: number;
  driftSec: number;
}

const DEFAULT_OPTIONS: Required<SMPTEChaseOptions> = {
  deadbandSec: 0.02,
  softThresholdSec: 0.05,
  snapThresholdSec: 0.5,
  maxCorrectionPerTickSec: 0.05,
};

export function resolveSMPTEChase(
  localTime: number,
  externalTime: number,
  options: SMPTEChaseOptions = {},
): SMPTEChaseResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const driftSec = externalTime - localTime;
  const absDrift = Math.abs(driftSec);

  if (absDrift <= config.deadbandSec) {
    return { mode: 'ignore', nextTime: localTime, driftSec };
  }

  if (absDrift <= config.softThresholdSec) {
    return { mode: 'soft', nextTime: externalTime, driftSec };
  }

  if (absDrift >= config.snapThresholdSec) {
    return { mode: 'snap', nextTime: externalTime, driftSec };
  }

  const correction = Math.sign(driftSec) * Math.min(absDrift, config.maxCorrectionPerTickSec);
  return { mode: 'soft', nextTime: localTime + correction, driftSec };
}