// Web Serial API & WebUSB API type declarations
// These APIs are available in Chrome/Edge/Opera but not in standard TS lib

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: ParityType;
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

type ParityType = 'none' | 'even' | 'odd' | 'mark' | 'space';

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly manufacturerName?: string;
  readonly serialNumber?: string;
  readonly opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
}

interface USBOutTransferResult {
  readonly bytesWritten: number;
  readonly status: 'ok' | 'stall' | 'babble';
}

interface USBInTransferResult {
  readonly data?: DataView;
  readonly status: 'ok' | 'stall' | 'babble';
}

interface USB {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

declare global {
  interface Navigator {
    readonly serial: Serial;
    readonly usb: USB;
  }
}

export {};
