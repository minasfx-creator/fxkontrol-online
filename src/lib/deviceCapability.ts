/**
 * Device capability detector — profiles hardware for adaptive quality.
 */

export type DeviceTier = 'low' | 'medium' | 'high';

export interface DeviceProfile {
  tier: DeviceTier;
  isMobile: boolean;
  memory: number;        // GB (or estimate)
  cores: number;
  maxWaypoints: number;  // Per trajectory
  pixelRatioLimit: number;
  enablePostProcessing: boolean;
}

let _cached: DeviceProfile | null = null;

export function getDeviceProfile(): DeviceProfile {
  if (_cached) return _cached;

  const nav = navigator as any;
  const memory = nav.deviceMemory ?? 8;          // GB, defaults high on desktop
  const cores = nav.hardwareConcurrency ?? 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1;

  let tier: DeviceTier = 'high';
  if (isMobile && memory <= 3)      tier = 'low';
  else if (isMobile && memory <= 6) tier = 'medium';
  else if (isMobile)                tier = 'medium';
  else if (memory <= 4 || cores <= 2) tier = 'medium';

  const profile: DeviceProfile = {
    tier,
    isMobile,
    memory,
    cores,
    maxWaypoints: tier === 'low' ? 600 : tier === 'medium' ? 900 : 1500,
    pixelRatioLimit: tier === 'low' ? 1.0 : tier === 'medium' ? 1.5 : 2.0,
    enablePostProcessing: tier === 'high',
  };

  _cached = profile;
  console.log(`[DeviceCapability] tier=${tier} mem=${memory}GB cores=${cores} mobile=${isMobile} maxWP=${profile.maxWaypoints}`);
  return profile;
}
