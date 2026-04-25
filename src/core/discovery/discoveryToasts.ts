/**
 * ─── Discovery Toasts ──────────────────────────────────────────────
 * User-facing feedback for the unified discovery pipeline. Emits
 * actionable toast messages whenever a transport is unsupported,
 * blocked by the operator/OS, or returns no devices.
 *
 * Used by `HardwareOverview` after each Scan / Deep Scan.
 */

import { toast } from 'sonner';
import { unifiedDiscovery } from './UnifiedDiscoveryService';
import type { DiscoveryTransport } from './types';

export type DiscoveryReportReason =
  | 'unsupported'
  | 'permission_denied'
  | 'empty'
  | 'error'
  | 'ok';

export interface DiscoveryTransportReport {
  transport: DiscoveryTransport;
  reason: DiscoveryReportReason;
  count: number;
  message?: string;
}

const TRANSPORT_LABEL: Record<DiscoveryTransport, string> = {
  webserial: 'Web Serial',
  webusb: 'WebUSB',
  webble: 'Web Bluetooth',
  'mdns-artnet': 'Art-Net (mDNS)',
};

const NEXT_STEP_UNSUPPORTED: Record<DiscoveryTransport, string> = {
  webserial: 'Use Chrome/Edge desktop ou Android. iOS/Safari não expõem Web Serial.',
  webusb: 'Disponível em Chrome/Edge desktop e Android. iOS/Safari não suportam WebUSB.',
  webble: 'Habilite chrome://flags/#enable-experimental-web-platform-features ou use Edge/Chrome 113+.',
  'mdns-artnet': 'Bridge artnet-bridge offline ou nenhum nó respondeu ao ArtPoll. Verifique rede/firewall UDP 6454.',
};

const NEXT_STEP_EMPTY: Record<DiscoveryTransport, string> = {
  webserial: 'Conecte o adaptador DMX e clique em "Conectar" para autorizar a porta serial.',
  webusb: 'Conecte o controlador e use "Pair" no painel USB para autorizar via WebUSB.',
  webble: 'Pareie o módulo BLE no painel Bluetooth (PyroMote / Tuya / Nordic UART).',
  'mdns-artnet': 'Garanta que os nós Art-Net estejam na mesma sub-rede e que o computador tenha IP 2.x.x.x ou 10.x.x.x.',
};

/** Build a per-transport report from the current unified snapshot. */
export function buildDiscoveryReports(): DiscoveryTransportReport[] {
  const support = unifiedDiscovery.supportMatrix();
  const transports: DiscoveryTransport[] = ['webserial', 'webusb', 'webble', 'mdns-artnet'];
  return transports.map(t => {
    if (!support[t]) {
      return { transport: t, reason: 'unsupported' as const, count: 0 };
    }
    const list = unifiedDiscovery.getByTransport(t);
    if (list.length === 0) {
      return { transport: t, reason: 'empty' as const, count: 0 };
    }
    return { transport: t, reason: 'ok' as const, count: list.length };
  });
}

/** Reasons considered "failed" and therefore retryable. */
const RETRYABLE_REASONS: DiscoveryReportReason[] = ['permission_denied', 'error', 'empty'];

/** Last set of reports emitted via `notifyDiscoveryReports` — used by Retry. */
let _lastReports: DiscoveryTransportReport[] = [];

export function getLastDiscoveryReports(): DiscoveryTransportReport[] {
  return _lastReports;
}

/**
 * Returns the transports that previously failed (permission denied, error,
 * or empty). `unsupported` is excluded — retrying it cannot change the
 * browser's capability matrix.
 */
export function getRetryableTransports(): DiscoveryTransport[] {
  return _lastReports
    .filter(r => RETRYABLE_REASONS.includes(r.reason))
    .map(r => r.transport);
}


/**
 * Show toasts for the supplied reports. `mode='light'` skips the empty
 * Art-Net warning (since the cheap scan does not poll the network).
 */
export function notifyDiscoveryReports(
  reports: DiscoveryTransportReport[],
  mode: 'light' | 'deep' = 'light',
): void {
  let anyFound = false;

  for (const r of reports) {
    const label = TRANSPORT_LABEL[r.transport];

    if (r.reason === 'unsupported') {
      toast.warning(`${label} indisponível`, {
        description: NEXT_STEP_UNSUPPORTED[r.transport],
        duration: 6000,
      });
      continue;
    }

    if (r.reason === 'permission_denied') {
      toast.error(`${label} bloqueado`, {
        description: r.message
          ?? 'Permissão negada pelo usuário ou política do navegador. Tente novamente e aceite o prompt.',
        duration: 7000,
      });
      continue;
    }

    if (r.reason === 'error') {
      toast.error(`${label}: erro na descoberta`, {
        description: r.message ?? 'Falha inesperada — veja o console para detalhes.',
        duration: 7000,
      });
      continue;
    }

    if (r.reason === 'empty') {
      // Art-Net only warns on deep scan (light scan skips network poll).
      if (r.transport === 'mdns-artnet' && mode === 'light') continue;
      toast(`${label}: nenhum dispositivo`, {
        description: NEXT_STEP_EMPTY[r.transport],
        duration: 5500,
      });
      continue;
    }

    if (r.reason === 'ok') {
      anyFound = true;
    }
  }

  if (anyFound) {
    const total = reports
      .filter(r => r.reason === 'ok')
      .reduce((sum, r) => sum + r.count, 0);
    toast.success(`Descoberta concluída — ${total} dispositivo${total === 1 ? '' : 's'}`, {
      duration: 3500,
    });
  }
}
