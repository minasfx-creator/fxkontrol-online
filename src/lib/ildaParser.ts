/**
 * ILDA File Parser — International Laser Display Association format
 * Parses .ild binary files into vector frame data for laser projection.
 * Supports ILDA Format 0 (3D Coords + Colors) and Format 1 (2D Coords + Colors).
 */

export interface ILDAPoint {
  x: number; // -32768 to 32767 → normalized -1 to 1
  y: number;
  z: number;
  r: number; // 0-255
  g: number;
  b: number;
  blanking: boolean; // true = beam off (repositioning)
  lastPoint: boolean;
}

export interface ILDAFrame {
  name: string;
  companyName: string;
  pointCount: number;
  frameNumber: number;
  totalFrames: number;
  points: ILDAPoint[];
}

// Default ILDA color palette (64 colors)
const ILDA_PALETTE: [number, number, number][] = [
  [255,0,0],[255,16,0],[255,32,0],[255,48,0],[255,64,0],[255,80,0],[255,96,0],[255,112,0],
  [255,128,0],[255,144,0],[255,160,0],[255,176,0],[255,192,0],[255,208,0],[255,224,0],[255,240,0],
  [255,255,0],[224,255,0],[192,255,0],[160,255,0],[128,255,0],[96,255,0],[64,255,0],[32,255,0],
  [0,255,0],[0,255,36],[0,255,73],[0,255,109],[0,255,146],[0,255,182],[0,255,219],[0,255,255],
  [0,227,255],[0,198,255],[0,170,255],[0,142,255],[0,113,255],[0,85,255],[0,56,255],[0,28,255],
  [0,0,255],[32,0,255],[64,0,255],[96,0,255],[128,0,255],[160,0,255],[192,0,255],[224,0,255],
  [255,0,255],[255,0,224],[255,0,192],[255,0,160],[255,0,128],[255,0,96],[255,0,64],[255,0,32],
  [255,255,255],[255,224,224],[255,192,192],[255,160,160],[255,128,128],[255,96,96],[255,64,64],[255,32,32],
];

/**
 * Parse an ILDA .ild file from an ArrayBuffer
 */
export function parseILDA(buffer: ArrayBuffer): ILDAFrame[] {
  const view = new DataView(buffer);
  const frames: ILDAFrame[] = [];
  let offset = 0;

  while (offset + 32 <= buffer.byteLength) {
    // Check ILDA header signature
    const sig = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    if (sig !== 'ILDA') break;

    const formatCode = view.getUint8(offset + 7);
    
    // Read name (8 bytes at offset 8)
    let name = '';
    for (let i = 0; i < 8; i++) {
      const c = view.getUint8(offset + 8 + i);
      if (c > 0) name += String.fromCharCode(c);
    }

    // Read company (8 bytes at offset 16)
    let companyName = '';
    for (let i = 0; i < 8; i++) {
      const c = view.getUint8(offset + 16 + i);
      if (c > 0) companyName += String.fromCharCode(c);
    }

    const pointCount = view.getUint16(offset + 24);
    const frameNumber = view.getUint16(offset + 26);
    const totalFrames = view.getUint16(offset + 28);

    offset += 32; // Skip header

    if (pointCount === 0) continue; // End-of-file marker

    const points: ILDAPoint[] = [];

    for (let i = 0; i < pointCount && offset < buffer.byteLength; i++) {
      let x = 0, y = 0, z = 0, r = 255, g = 255, b = 255;
      let statusByte = 0;

      if (formatCode === 0) {
        // Format 0: 3D + palette index (8 bytes per point)
        x = view.getInt16(offset);
        y = view.getInt16(offset + 2);
        z = view.getInt16(offset + 4);
        statusByte = view.getUint8(offset + 6);
        const colorIdx = view.getUint8(offset + 7) % ILDA_PALETTE.length;
        [r, g, b] = ILDA_PALETTE[colorIdx];
        offset += 8;
      } else if (formatCode === 1) {
        // Format 1: 2D + palette index (6 bytes per point)
        x = view.getInt16(offset);
        y = view.getInt16(offset + 2);
        statusByte = view.getUint8(offset + 4);
        const colorIdx = view.getUint8(offset + 5) % ILDA_PALETTE.length;
        [r, g, b] = ILDA_PALETTE[colorIdx];
        offset += 6;
      } else if (formatCode === 4) {
        // Format 4: 3D + true color (10 bytes per point)
        x = view.getInt16(offset);
        y = view.getInt16(offset + 2);
        z = view.getInt16(offset + 4);
        statusByte = view.getUint8(offset + 6);
        b = view.getUint8(offset + 7);
        g = view.getUint8(offset + 8);
        r = view.getUint8(offset + 9);
        offset += 10;
      } else if (formatCode === 5) {
        // Format 5: 2D + true color (8 bytes per point)
        x = view.getInt16(offset);
        y = view.getInt16(offset + 2);
        statusByte = view.getUint8(offset + 4);
        b = view.getUint8(offset + 5);
        g = view.getUint8(offset + 6);
        r = view.getUint8(offset + 7);
        offset += 8;
      } else {
        // Unknown format, skip
        break;
      }

      points.push({
        x: x / 32767,
        y: y / 32767,
        z: z / 32767,
        r, g, b,
        blanking: (statusByte & 0x40) !== 0,
        lastPoint: (statusByte & 0x80) !== 0,
      });
    }

    frames.push({ name: name.trim(), companyName: companyName.trim(), pointCount, frameNumber, totalFrames, points });
  }

  return frames;
}

/**
 * Generate built-in ILDA-style vector patterns for logo/text projection
 */
export function generateTextPoints(text: string, scale = 0.08): ILDAPoint[] {
  const points: ILDAPoint[] = [];
  const charWidth = 0.06 * scale * 100;
  
  for (let i = 0; i < text.length; i++) {
    const baseX = (i - text.length / 2) * charWidth;
    // Simple vector font — just outline boxes for each character
    const corners = [
      { x: baseX, y: -0.5 * scale },
      { x: baseX + charWidth * 0.7, y: -0.5 * scale },
      { x: baseX + charWidth * 0.7, y: 0.5 * scale },
      { x: baseX, y: 0.5 * scale },
      { x: baseX, y: -0.5 * scale },
    ];
    corners.forEach((c, j) => {
      points.push({
        x: c.x, y: c.y, z: 0,
        r: 0, g: 255, b: 0,
        blanking: j === 0,
        lastPoint: j === corners.length - 1,
      });
    });
  }
  return points;
}

/**
 * Generate common ILDA projection shapes
 */
export function generateShape(shape: 'circle' | 'star' | 'heart' | 'logo', points = 64, scale = 1): ILDAPoint[] {
  const result: ILDAPoint[] = [];
  
  switch (shape) {
    case 'circle':
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        result.push({
          x: Math.cos(a) * scale * 0.5,
          y: Math.sin(a) * scale * 0.5,
          z: 0, r: 0, g: 255, b: 0,
          blanking: i === 0, lastPoint: i === points,
        });
      }
      break;
    case 'star':
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 0.5 * scale : 0.2 * scale;
        result.push({
          x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0,
          r: 255, g: 255, b: 0,
          blanking: i === 0, lastPoint: i === 10,
        });
      }
      break;
    case 'heart':
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3) * scale * 0.03;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale * 0.03;
        result.push({
          x, y, z: 0, r: 255, g: 0, b: 80,
          blanking: i === 0, lastPoint: i === points,
        });
      }
      break;
    default:
      // Simple logo placeholder — diamond
      const diamond = [
        { x: 0, y: 0.4 }, { x: 0.3, y: 0 }, { x: 0, y: -0.4 }, { x: -0.3, y: 0 }, { x: 0, y: 0.4 },
      ];
      diamond.forEach((p, i) => {
        result.push({
          x: p.x * scale, y: p.y * scale, z: 0,
          r: 0, g: 200, b: 255,
          blanking: i === 0, lastPoint: i === diamond.length - 1,
        });
      });
  }
  
  return result;
}
