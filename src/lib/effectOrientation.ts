/**
 * effectWorldOrientation: Computes world Euler rotation by combining
 * Position (heading/pitch/roll) with Effect (pan/tilt/spin).
 * Position: R = RotY(heading) × RotX(pitch) × RotZ(roll)  — Mortar rack model
 * Effect:   R = RotY(pan) × RotX(tilt) × RotY(spin)       — Moving-head model
 * Returns combined Euler angles (in degrees) for the effect's world orientation.
 */
import type { Position } from '@/types/projectTypes';

export function effectWorldOrientation(
  position: Position,
  item: { pan?: number; tilt?: number; spin?: number }
): { heading: number; pitch: number; roll: number } {
  const toRad = (d: number) => (d || 0) * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;

  // Position quaternion: YXZ order (heading × pitch × roll)
  const euler1 = { x: toRad(position.pitch), y: toRad(position.heading), z: toRad(position.roll) };
  const cy1 = Math.cos(euler1.y / 2), sy1 = Math.sin(euler1.y / 2);
  const cx1 = Math.cos(euler1.x / 2), sx1 = Math.sin(euler1.x / 2);
  const cz1 = Math.cos(euler1.z / 2), sz1 = Math.sin(euler1.z / 2);

  // YXZ quaternion
  const qw1 = cy1 * cx1 * cz1 + sy1 * sx1 * sz1;
  const qx1 = cy1 * sx1 * cz1 + sy1 * cx1 * sz1;
  const qy1 = sy1 * cx1 * cz1 - cy1 * sx1 * sz1;
  const qz1 = cy1 * cx1 * sz1 - sy1 * sx1 * cz1;

  // Effect pan/tilt/spin — simplified: treat as additional YXZ
  const pan = toRad(item.pan || 0);
  const tilt = toRad(item.tilt || 0);
  const spin = toRad(item.spin || 0);
  const cy2 = Math.cos((pan + spin) / 2), sy2 = Math.sin((pan + spin) / 2);
  const cx2 = Math.cos(tilt / 2), sx2 = Math.sin(tilt / 2);

  const qw2 = cy2 * cx2;
  const qx2 = cy2 * sx2;
  const qy2 = sy2 * cx2;
  const qz2 = -sy2 * sx2;

  // Multiply q1 × q2
  const w = qw1 * qw2 - qx1 * qx2 - qy1 * qy2 - qz1 * qz2;
  const x = qw1 * qx2 + qx1 * qw2 + qy1 * qz2 - qz1 * qy2;
  const y = qw1 * qy2 - qx1 * qz2 + qy1 * qw2 + qz1 * qx2;
  const z = qw1 * qz2 + qx1 * qy2 - qy1 * qx2 + qz1 * qw2;

  // Extract YXZ Euler from quaternion
  const sinP = 2 * (w * x - y * z);
  const outPitch = toDeg(Math.asin(Math.max(-1, Math.min(1, sinP))));
  const outHeading = toDeg(Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)));
  const outRoll = toDeg(Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)));

  return { heading: outHeading, pitch: outPitch, roll: outRoll };
}
