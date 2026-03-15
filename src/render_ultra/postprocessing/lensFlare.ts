/**
 * FX KONTROL · Lens Flare System
 * Camera optics simulation for bright firework bursts.
 */

import * as THREE from 'three';

/**
 * Create a sprite-based lens flare for bright explosions.
 */
export function createLensFlareSprite(color: THREE.Color, size = 30): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Multi-ring lens flare pattern
  const cx = 128, cy = 128;

  // Core glow
  const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
  grad1.addColorStop(0, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.8)`);
  grad1.addColorStop(0.3, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.2)`);
  grad1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, 256, 256);

  // Starburst rays
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad2 = ctx.createLinearGradient(-128, 0, 128, 0);
    grad2.addColorStop(0, 'rgba(255,255,255,0)');
    grad2.addColorStop(0.45, `rgba(${Math.round(color.r * 200)}, ${Math.round(color.g * 200)}, ${Math.round(color.b * 200)}, 0.08)`);
    grad2.addColorStop(0.5, `rgba(255,255,255,0.15)`);
    grad2.addColorStop(0.55, `rgba(${Math.round(color.r * 200)}, ${Math.round(color.g * 200)}, ${Math.round(color.b * 200)}, 0.08)`);
    grad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(-128, -2, 256, 4);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.visible = false;

  return sprite;
}

/**
 * Flash a lens flare at a given world position.
 */
export function flashLensFlare(
  sprite: THREE.Sprite,
  position: THREE.Vector3,
  intensity: number,
  color?: THREE.Color
) {
  sprite.position.copy(position);
  sprite.visible = true;
  sprite.material.opacity = Math.min(intensity, 1);
  if (color) {
    sprite.material.color.copy(color);
  }
}

/**
 * Decay lens flare over time.
 */
export function decayLensFlare(sprite: THREE.Sprite, dt: number, rate = 3) {
  if (!sprite.visible) return;
  sprite.material.opacity *= Math.max(0, 1 - rate * dt);
  if (sprite.material.opacity < 0.01) {
    sprite.visible = false;
  }
}
