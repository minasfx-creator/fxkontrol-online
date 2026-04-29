/**
 * ─── Pairing Audit Log ─────────────────────────────────────────────
 * Persistent (localStorage) log of every USB pairing attempt — success
 * AND failure. Used by the iOS-first USB pairing wizard to give the
 * operator (and field ops auditors) a paper trail of which physical
 * accessory was authorized, with what protocol, on which platform and
 * when.
 *
 * NEVER persists the SerialPort/USBDevice itself (browser doesn't allow
 * it). Capped at 100 entries with FIFO eviction.
 */
import { logger } from '@/lib/logger';
import type { Platform } from '@/lib/platformCapabilities';

const STORAGE_KEY = 'fxk:pairingAudit:v1';
const MAX_ENTRIES = 100;

export type PairingTransport =
  | 'webserial'
  | 'webusb'
  | 'capacitor-serial'
  | 'capacitor-ble'
  | 'webble';

export interface PairingAuditEntry {
  id: string;
  at: number; // epoch ms
  transport: PairingTransport;
  platform: Platform;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  label: string;
  manufacturer?: string;
  protocolKind: string;   // 'pbus' | 'enttec-pro' | 'enttec-open' | 'firing' | 'serial' | ...
  protocolLabel: string;  // human readable
  baudRate: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

function load(): PairingAuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PairingAuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.warn('[pairingAudit] load failed', e);
    return [];
  }
}

function save(entries: PairingAuditEntry[]): void {
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    logger.warn('[pairingAudit] save failed', e);
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pair-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordPairing(
  entry: Omit<PairingAuditEntry, 'id' | 'at'>,
): PairingAuditEntry {
  const full: PairingAuditEntry = { ...entry, id: genId(), at: Date.now() };
  const all = load();
  all.push(full);
  save(all);
  logger.info(
    `[pairingAudit] ${full.success ? '✓' : '✗'} ${full.label} (${full.protocolKind}) via ${full.transport}`,
  );
  return full;
}

export function getRecentPairings(limit = 20): PairingAuditEntry[] {
  return load().slice(-limit).reverse();
}

export function clearPairings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
