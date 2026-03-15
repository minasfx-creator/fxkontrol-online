/**
 * FX KONTROL · Propeller Motion Blur
 * Disc-based motion blur simulation for high-speed rotors.
 */

import * as THREE from 'three';

/**
 * Create a motion-blurred rotor disc mesh.
 */
export function createRotorDisc(radius = 0.35, opacity = 0.08): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xaabbcc,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(geometry, material);
  disc.rotation.x = -Math.PI / 2;
  return disc;
}

/**
 * Create a 4-rotor motion blur rig for a quadcopter.
 */
export function createQuadRotorBlur(armLength = 0.5, rotorRadius = 0.35) {
  const group = new THREE.Group();
  const offsets = [
    [armLength, 0, armLength],
    [-armLength, 0, armLength],
    [armLength, 0, -armLength],
    [-armLength, 0, -armLength],
  ];

  const discs: THREE.Mesh[] = [];
  for (const [x, y, z] of offsets) {
    const disc = createRotorDisc(rotorRadius, 0.06);
    disc.position.set(x, y + 0.15, z);
    group.add(disc);
    discs.push(disc);
  }

  return {
    group,
    discs,
    /**
     * Animate rotor blur based on throttle (0-1).
     * Higher throttle = more opaque disc (faster spin blur).
     */
    updateThrottle(throttle: number) {
      const op = 0.03 + throttle * 0.12;
      for (const d of discs) {
        (d.material as THREE.MeshBasicMaterial).opacity = op;
      }
    },
  };
}
