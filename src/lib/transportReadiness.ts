/**
 * Transport Readiness — distinguishes supported / available / connected.
 *
 * - supported: API exists in this browser/platform (static capability)
 * - available: usable RIGHT NOW (secure context, not blocked by policy, etc.)
 * - connected: a live device session is active
 *
 * Mixing these states is the #1 source of "tried to connect, nothing happened"
 * field bugs. Always present them separately to the operator.
 */

export type TransportKey =
  | 'ble'
  | 'ble_lr'
  | 'webserial'
  | 'webusb'
  | 'websocket'
  | 'wifi_direct';

export type ReadinessReason =
  | 'ok'
  | 'api_missing'
  | 'insecure_context'
  | 'platform_blocked'
  | 'permission_denied'
  | 'no_device'
  | 'bridge_offline'
  | 'unknown';

export interface TransportReadiness {
  transport: TransportKey;
  supported: boolean;
  available: boolean;
  connected: boolean;
  reason: ReadinessReason;
  recommendation?: string;
  lastCheckedAt: number;
}

export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface ReadinessSnapshot {
  platform: Platform;
  isSecureContext: boolean;
  transports: Record<TransportKey, TransportReadiness>;
  takenAt: number;
}

const IOS_RECOMMENDATION =
  'Este transporte não é suportado no iOS/Safari. Use o app nativo ou conexão WSS (Wi-Fi AP seguro).';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Mac|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

function isSecure(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as any).isSecureContext === true) return true;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
}

function build(
  transport: TransportKey,
  supported: boolean,
  available: boolean,
  reason: ReadinessReason,
  recommendation?: string,
  connected = false,
): TransportReadiness {
  return {
    transport,
    supported,
    available,
    connected,
    reason,
    recommendation,
    lastCheckedAt: Date.now(),
  };
}

/**
 * Compute a fresh readiness snapshot. Cheap — call on demand
 * (mount, focus, after permission prompt, after bridge state change).
 */
export function detectReadiness(connectedTransports: Partial<Record<TransportKey, boolean>> = {}): ReadinessSnapshot {
  const platform = detectPlatform();
  const secure = isSecure();
  const nav: any = typeof navigator !== 'undefined' ? navigator : {};
  const hasBluetooth = Boolean(nav.bluetooth);
  const hasSerial = Boolean(nav.serial);
  const hasUSB = Boolean(nav.usb);
  const hasWebSocket = typeof WebSocket !== 'undefined';

  const transports: Record<TransportKey, TransportReadiness> = {
    ble: bleReadiness(hasBluetooth, secure, platform, !!connectedTransports.ble),
    ble_lr: bleReadiness(hasBluetooth, secure, platform, !!connectedTransports.ble_lr, true),
    webserial: webSerialReadiness(hasSerial, secure, platform, !!connectedTransports.webserial),
    webusb: webUSBReadiness(hasUSB, secure, platform, !!connectedTransports.webusb),
    websocket: websocketReadiness(hasWebSocket, secure, !!connectedTransports.websocket),
    wifi_direct: wifiDirectReadiness(hasWebSocket, secure, platform, !!connectedTransports.wifi_direct),
  };

  return { platform, isSecureContext: secure, transports, takenAt: Date.now() };
}

function bleReadiness(api: boolean, secure: boolean, platform: Platform, connected: boolean, longRange = false): TransportReadiness {
  const key: TransportKey = longRange ? 'ble_lr' : 'ble';
  if (platform === 'ios') return build(key, false, false, 'platform_blocked', IOS_RECOMMENDATION, connected);
  if (!api) return build(key, false, false, 'api_missing', 'Web Bluetooth não disponível neste navegador.', connected);
  if (!secure) return build(key, true, false, 'insecure_context', 'Web Bluetooth requer HTTPS.', connected);
  return build(key, true, true, 'ok', undefined, connected);
}

function webSerialReadiness(api: boolean, secure: boolean, platform: Platform, connected: boolean): TransportReadiness {
  if (platform === 'ios') return build('webserial', false, false, 'platform_blocked', IOS_RECOMMENDATION, connected);
  if (!api) return build('webserial', false, false, 'api_missing', 'Web Serial não disponível neste navegador.', connected);
  if (!secure) return build('webserial', true, false, 'insecure_context', 'Web Serial requer HTTPS.', connected);
  return build('webserial', true, true, 'ok', undefined, connected);
}

function webUSBReadiness(api: boolean, secure: boolean, platform: Platform, connected: boolean): TransportReadiness {
  if (platform === 'ios') return build('webusb', false, false, 'platform_blocked', IOS_RECOMMENDATION, connected);
  if (!api) return build('webusb', false, false, 'api_missing', 'WebUSB não disponível neste navegador.', connected);
  if (!secure) return build('webusb', true, false, 'insecure_context', 'WebUSB requer HTTPS.', connected);
  return build('webusb', true, true, 'ok', undefined, connected);
}

function websocketReadiness(api: boolean, secure: boolean, connected: boolean): TransportReadiness {
  if (!api) return build('websocket', false, false, 'api_missing', undefined, connected);
  if (!secure) return build('websocket', true, false, 'insecure_context', 'WSS requer HTTPS.', connected);
  return build('websocket', true, true, 'ok', undefined, connected);
}

function wifiDirectReadiness(api: boolean, secure: boolean, platform: Platform, connected: boolean): TransportReadiness {
  if (platform === 'ios') return build('wifi_direct', false, false, 'platform_blocked', IOS_RECOMMENDATION, connected);
  if (!api) return build('wifi_direct', false, false, 'api_missing', undefined, connected);
  if (!secure) return build('wifi_direct', true, false, 'insecure_context', 'Wi-Fi Direct requer HTTPS/WSS.', connected);
  return build('wifi_direct', true, true, 'ok', undefined, connected);
}

/** Structured diagnostic log — emit when readiness changes. */
export function logReadiness(snapshot: ReadinessSnapshot): void {
  for (const t of Object.values(snapshot.transports)) {
    // eslint-disable-next-line no-console
    console.info('[transport-readiness]', {
      scope: 'transport-readiness',
      transport: t.transport,
      supported: t.supported,
      available: t.available,
      connected: t.connected,
      reason: t.reason,
      platform: snapshot.platform,
      ts: t.lastCheckedAt,
    });
  }
}
