/**
 * Video/GIF → Drone Formation Converter
 * Extracts frames from video/GIF files and converts silhouettes to drone positions.
 * 
 * Pipeline: File → Canvas Frames → Threshold → Point Sampling → Formation Points
 */

export interface ExtractedFrame {
  index: number;
  time: number; // seconds
  imageData: ImageData;
  thumbnail: string; // data URL for preview
}

export interface FrameFormation {
  frameIndex: number;
  time: number;
  points: { x: number; z: number }[];
  thumbnail: string;
}

interface ExtractionOptions {
  /** Target FPS for extraction (default: 4) */
  fps?: number;
  /** Max frames to extract (default: 60) */
  maxFrames?: number;
  /** Canvas resolution for processing (default: 128) */
  resolution?: number;
  /** Progress callback */
  onProgress?: (progress: number, phase: string) => void;
}

interface SamplingOptions {
  /** Number of drones/points per frame */
  droneCount: number;
  /** Formation radius in meters */
  radius?: number;
  /** Brightness threshold 0-255 (pixels darker than this = shape) */
  threshold?: number;
  /** Invert detection (bright pixels = shape) */
  invertDetection?: boolean;
  /** Minimum spacing between points in meters */
  minSpacing?: number;
  /** Detection mode */
  detectionMode?: 'threshold' | 'edge' | 'adaptive';
  /** Gaussian blur radius (0 = none) */
  blurRadius?: number;
  /** Contrast boost factor (1 = none, 2 = double) */
  contrastBoost?: number;
  /** Edge detection sensitivity (lower = more edges) */
  edgeSensitivity?: number;
}

// ─── Video Frame Extraction ───────────────────────────────────

export async function extractVideoFrames(
  file: File,
  options: ExtractionOptions = {},
): Promise<ExtractedFrame[]> {
  const {
    fps = 4,
    maxFrames = 60,
    resolution = 128,
    onProgress,
  } = options;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Vídeo inválido ou duração não detectada'));
        return;
      }

      const interval = 1 / fps;
      const totalFrames = Math.min(Math.floor(duration * fps), maxFrames);
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext('2d')!;

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 64;
      thumbCanvas.height = 64;
      const thumbCtx = thumbCanvas.getContext('2d')!;

      const frames: ExtractedFrame[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const time = i * interval;
        onProgress?.(i / totalFrames, `Extraindo frame ${i + 1}/${totalFrames}`);

        try {
          await seekVideo(video, time);
          
          // Draw to processing canvas (square crop, centered)
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scale = Math.min(resolution / vw, resolution / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          const dx = (resolution - dw) / 2;
          const dy = (resolution - dh) / 2;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, resolution, resolution);
          ctx.drawImage(video, dx, dy, dw, dh);

          const imageData = ctx.getImageData(0, 0, resolution, resolution);

          // Thumbnail
          thumbCtx.fillStyle = '#000000';
          thumbCtx.fillRect(0, 0, 64, 64);
          thumbCtx.drawImage(canvas, 0, 0, 64, 64);
          const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);

          frames.push({ index: i, time, imageData, thumbnail });
        } catch (e) {
          console.warn(`Frame ${i} extraction failed:`, e);
        }
      }

      URL.revokeObjectURL(url);
      onProgress?.(1, 'Extração completa');
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar vídeo'));
    };

    video.src = url;
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), 3000); // safety timeout
    video.onseeked = () => {
      clearTimeout(timeout);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Seek failed'));
    };
    video.currentTime = Math.min(time, video.duration - 0.01);
  });
}

// ─── GIF Frame Extraction ─────────────────────────────────────
// Uses the file as a single image if it's a GIF (browsers render first frame)
// For animated GIFs, we use the video approach via a blob URL

export async function extractGifFrames(
  file: File,
  options: ExtractionOptions = {},
): Promise<ExtractedFrame[]> {
  const { fps = 4, maxFrames = 60, resolution = 128, onProgress } = options;

  // Try treating GIF as video first (works in some browsers)
  try {
    const frames = await extractVideoFrames(file, options);
    if (frames.length > 1) return frames;
  } catch { /* fall through to image-based extraction */ }

  // Fallback: decode GIF frames manually using canvas
  onProgress?.(0.1, 'Decodificando GIF...');
  
  const arrayBuffer = await file.arrayBuffer();
  const gifFrames = decodeGifFrames(new Uint8Array(arrayBuffer));
  
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 64;
  thumbCanvas.height = 64;
  const thumbCtx = thumbCanvas.getContext('2d')!;

  const frameInterval = Math.max(1, Math.floor(gifFrames.length / maxFrames));
  const frames: ExtractedFrame[] = [];
  let time = 0;

  for (let i = 0; i < gifFrames.length && frames.length < maxFrames; i += frameInterval) {
    onProgress?.(i / gifFrames.length, `Processando frame ${frames.length + 1}`);
    
    const gf = gifFrames[i];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resolution, resolution);
    
    // Scale to fit resolution
    const scale = Math.min(resolution / gf.width, resolution / gf.height);
    const dw = gf.width * scale;
    const dh = gf.height * scale;
    const dx = (resolution - dw) / 2;
    const dy = (resolution - dh) / 2;

    // Put image data on a temp canvas then draw scaled
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gf.width;
    tempCanvas.height = gf.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(gf.imageData, 0, 0);
    ctx.drawImage(tempCanvas, dx, dy, dw, dh);

    const imageData = ctx.getImageData(0, 0, resolution, resolution);

    thumbCtx.fillStyle = '#000000';
    thumbCtx.fillRect(0, 0, 64, 64);
    thumbCtx.drawImage(canvas, 0, 0, 64, 64);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);

    frames.push({ index: frames.length, time, imageData, thumbnail });
    time += (gf.delay || 100) / 1000 * frameInterval;
  }

  onProgress?.(1, 'Extração completa');
  return frames;
}

// ─── Minimal GIF Decoder ──────────────────────────────────────

interface GifFrame {
  width: number;
  height: number;
  imageData: ImageData;
  delay: number; // ms
}

function decodeGifFrames(data: Uint8Array): GifFrame[] {
  const frames: GifFrame[] = [];
  
  // Verify GIF header
  const header = String.fromCharCode(...data.slice(0, 6));
  if (!header.startsWith('GIF')) return frames;

  const width = data[6] | (data[7] << 8);
  const height = data[8] | (data[9] << 8);
  const packed = data[10];
  const hasGCT = (packed & 0x80) !== 0;
  const gctSize = hasGCT ? 3 * (1 << ((packed & 0x07) + 1)) : 0;

  // Parse global color table
  let gct: number[] = [];
  if (hasGCT) {
    for (let i = 0; i < gctSize; i++) {
      gct.push(data[13 + i]);
    }
  }

  let pos = 13 + gctSize;
  let delay = 100;
  let transparentIndex = -1;
  
  // Create a persistent canvas for frame composition
  const compCanvas = document.createElement('canvas');
  compCanvas.width = width;
  compCanvas.height = height;
  const compCtx = compCanvas.getContext('2d')!;
  compCtx.fillStyle = '#ffffff';
  compCtx.fillRect(0, 0, width, height);

  while (pos < data.length) {
    const block = data[pos++];
    
    if (block === 0x21) { // Extension
      const label = data[pos++];
      if (label === 0xF9) { // Graphics Control
        const size = data[pos++];
        const flags = data[pos];
        delay = ((data[pos + 1] | (data[pos + 2] << 8)) * 10) || 100;
        transparentIndex = (flags & 0x01) ? data[pos + 3] : -1;
        pos += size + 1; // skip terminator
      } else {
        // Skip sub-blocks
        while (pos < data.length) {
          const subSize = data[pos++];
          if (subSize === 0) break;
          pos += subSize;
        }
      }
    } else if (block === 0x2C) { // Image Descriptor
      const imgLeft = data[pos] | (data[pos + 1] << 8);
      const imgTop = data[pos + 2] | (data[pos + 3] << 8);
      const imgWidth = data[pos + 4] | (data[pos + 5] << 8);
      const imgHeight = data[pos + 6] | (data[pos + 7] << 8);
      const imgPacked = data[pos + 8];
      pos += 9;

      const hasLCT = (imgPacked & 0x80) !== 0;
      const lctSize = hasLCT ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0;
      let colorTable = gct;
      if (hasLCT) {
        colorTable = [];
        for (let i = 0; i < lctSize; i++) {
          colorTable.push(data[pos + i]);
        }
        pos += lctSize;
      }

      // LZW decode
      const minCodeSize = data[pos++];
      const lzwData: number[] = [];
      while (pos < data.length) {
        const subSize = data[pos++];
        if (subSize === 0) break;
        for (let i = 0; i < subSize && pos < data.length; i++) {
          lzwData.push(data[pos++]);
        }
      }

      try {
        const pixels = lzwDecode(lzwData, minCodeSize, imgWidth * imgHeight);
        const imageData = new ImageData(imgWidth, imgHeight);
        
        for (let i = 0; i < pixels.length && i < imgWidth * imgHeight; i++) {
          const ci = pixels[i];
          const pi = i * 4;
          if (ci === transparentIndex) {
            imageData.data[pi + 3] = 0;
          } else {
            const cti = ci * 3;
            imageData.data[pi] = colorTable[cti] ?? 0;
            imageData.data[pi + 1] = colorTable[cti + 1] ?? 0;
            imageData.data[pi + 2] = colorTable[cti + 2] ?? 0;
            imageData.data[pi + 3] = 255;
          }
        }

        // Composite onto persistent canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(imageData, 0, 0);
        compCtx.drawImage(tempCanvas, imgLeft, imgTop);

        // Capture composited frame
        const fullFrame = compCtx.getImageData(0, 0, width, height);
        frames.push({ width, height, imageData: fullFrame, delay });
      } catch {
        // LZW decode failed, skip frame
      }
    } else if (block === 0x3B) { // Trailer
      break;
    } else {
      // Unknown block, try to skip sub-blocks
      while (pos < data.length) {
        const subSize = data[pos++];
        if (subSize === 0) break;
        pos += subSize;
      }
    }

    if (frames.length >= 200) break; // safety cap
  }

  return frames;
}

function lzwDecode(data: number[], minCodeSize: number, pixelCount: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoi = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;

  // Initialize code table
  let table: number[][] = [];
  for (let i = 0; i < clearCode; i++) table[i] = [i];
  table[clearCode] = [];
  table[eoi] = [];
  let nextCode = eoi + 1;

  const output: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  let dataIdx = 0;
  let prevCode = -1;

  function readCode(): number {
    while (bitCount < codeSize && dataIdx < data.length) {
      bitBuf |= data[dataIdx++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuf & codeMask;
    bitBuf >>= codeSize;
    bitCount -= codeSize;
    return code;
  }

  while (output.length < pixelCount && dataIdx < data.length + 2) {
    const code = readCode();
    if (code === eoi) break;

    if (code === clearCode) {
      codeSize = minCodeSize + 1;
      codeMask = (1 << codeSize) - 1;
      table = [];
      for (let i = 0; i < clearCode; i++) table[i] = [i];
      table[clearCode] = [];
      table[eoi] = [];
      nextCode = eoi + 1;
      prevCode = -1;
      continue;
    }

    if (prevCode === -1) {
      if (table[code]) output.push(...table[code]);
      prevCode = code;
      continue;
    }

    let entry: number[];
    if (table[code]) {
      entry = table[code];
    } else if (code === nextCode && table[prevCode]) {
      entry = [...table[prevCode], table[prevCode][0]];
    } else {
      break; // error
    }

    output.push(...entry);

    if (table[prevCode] && nextCode < 4096) {
      table[nextCode++] = [...table[prevCode], entry[0]];
      if (nextCode > codeMask && codeSize < 12) {
        codeSize++;
        codeMask = (1 << codeSize) - 1;
      }
    }

    prevCode = code;
  }

  return output;
}

// ─── Image Processing Kernels ─────────────────────────────────

function applyGaussianBlur(img: ImageData, radius: number): ImageData {
  const { width, height, data } = img;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const r = Math.max(1, Math.round(radius));
  const kernel = buildGaussianKernel(r);
  const kSize = r * 2 + 1;

  // Separable blur: horizontal pass
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rr = 0, gg = 0, bb = 0, wSum = 0;
      for (let k = -r; k <= r; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1);
        const pi = (y * width + sx) * 4;
        const w = kernel[k + r];
        rr += data[pi] * w;
        gg += data[pi + 1] * w;
        bb += data[pi + 2] * w;
        wSum += w;
      }
      const pi = (y * width + x) * 4;
      temp[pi] = rr / wSum;
      temp[pi + 1] = gg / wSum;
      temp[pi + 2] = bb / wSum;
      temp[pi + 3] = data[pi + 3];
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rr = 0, gg = 0, bb = 0, wSum = 0;
      for (let k = -r; k <= r; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1);
        const pi = (sy * width + x) * 4;
        const w = kernel[k + r];
        rr += temp[pi] * w;
        gg += temp[pi + 1] * w;
        bb += temp[pi + 2] * w;
        wSum += w;
      }
      const pi = (y * width + x) * 4;
      out.data[pi] = rr / wSum;
      out.data[pi + 1] = gg / wSum;
      out.data[pi + 2] = bb / wSum;
    }
  }
  return out;
}

function buildGaussianKernel(radius: number): number[] {
  const sigma = radius / 2.5;
  const kernel: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    kernel.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  }
  return kernel;
}

function applyContrast(img: ImageData, factor: number): ImageData {
  const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = Math.min(255, Math.max(0, ((out.data[i] - 128) * factor) + 128));
    out.data[i + 1] = Math.min(255, Math.max(0, ((out.data[i + 1] - 128) * factor) + 128));
    out.data[i + 2] = Math.min(255, Math.max(0, ((out.data[i + 2] - 128) * factor) + 128));
  }
  return out;
}

function sobelEdgeDetection(gray: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y - 1) * width + (x - 1)];
      const tc = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const ml = gray[y * width + (x - 1)];
      const mr = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const bc = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return edges;
}

function adaptiveThreshold(
  gray: Float32Array, width: number, height: number, blockSize: number,
): boolean[] {
  const result: boolean[] = new Array(width * height);
  const half = Math.floor(blockSize / 2);
  const C = 8; // offset constant

  // Integral image for fast local mean
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        rowSum + integral[y * (width + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const y1 = Math.max(0, y - half);
      const y2 = Math.min(height - 1, y + half);
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(width - 1, x + half);
      const count = (y2 - y1 + 1) * (x2 - x1 + 1);

      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const localMean = sum / count;
      result[y * width + x] = gray[y * width + x] < localMean - C;
    }
  }
  return result;
}

// ─── Frame → Formation Points ─────────────────────────────────

export function frameToFormationPoints(
  imageData: ImageData,
  options: SamplingOptions,
): { x: number; z: number }[] {
  const {
    droneCount, radius = 25, threshold = 128, invertDetection = false,
    minSpacing = 2.0, detectionMode = 'threshold', blurRadius = 0,
    contrastBoost = 1, edgeSensitivity = 50,
  } = options;
  const { width, height } = imageData;

  // Step 0: Pre-process — blur + contrast
  let processed = imageData;
  if (blurRadius > 0) processed = applyGaussianBlur(processed, blurRadius);
  if (contrastBoost > 1) processed = applyContrast(processed, contrastBoost);

  const { data } = processed;

  // Step 1: Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    const alpha = data[pi + 3];
    gray[i] = alpha < 128 ? 255 : data[pi] * 0.299 + data[pi + 1] * 0.587 + data[pi + 2] * 0.114;
  }

  // Step 2: Detect shape based on mode
  const isShape: boolean[] = new Array(width * height);
  const shapePixels: { px: number; py: number }[] = [];

  if (detectionMode === 'edge') {
    // Sobel edge detection
    const edges = sobelEdgeDetection(gray, width, height);
    const edgeThreshold = 255 - edgeSensitivity * 2.55; // map 0-100 → 255-0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const shape = edges[idx] > edgeThreshold;
        isShape[idx] = shape;
        if (shape) shapePixels.push({ px: x, py: y });
      }
    }
  } else if (detectionMode === 'adaptive') {
    // Adaptive threshold (local mean)
    const blockSize = Math.max(3, Math.floor(Math.min(width, height) / 8) | 1);
    const adaptiveMap = adaptiveThreshold(gray, width, height, blockSize);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const shape = invertDetection ? !adaptiveMap[idx] : adaptiveMap[idx];
        isShape[idx] = shape;
        if (shape) shapePixels.push({ px: x, py: y });
      }
    }
  } else {
    // Simple threshold
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const g = gray[idx];
        const shape = invertDetection ? g >= threshold : g < threshold;
        isShape[idx] = shape;
        if (shape) shapePixels.push({ px: x, py: y });
      }
    }
  }

  if (shapePixels.length === 0) {
    return generateGrid(droneCount, radius);
  }

  // Step 2: Sample points from shape pixels
  // Use stratified sampling for even distribution
  const points: { x: number; z: number }[] = [];
  
  if (shapePixels.length <= droneCount) {
    // Fewer pixels than drones — use all pixels
    for (const p of shapePixels) {
      points.push(pixelToWorld(p.px, p.py, width, height, radius));
    }
  } else {
    // Poisson-disk-like sampling using a grid
    const cellSize = Math.sqrt((width * height) / (droneCount * 2));
    const gridCols = Math.ceil(width / cellSize);
    const gridRows = Math.ceil(height / cellSize);
    const cells = new Map<string, { px: number; py: number }>();

    // Shuffle shape pixels
    const shuffled = [...shapePixels];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const p of shuffled) {
      const gc = Math.floor(p.px / cellSize);
      const gr = Math.floor(p.py / cellSize);
      const key = `${gc},${gr}`;
      if (!cells.has(key)) {
        cells.set(key, p);
        if (cells.size >= droneCount) break;
      }
    }

    for (const p of cells.values()) {
      points.push(pixelToWorld(p.px, p.py, width, height, radius));
    }
  }

  // Pad or trim to exact droneCount
  while (points.length < droneCount) {
    const src = points[points.length % Math.max(1, points.length - 1)];
    if (src) {
      points.push({
        x: src.x + (Math.random() - 0.5) * minSpacing * 0.5,
        z: src.z + (Math.random() - 0.5) * minSpacing * 0.5,
      });
    } else {
      points.push({ x: (Math.random() - 0.5) * radius, z: (Math.random() - 0.5) * radius });
    }
  }

  return points.slice(0, droneCount);
}

function pixelToWorld(
  px: number, py: number,
  imgW: number, imgH: number,
  radius: number,
): { x: number; z: number } {
  // Map pixel coordinates to world coordinates centered at origin
  // x: horizontal, z: vertical (upright formation)
  const nx = (px / imgW - 0.5) * 2; // -1 to 1
  const nz = -(py / imgH - 0.5) * 2; // -1 to 1, flipped (y-down → z-up)
  return {
    x: nx * radius,
    z: nz * radius,
  };
}

function generateGrid(count: number, radius: number): { x: number; z: number }[] {
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = (radius * 2) / cols;
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    points.push({
      x: (col - (cols - 1) / 2) * spacing,
      z: (row - (cols - 1) / 2) * spacing,
    });
  }
  return points;
}

// ─── Batch: Convert all frames to formations ──────────────────

export async function framesToChoreography(
  frames: ExtractedFrame[],
  options: SamplingOptions & {
    holdDuration?: number;
    transitionDuration?: number;
    height?: number;
    color?: string;
    onProgress?: (progress: number) => void;
  },
): Promise<FrameFormation[]> {
  const {
    holdDuration = 3,
    transitionDuration = 5,
    height = 30,
    color = '#00E5FF',
    onProgress,
    ...samplingOpts
  } = options;

  const formations: FrameFormation[] = [];

  for (let i = 0; i < frames.length; i++) {
    onProgress?.(i / frames.length);
    const frame = frames[i];
    const points = frameToFormationPoints(frame.imageData, samplingOpts);
    formations.push({
      frameIndex: frame.index,
      time: i * (holdDuration + transitionDuration),
      points,
      thumbnail: frame.thumbnail,
    });
  }

  onProgress?.(1);
  return formations;
}

// ─── Auto-detect file type ────────────────────────────────────

export function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name);
}
