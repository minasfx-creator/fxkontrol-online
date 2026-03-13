/**
 * AR/Hybrid Overlay Engine
 * Composites simulated pyrotechnic effects over real venue photographs.
 * Supports perspective calibration, opacity blending, and alignment markers.
 */

export interface ARCalibration {
  /** Horizon line Y position (0-1 normalized from top) */
  horizonY: number;
  /** Vanishing point X (0-1 normalized) */
  vanishingPointX: number;
  /** Scale factor for effects relative to image */
  effectScale: number;
  /** Rotation offset in degrees */
  rotationOffset: number;
  /** Camera FOV estimate for the venue photo */
  estimatedFOV: number;
}

export interface AROverlayState {
  /** Background venue image (data URL or blob URL) */
  venueImageUrl: string | null;
  /** Calibration parameters */
  calibration: ARCalibration;
  /** Overlay opacity (0-1) */
  overlayOpacity: number;
  /** Whether to show alignment grid */
  showGrid: boolean;
  /** Whether to show horizon line */
  showHorizon: boolean;
  /** Ground plane Y mapping */
  groundPlaneY: number;
  /** Blend mode for compositing */
  blendMode: 'screen' | 'add' | 'normal' | 'overlay';
}

export const DEFAULT_AR_STATE: AROverlayState = {
  venueImageUrl: null,
  calibration: {
    horizonY: 0.6,
    vanishingPointX: 0.5,
    effectScale: 1.0,
    rotationOffset: 0,
    estimatedFOV: 60,
  },
  overlayOpacity: 0.85,
  showGrid: false,
  showHorizon: true,
  groundPlaneY: 0.85,
  blendMode: 'screen',
};

/**
 * Map a 3D world position to a 2D pixel position on the venue photo.
 * Uses single-point perspective projection based on calibration.
 */
export function worldToImagePosition(
  worldX: number,
  worldY: number,
  worldZ: number,
  calibration: ARCalibration,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; scale: number } {
  const { horizonY, vanishingPointX, effectScale, estimatedFOV } = calibration;

  // Vanishing point in pixels
  const vpX = vanishingPointX * imageWidth;
  const vpY = horizonY * imageHeight;

  // Distance factor (further objects converge to vanishing point)
  const depthFactor = 1 / (1 + Math.abs(worldZ) * 0.02);

  // X position: lateral offset scaled by depth
  const lateralScale = effectScale * depthFactor;
  const screenX = vpX + worldX * lateralScale * (imageWidth / 100);

  // Y position: height above ground, converging to horizon
  const groundY = imageHeight * 0.85; // ground level
  const skywardOffset = worldY * lateralScale * (imageHeight / 80);
  const screenY = vpY + (groundY - vpY) * depthFactor - skywardOffset;

  // Effect size scaling
  const sizeScale = effectScale * depthFactor;

  return { x: screenX, y: screenY, scale: sizeScale };
}

/**
 * Draw calibration grid overlay on a canvas context.
 */
export function drawCalibrationGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  calibration: ARCalibration,
  showGrid: boolean,
  showHorizon: boolean,
) {
  ctx.save();

  if (showHorizon) {
    const horizonPixelY = calibration.horizonY * height;
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, horizonPixelY);
    ctx.lineTo(width, horizonPixelY);
    ctx.stroke();

    // Vanishing point marker
    const vpX = calibration.vanishingPointX * width;
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 100, 50, 0.8)';
    ctx.beginPath();
    ctx.arc(vpX, horizonPixelY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vpX, horizonPixelY, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
    ctx.font = '10px monospace';
    ctx.fillText('HORIZON', 8, horizonPixelY - 6);
  }

  if (showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);

    // Vertical lines
    for (let i = 1; i < 8; i++) {
      const x = (i / 8) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Perspective convergence lines from vanishing point
    const vpX = calibration.vanishingPointX * width;
    const vpY = calibration.horizonY * height;
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.15)';
    ctx.setLineDash([4, 8]);
    for (let angle = -60; angle <= 60; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      const endX = vpX + Math.sin(rad) * width;
      const endY = vpY + Math.cos(rad) * height;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Composite the 3D viewport onto a venue photo with proper blending.
 */
export function compositeFrames(
  outputCtx: CanvasRenderingContext2D,
  venueImage: HTMLImageElement | HTMLCanvasElement,
  viewportCanvas: HTMLCanvasElement,
  state: AROverlayState,
) {
  const { width, height } = outputCtx.canvas;

  // Draw venue background
  outputCtx.drawImage(venueImage, 0, 0, width, height);

  // Set blend mode
  const blendMap: Record<string, GlobalCompositeOperation> = {
    screen: 'screen',
    add: 'lighter',
    normal: 'source-over',
    overlay: 'overlay',
  };
  outputCtx.globalCompositeOperation = blendMap[state.blendMode] || 'screen';
  outputCtx.globalAlpha = state.overlayOpacity;

  // Draw 3D viewport overlay
  outputCtx.drawImage(viewportCanvas, 0, 0, width, height);

  // Reset
  outputCtx.globalCompositeOperation = 'source-over';
  outputCtx.globalAlpha = 1;

  // Draw calibration overlays
  drawCalibrationGrid(
    outputCtx,
    width,
    height,
    state.calibration,
    state.showGrid,
    state.showHorizon,
  );
}
