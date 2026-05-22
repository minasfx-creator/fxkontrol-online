/**
 * Pure Vec3 math for the SwarmGPT Fields engine.
 * No DOM, no Three.js — runs in edge functions and workers.
 */
import type { Vec3 } from "../types";

export const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, value: number): Vec3 {
  return { x: a.x * value, y: a.y * value, z: a.z * value };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len <= 1e-6) return ZERO_VEC3;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}
