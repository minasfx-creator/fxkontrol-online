/**
 * transportAvailability — wrapper iOS-aware sobre platformCapabilities.
 * ─────────────────────────────────────────────────────────────────────────────
 * Centraliza a decisão "esse botão de transporte deve ficar habilitado?" e
 * "qual mensagem orientativa mostrar?". Resolve o gap de UX onde botões
 * BLE/USB ficavam clicáveis em iOS Safari (Apple bloqueia WebUSB/Web Serial/
 * Web Bluetooth) e a única feedback era um erro genérico após o clique.
 *
 * Roadmap brief (d1-15): "Compatibilidade Desktop Chrome / Android Chrome /
 * iPhone Safari / iOS Capacitor mapeada" + "Mensagens de iPhone revisadas
 * para transportes indisponíveis" — esta é a fonte canônica disso.
 *
 * 100% read-only / pure. Reutiliza o cache de detectPlatformCapabilities.
 */

import { detectPlatformCapabilities, type PlatformCapabilities } from './platformCapabilities';

export type TransportKind = 'webserial' | 'webusb' | 'webble' | 'artnet';

export interface TransportAvailability {
  /** Pode ser tentado nesta plataforma (botão NÃO disabled). */
  available: boolean;
  /** Texto curto p/ tooltip / aria-label quando indisponível. */
  reason: string | null;
  /** Texto detalhado p/ banner / modal de explicação. */
  longReason: string | null;
  /** Onde direcionar o usuário quando indisponível: rota interna ou null. */
  fixRoute: string | null;
  /** Label curto da CTA de fix ("Ver compatibilidade", "Instalar app", etc.). */
  fixLabel: string | null;
}

const AVAILABLE: TransportAvailability = {
  available: true,
  reason: null,
  longReason: null,
  fixRoute: null,
  fixLabel: null,
};

/* iOS Safari = bloqueio raiz de Apple. Mensagem única, não-acusatória. */
const IOS_SAFARI_BLOCK: TransportAvailability = {
  available: false,
  reason: 'Indisponível no Safari (iPhone/iPad)',
  longReason:
    'iOS Safari não permite acesso direto a USB, Bluetooth ou serial — é uma limitação intencional da Apple. Use o app FX KONTROL nativo (Capacitor) ou um desktop Chrome/Edge/Opera.',
  fixRoute: '/ios-readiness',
  fixLabel: 'Ver compatibilidade',
};

const DESKTOP_SAFARI_BLOCK: TransportAvailability = {
  available: false,
  reason: 'Indisponível no Safari desktop',
  longReason:
    'Safari desktop não implementa WebUSB, Web Serial ou Web Bluetooth. Use Chrome, Edge ou Opera.',
  fixRoute: '/ios-readiness',
  fixLabel: 'Ver compatibilidade',
};

const FIREFOX_BLE_ONLY: TransportAvailability = {
  available: false,
  reason: 'Indisponível no Firefox',
  longReason:
    'Firefox suporta apenas Web Bluetooth parcial — sem WebUSB nem Web Serial. Use Chrome, Edge ou Opera para conexão USB.',
  fixRoute: '/ios-readiness',
  fixLabel: 'Ver compatibilidade',
};

const CAP_PLUGIN_MISSING: TransportAvailability = {
  available: false,
  reason: 'Plugin nativo não instalado',
  longReason:
    'App nativo detectado, mas o plugin serial não foi compilado junto. Reinstale o build com @capacitor-community/serial.',
  fixRoute: '/ios-readiness',
  fixLabel: 'Como compilar',
};

const NO_HTTPS: TransportAvailability = {
  available: false,
  reason: 'APIs requerem HTTPS',
  longReason:
    'WebUSB, Web Serial e Web Bluetooth só funcionam em contexto seguro (HTTPS). O app está em HTTP.',
  fixRoute: null,
  fixLabel: null,
};

/**
 * Decide a disponibilidade de um transporte específico para a plataforma atual.
 * Use no `disabled` + `title` (tooltip) de cada botão de conexão.
 */
export function getTransportAvailability(
  kind: TransportKind,
  caps: PlatformCapabilities = detectPlatformCapabilities(),
): TransportAvailability {
  // ArtNet roda sobre UDP/HTTP bridge — não é gated por API de browser.
  if (kind === 'artnet') return AVAILABLE;

  const platform = caps.platform;

  // iOS Safari PWA — bloqueio raiz para todos os transportes Web.
  if (platform === 'ios-safari-pwa') return IOS_SAFARI_BLOCK;

  // Desktop Safari — sem nenhuma das APIs.
  if (platform === 'desktop-safari') return DESKTOP_SAFARI_BLOCK;

  // Firefox — bloqueia USB/Serial; BLE parcial (deixa passar e usuário descobre).
  if (platform === 'desktop-firefox' && (kind === 'webserial' || kind === 'webusb')) {
    return FIREFOX_BLE_ONLY;
  }

  // Capacitor nativo sem plugin — válido para qualquer kind serial/usb.
  if (
    (platform === 'ios-capacitor' || platform === 'android-capacitor') &&
    (kind === 'webserial' || kind === 'webusb') &&
    !caps.capacitorSerial
  ) {
    return CAP_PLUGIN_MISSING;
  }

  // Checagem fim-de-linha pela API correspondente.
  switch (kind) {
    case 'webserial':
      if (caps.webSerial || caps.capacitorSerial) return AVAILABLE;
      break;
    case 'webusb':
      if (caps.webUsb || caps.capacitorSerial) return AVAILABLE;
      break;
    case 'webble':
      if (caps.webBle || caps.capacitorBle) return AVAILABLE;
      break;
  }

  // Não disponível e não cobrimos um caso específico → contexto inseguro.
  if (typeof window !== 'undefined' && window.location?.protocol === 'http:') return NO_HTTPS;

  return {
    available: false,
    reason: 'API indisponível neste navegador',
    longReason: 'Esta API de hardware não está disponível no navegador atual.',
    fixRoute: '/ios-readiness',
    fixLabel: 'Ver compatibilidade',
  };
}

/** True se NENHUM transporte físico está disponível (ex.: iOS Safari puro). */
export function hasAnyHardwareTransport(
  caps: PlatformCapabilities = detectPlatformCapabilities(),
): boolean {
  return (
    caps.webSerial || caps.webUsb || caps.webBle || caps.capacitorSerial || caps.capacitorBle
  );
}
