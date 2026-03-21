/**
 * NFC Engine — Web NFC for instant device pairing and configuration
 * Tap-to-pair, tap-to-configure, tap-to-arm workflows.
 * Web NFC: Android Chrome only. iOS: requires Capacitor native plugin.
 */

export interface NFCDeviceRecord {
  deviceType: 'c16' | 'x4' | 'pyromote' | 'cflamer' | 'dmx-node' | 'custom';
  address: number;
  band: '433M' | '868M' | 'dual';
  channelMap: number[];
  customerId?: string;
  firmwareVersion?: string;
  serialNumber?: string;
}

export interface NFCScanResult {
  timestamp: number;
  serialNumber: string | null;
  records: NFCDeviceRecord[];
  raw: string;
}

export function isWebNFCSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export async function startNFCScan(
  onRead: (result: NFCScanResult) => void,
  onError?: (error: Error) => void
): Promise<{ stop: () => void }> {
  if (!isWebNFCSupported()) {
    throw new Error('Web NFC não suportado. Use Chrome no Android ou o app nativo iOS.');
  }

  const NDEFReaderClass = (window as any).NDEFReader;
  const reader = new NDEFReaderClass();
  const controller = new AbortController();

  reader.addEventListener('reading', ({ serialNumber, message }: any) => {
    const records: NFCDeviceRecord[] = [];
    let raw = '';

    for (const record of message.records) {
      if (record.recordType === 'text') {
        const decoder = new TextDecoder(record.encoding || 'utf-8');
        const text = decoder.decode(record.data);
        raw += text;

        try {
          const parsed = JSON.parse(text);
          if (parsed.deviceType) {
            records.push(parsed as NFCDeviceRecord);
          }
        } catch {
          // Try key=value format: type=c16,addr=5,band=dual
          const config = parseKeyValue(text);
          if (config) records.push(config);
        }
      }
    }

    onRead({
      timestamp: Date.now(),
      serialNumber: serialNumber || null,
      records,
      raw,
    });
  });

  reader.addEventListener('readingerror', () => {
    onError?.(new Error('Erro ao ler tag NFC'));
  });

  await reader.scan({ signal: controller.signal });

  return {
    stop: () => controller.abort(),
  };
}

export async function writeNFCConfig(config: NFCDeviceRecord): Promise<void> {
  if (!isWebNFCSupported()) {
    throw new Error('Web NFC não suportado');
  }

  const NDEFReaderClass = (window as any).NDEFReader;
  const writer = new NDEFReaderClass();

  await writer.write({
    records: [
      {
        recordType: 'text',
        data: JSON.stringify(config),
        lang: 'en',
      },
    ],
  });
}

function parseKeyValue(text: string): NFCDeviceRecord | null {
  const parts = text.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=').map(s => s.trim());
    if (key && val) acc[key.toLowerCase()] = val;
    return acc;
  }, {} as Record<string, string>);

  if (!parts.type && !parts.devicetype) return null;

  return {
    deviceType: (parts.type || parts.devicetype || 'custom') as NFCDeviceRecord['deviceType'],
    address: parseInt(parts.addr || parts.address || '1', 10),
    band: (parts.band || 'dual') as NFCDeviceRecord['band'],
    channelMap: (parts.channels || parts.channelmap || '')
      .split(';')
      .filter(Boolean)
      .map(Number),
    serialNumber: parts.sn || parts.serial || undefined,
    firmwareVersion: parts.fw || parts.firmware || undefined,
  };
}

export function buildArmNFCPayload(moduleAddress: number, verifyCode: string): NFCDeviceRecord {
  return {
    deviceType: 'custom',
    address: moduleAddress,
    band: 'dual',
    channelMap: [],
    customerId: verifyCode,
  };
}
