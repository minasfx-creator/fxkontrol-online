/**
 * CameraController — viewport-agnostic camera helper.
 *
 * Operates on a small interface so the engine, tests and even non-Three
 * runtimes (e.g. a 2D preview) can drive it. The Show3DEngine wraps a real
 * THREE.PerspectiveCamera and forwards calls.
 */

import type { SiteNode, Vec3 } from './SceneAdapter';

export interface CameraTarget {
  position: Vec3;
  lookAt: Vec3;
  aspect: number;
}

export interface CameraSink {
  apply(target: CameraTarget): void;
  setAspect(aspect: number): void;
}

export class CameraController {
  private _aspect = 16 / 9;
  private _last: CameraTarget;

  constructor(private sink: CameraSink) {
    this._last = {
      position: { x: 0, y: 60, z: 180 },
      lookAt: { x: 0, y: 0, z: 0 },
      aspect: this._aspect,
    };
  }

  frameSite(site: SiteNode): CameraTarget {
    // Frame the bounding box from a comfortable diagonal angle.
    const span = Math.max(site.width, site.depth, site.maxHeight);
    const dist = span * 1.4;
    const target: CameraTarget = {
      position: { x: dist * 0.6, y: span * 0.7, z: dist * 0.9 },
      lookAt: { x: site.center.x, y: site.maxHeight * 0.25, z: site.center.z },
      aspect: this._aspect,
    };
    this._last = target;
    this.sink.apply(target);
    return target;
  }

  focusPosition(p: Vec3, distance = 30): CameraTarget {
    const target: CameraTarget = {
      position: { x: p.x + distance, y: p.y + distance * 0.6, z: p.z + distance },
      lookAt: { x: p.x, y: p.y, z: p.z },
      aspect: this._aspect,
    };
    this._last = target;
    this.sink.apply(target);
    return target;
  }

  resetView(): CameraTarget {
    const target: CameraTarget = {
      position: { x: 0, y: 60, z: 180 },
      lookAt: { x: 0, y: 0, z: 0 },
      aspect: this._aspect,
    };
    this._last = target;
    this.sink.apply(target);
    return target;
  }

  updateAspect(width: number, height: number): void {
    if (!(width > 0) || !(height > 0)) return;
    this._aspect = width / height;
    this._last.aspect = this._aspect;
    this.sink.setAspect(this._aspect);
  }

  current(): CameraTarget { return this._last; }
}
