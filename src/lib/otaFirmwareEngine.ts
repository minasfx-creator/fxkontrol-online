/**
 * OTA Firmware Update Engine
 * Real WebSerial binary firmware upload to FireOne/PBUS modules.
 * Simulation paths removed — production cutover.
 */

export type OTATarget = 'fireone' | 'pbus';
export type OTAStatus = 'idle' | 'validating' | 'erasing' | 'uploading' | 'verifying' | 'rebooting' | 'done' | 'error';

export interface OTAProgress {
  status: OTAStatus;
  percent: number;       // 0–100
  bytesWritten: number;
  totalBytes: number;
  currentBlock: number;
  totalBlocks: number;
  checksumOk: boolean | null;
  errorMessage?: string;
  elapsedMs: number;
  estimatedRemainingMs: number;
}

export interface FirmwareInfo {
  fileName: string;
  fileSize: number;
  target: OTATarget;
  version?: string;
  checksum: string;   // SHA-256 hex
  data: Uint8Array;
}

const OTA_BLOCK_SIZE = 256; // bytes per write block
const OTA_HEADER_MAGIC_FIREONE = 0x464F; // 'FO'
const OTA_HEADER_MAGIC_PBUS = 0x5042;   // 'PB'

/**
 * Parse and validate a firmware binary file
 */
export async function parseFirmwareFile(file: File): Promise<FirmwareInfo> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  if (data.length < 64) {
    throw new Error('Firmware file too small (min 64 bytes)');
  }
  if (data.length > 2 * 1024 * 1024) {
    throw new Error('Firmware file too large (max 2MB)');
  }

  // Detect target from magic bytes or filename
  const magic = (data[0] << 8) | data[1];
  let target: OTATarget;
  if (magic === OTA_HEADER_MAGIC_FIREONE || file.name.toLowerCase().includes('fireone')) {
    target = 'fireone';
  } else if (magic === OTA_HEADER_MAGIC_PBUS || file.name.toLowerCase().includes('pbus')) {
    target = 'pbus';
  } else {
    target = 'fireone';
  }

  const major = data[2] || 0;
  const minor = data[3] || 0;
  const patch = data[4] || 0;
  const version = `${major}.${minor}.${patch}`;

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const checksum = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    fileName: file.name,
    fileSize: data.length,
    target,
    version,
    checksum,
    data,
  };
}

export type OTAProgressCallback = (progress: OTAProgress) => void;

/**
 * Real OTA upload via WebSerial port
 * Protocol: [CMD_OTA_START][addr][totalLen:4] then [CMD_OTA_BLOCK][blockIdx:2][data:256] per block
 */
export async function realOTAUpdate(
  port: any, // SerialPort from Web Serial API
  firmware: FirmwareInfo,
  moduleAddr: number,
  onProgress: OTAProgressCallback,
  abortSignal?: AbortSignal,
): Promise<void> {
  const totalBlocks = Math.ceil(firmware.fileSize / OTA_BLOCK_SIZE);
  const t0 = performance.now();

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) throw new Error('Serial port not writable/readable');

  try {
    onProgress({ status: 'validating', percent: 2, bytesWritten: 0, totalBytes: firmware.fileSize, currentBlock: 0, totalBlocks, checksumOk: null, elapsedMs: 0, estimatedRemainingMs: 0 });

    const startCmd = new Uint8Array([
      0xF0,
      moduleAddr & 0xFF,
      firmware.target === 'fireone' ? 0x01 : 0x02,
      (firmware.fileSize >> 24) & 0xFF,
      (firmware.fileSize >> 16) & 0xFF,
      (firmware.fileSize >> 8) & 0xFF,
      firmware.fileSize & 0xFF,
    ]);
    await writer.write(startCmd);

    const ackResult = await Promise.race([
      reader.read(),
      sleep(5000).then(() => { throw new Error('OTA start timeout — no ACK from module'); }),
    ]);
    if (ackResult && 'value' in ackResult) {
      const ack = ackResult.value;
      if (!ack || ack[0] !== 0xF1) throw new Error('Module rejected OTA start');
    }

    onProgress({ status: 'erasing', percent: 8, bytesWritten: 0, totalBytes: firmware.fileSize, currentBlock: 0, totalBlocks, checksumOk: null, elapsedMs: performance.now() - t0, estimatedRemainingMs: 0 });
    await sleep(500);

    for (let block = 0; block < totalBlocks; block++) {
      if (abortSignal?.aborted) {
        await writer.write(new Uint8Array([0xFE, moduleAddr]));
        throw new Error('OTA cancelled');
      }

      const offset = block * OTA_BLOCK_SIZE;
      const blockData = firmware.data.slice(offset, offset + OTA_BLOCK_SIZE);
      const paddedBlock = new Uint8Array(OTA_BLOCK_SIZE);
      paddedBlock.set(blockData);

      const frame = new Uint8Array(3 + OTA_BLOCK_SIZE);
      frame[0] = 0xF2;
      frame[1] = (block >> 8) & 0xFF;
      frame[2] = block & 0xFF;
      frame.set(paddedBlock, 3);

      await writer.write(frame);

      if (block % 8 === 7 || block === totalBlocks - 1) {
        const blockAck = await Promise.race([
          reader.read(),
          sleep(3000).then(() => { throw new Error(`Block ACK timeout at block ${block}`); }),
        ]);
        if (blockAck && 'value' in blockAck && blockAck.value?.[0] === 0xFD) {
          throw new Error(`Module reported write error at block ${block}`);
        }
      }

      const bytesWritten = Math.min((block + 1) * OTA_BLOCK_SIZE, firmware.fileSize);
      const elapsed = performance.now() - t0;
      const rate = bytesWritten / (elapsed / 1000);
      const remaining = (firmware.fileSize - bytesWritten) / rate * 1000;

      onProgress({
        status: 'uploading',
        percent: Math.round((bytesWritten / firmware.fileSize) * 80) + 10,
        bytesWritten,
        totalBytes: firmware.fileSize,
        currentBlock: block + 1,
        totalBlocks,
        checksumOk: null,
        elapsedMs: elapsed,
        estimatedRemainingMs: remaining,
      });
    }

    onProgress({ status: 'verifying', percent: 92, bytesWritten: firmware.fileSize, totalBytes: firmware.fileSize, currentBlock: totalBlocks, totalBlocks, checksumOk: null, elapsedMs: performance.now() - t0, estimatedRemainingMs: 3000 });

    const checksumBytes = new Uint8Array(4);
    const checksumView = new DataView(checksumBytes.buffer);
    checksumView.setUint32(0, parseInt(firmware.checksum.slice(0, 8), 16));
    await writer.write(new Uint8Array([0xF3, moduleAddr, ...checksumBytes]));

    const verifyResult = await Promise.race([
      reader.read(),
      sleep(8000).then(() => { throw new Error('Checksum verification timeout'); }),
    ]);
    const checksumOk = verifyResult && 'value' in verifyResult && verifyResult.value?.[0] === 0xF4;
    if (!checksumOk) throw new Error('Firmware checksum mismatch — update failed');

    onProgress({ status: 'rebooting', percent: 98, bytesWritten: firmware.fileSize, totalBytes: firmware.fileSize, currentBlock: totalBlocks, totalBlocks, checksumOk: true, elapsedMs: performance.now() - t0, estimatedRemainingMs: 2000 });
    await writer.write(new Uint8Array([0xF5, moduleAddr]));
    await sleep(2000);

    onProgress({
      status: 'done',
      percent: 100,
      bytesWritten: firmware.fileSize,
      totalBytes: firmware.fileSize,
      currentBlock: totalBlocks,
      totalBlocks,
      checksumOk: true,
      elapsedMs: performance.now() - t0,
      estimatedRemainingMs: 0,
    });
  } finally {
    writer.releaseLock();
    reader.releaseLock();
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
