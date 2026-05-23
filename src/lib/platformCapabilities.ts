/**
 * ─── Platform Capabilities Detector ────────────────────────────────
 * Identifica em qual plataforma/runtime o app está rodando e quais APIs
 * de hardware estão DE FATO disponíveis. Usado pelo banner de
 * diagnóstico de conexão para dar feedback acionável ao operador
 * (especialmente no iPhone, onde Safari PWA bloqueia WebUSB/Web Serial
 * e o caminho viável é o build nativo Capacitor + plugin serial).
 *
 * 100% read-only. Nenhum side effect — pura inspeção de `navigator` e
 * `window`. Cacheia o resultado por sessão.
 */

export type Platform =
  | 'ios-safari-pwa'      // Safari mobile / PWA standalone — sem WebUSB/Serial/BLE
  | 'ios-capacitor'        // Build nativo Capacitor no iPhone/iPad
  | 'android-chrome'       // Chrome Android — WebUSB/Serial/BLE OK
  | 'android-capacitor'    // Build nativo Capacitor no Android
  | 'desktop-chrome'       // Chrome/Edge desktop — full support
  | 'desktop-firefox'      // Firefox desktop — só BLE (sem Serial/USB)
  | 'desktop-safari'       // Safari desktop — sem suporte
  | 'unknown';

export type RecommendedAction =
  | 'install-native-app'   // PWA Safari → ir buscar o app nativo
  | 'install-cap-plugin'   // Capacitor sem plugin serial
  | 'use-supported-browser'// Firefox/Safari desktop
  | 'request-permission'   // Ambiente OK, só falta o gesto do usuário
  | 'all-good';            // Tudo OK

export interface PlatformCapabilities {
  platform: Platform;
  webSerial: boolean;
  webUsb: boolean;
  webBle: boolean;
  capacitorNative: boolean;
  capacitorSerial: boolean;
  capacitorBle: boolean;
  recommendation: RecommendedAction;
  hint: string;
  recommendedTransports: Array<'webserial' | 'webusb' | 'webble' | 'capacitor-serial' | 'capacitor-ble'>;
}

let _cached: PlatformCapabilities | null = null;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  const isCapacitor = !!cap?.isNativePlatform?.();
  const capPlatform = cap?.getPlatform?.();

  if (isCapacitor) {
    if (capPlatform === 'ios') return 'ios-capacitor';
    if (capPlatform === 'android') return 'android-capacitor';
  }

  // iOS detection (inclui iPad recente que reporta MacIntel)
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (isIOS) return 'ios-safari-pwa';

  // Android non-Capacitor
  if (/Android/.test(ua)) return 'android-chrome';

  // Desktop
  if (/Firefox\//.test(ua)) return 'desktop-firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'desktop-safari';
  if (/Chrome\/|Edg\//.test(ua)) return 'desktop-chrome';

  return 'unknown';
}

function detectCapacitorSerialPlugin(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.Plugins) return false;
  // Conhecidos: @capacitor-community/serial → Plugins.Serial
  // cordova-plugin-usbserial → Plugins.UsbSerial (ou window.serial)
  return 'Serial' in cap.Plugins || 'UsbSerial' in cap.Plugins;
}

function detectCapacitorBlePlugin(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.Plugins) return false;
  return 'BluetoothLe' in cap.Plugins;
}

function classify(platform: Platform, caps: Omit<PlatformCapabilities, 'platform' | 'recommendation' | 'hint' | 'recommendedTransports'>): {
  recommendation: RecommendedAction;
  hint: string;
  recommendedTransports: PlatformCapabilities['recommendedTransports'];
} {
  // iOS Safari PWA — bloqueio raiz
  if (platform === 'ios-safari-pwa') {
    return {
      recommendation: 'install-native-app',
      hint:
        'iOS Safari não permite acesso direto a USB/Bluetooth. Instale o app FX KONTROL nativo (build Capacitor) com adaptador Lightning/USB-C MFi para conectar hardware físico.',
      recommendedTransports: [],
    };
  }

  // Capacitor sem plugin serial
  if ((platform === 'ios-capacitor' || platform === 'android-capacitor') && !caps.capacitorSerial) {
    return {
      recommendation: 'install-cap-plugin',
      hint:
        'App nativo detectado, mas o plugin serial não está instalado. Execute "npm install @capacitor-community/serial && npx cap sync ios" e reinstale o app.',
      recommendedTransports: caps.capacitorBle ? ['capacitor-ble'] : [],
    };
  }

  // Capacitor com plugin
  if (platform === 'ios-capacitor' || platform === 'android-capacitor') {
    const t: PlatformCapabilities['recommendedTransports'] = [];
    if (caps.capacitorSerial) t.push('capacitor-serial');
    if (caps.capacitorBle) t.push('capacitor-ble');
    return {
      recommendation: 'all-good',
      hint:
        'App nativo pronto. Conecte o adaptador USB MFi (Lightning Camera Adapter ou USB-C OTG) e clique em CONECTAR para autorizar o dispositivo.',
      recommendedTransports: t,
    };
  }

  // Desktop Firefox / Safari
  if (platform === 'desktop-firefox') {
    return {
      recommendation: 'use-supported-browser',
      hint:
        'Firefox suporta apenas Web Bluetooth (e parcialmente). Para conexão USB Serial use Chrome, Edge ou Opera.',
      recommendedTransports: caps.webBle ? ['webble'] : [],
    };
  }
  if (platform === 'desktop-safari') {
    return {
      recommendation: 'use-supported-browser',
      hint:
        'Safari desktop não suporta WebUSB/Web Serial/Web Bluetooth. Use Chrome, Edge ou Opera para conexão de hardware.',
      recommendedTransports: [],
    };
  }

  // Desktop Chrome / Android Chrome — caminho feliz
  const t: PlatformCapabilities['recommendedTransports'] = [];
  if (caps.webSerial) t.push('webserial');
  if (caps.webUsb) t.push('webusb');
  if (caps.webBle) t.push('webble');
  return {
    recommendation: t.length > 0 ? 'request-permission' : 'use-supported-browser',
    hint:
      t.length > 0
        ? 'Pronto para conectar. Clique em CONECTAR e selecione o dispositivo na janela do navegador.'
        : 'Nenhuma API de hardware disponível neste navegador. Verifique se o site está sob HTTPS.',
    recommendedTransports: t,
  };
}

export function detectPlatformCapabilities(force = false): PlatformCapabilities {
  if (_cached && !force) return _cached;

  const platform = detectPlatform();
  const webSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
  const webUsb = typeof navigator !== 'undefined' && 'usb' in navigator;
  const webBle = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const capacitorNative =
    typeof window !== 'undefined' &&
    !!(window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.isNativePlatform?.();
  const capacitorSerial = capacitorNative && detectCapacitorSerialPlugin();
  const capacitorBle = capacitorNative && detectCapacitorBlePlugin();

  const partial = { webSerial, webUsb, webBle, capacitorNative, capacitorSerial, capacitorBle };
  const cls = classify(platform, partial);

  _cached = {
    platform,
    ...partial,
    ...cls,
  };
  return _cached;
}

export function platformLabel(p: Platform): string {
  const map: Record<Platform, string> = {
    'ios-safari-pwa': 'iOS Safari / PWA',
    'ios-capacitor': 'iPhone (App Nativo)',
    'android-chrome': 'Android Chrome',
    'android-capacitor': 'Android (App Nativo)',
    'desktop-chrome': 'Desktop Chrome/Edge',
    'desktop-firefox': 'Desktop Firefox',
    'desktop-safari': 'Desktop Safari',
    unknown: 'Plataforma desconhecida',
  };
  return map[p];
}
