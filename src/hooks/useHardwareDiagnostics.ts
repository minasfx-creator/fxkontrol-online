/**
 * useHardwareDiagnostics — Painel de diagnóstico de conexão.
 *
 * Centraliza:
 *  - Capability detection (plataforma, APIs disponíveis, plugins Capacitor)
 *  - Snapshot de portas autorizadas vs descobertas
 *  - Classificação do problema atual (causa raiz + ação recomendada)
 *
 * Read-only — não inicia I/O. Re-avalia sob demanda via `refresh()`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  detectPlatformCapabilities,
  platformLabel,
  type PlatformCapabilities,
} from '@/lib/platformCapabilities';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import { portRegistry } from '@/core/discovery/portRegistry';

export interface HardwareDiagnostics {
  capabilities: PlatformCapabilities;
  platformDisplay: string;
  authorizedCount: number;       // portas com permissão concedida (webserial+webusb)
  discoveredCount: number;       // dispositivos vistos no scan atual
  persistedCount: number;        // entradas no portRegistry (memória de longo prazo)
  hasAnyTransport: boolean;
  rootCause: string;
  fixSteps: string[];
  refresh: () => void;
}

function buildFixSteps(caps: PlatformCapabilities): string[] {
  switch (caps.recommendation) {
    case 'install-native-app':
      return [
        'Acesse a página /install no Safari para instruções.',
        'Faça o build nativo: git pull → npm install → npx cap add ios → npx cap sync.',
        'Conecte o adaptador Apple Lightning/USB-C Camera Adapter (MFi).',
        'Reinstale o app via Xcode no iPhone.',
      ];
    case 'install-cap-plugin':
      return [
        'No projeto local: npm install @capacitor-community/serial',
        'Sincronize: npx cap sync ios',
        'Adicione protocolos MFi no Info.plist (ver docs/iphone-usb-serial.md).',
        'Recompile e reinstale o app pelo Xcode.',
      ];
    case 'use-supported-browser':
      return [
        'Use Chrome, Edge ou Opera (desktop ou Android).',
        'Verifique se o site está sob HTTPS — APIs de hardware são bloqueadas em HTTP.',
        'Como alternativa, use Bluetooth se o dispositivo suportar.',
      ];
    case 'request-permission':
      return [
        'Conecte o cabo USB ao computador.',
        'Clique em CONECTAR e selecione o dispositivo na janela do navegador.',
        'Se o cabo não for reconhecido, troque por um cabo de DADOS (não apenas carga).',
        'Em Linux, garanta acesso à porta serial: sudo usermod -aG dialout $USER',
      ];
    case 'all-good':
      return [
        'Tudo pronto. Clique em CONECTAR e autorize o dispositivo.',
      ];
  }
}

function buildRootCause(caps: PlatformCapabilities): string {
  if (caps.platform === 'ios-safari-pwa') {
    return 'iOS Safari (PWA) bloqueia WebUSB, Web Serial e Web Bluetooth. Esta é uma limitação intencional da Apple — não há flag de browser para liberar.';
  }
  if ((caps.platform === 'ios-capacitor' || caps.platform === 'android-capacitor') && !caps.capacitorSerial) {
    return 'App nativo Capacitor detectado, porém o plugin serial não foi compilado junto.';
  }
  if (caps.platform === 'desktop-firefox') {
    return 'Firefox não implementa Web Serial nem WebUSB (apenas BLE parcial).';
  }
  if (caps.platform === 'desktop-safari') {
    return 'Safari desktop não implementa nenhuma das APIs de hardware do Web.';
  }
  if (!caps.webSerial && !caps.webUsb && !caps.webBle && !caps.capacitorSerial && !caps.capacitorBle) {
    return 'Nenhuma API de acesso a hardware está disponível. Verifique HTTPS e o navegador.';
  }
  return 'Ambiente compatível. Aguardando autorização de dispositivo via gesto do usuário.';
}

export function useHardwareDiagnostics(): HardwareDiagnostics {
  const [tick, setTick] = useState(0);
  const [counts, setCounts] = useState({ authorized: 0, discovered: 0, persisted: 0 });

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    const caps = detectPlatformCapabilities();
    let cancelled = false;
    (async () => {
      let authorized = 0;
      try {
        if (caps.webSerial) {
          const ports = await (navigator as unknown as { serial: { getPorts(): Promise<unknown[]> } }).serial.getPorts();
          authorized += ports.length;
        }
      } catch { /* ignore */ }
      try {
        if (caps.webUsb) {
          const devs = await (navigator as unknown as { usb: { getDevices(): Promise<unknown[]> } }).usb.getDevices();
          authorized += devs.length;
        }
      } catch { /* ignore */ }
      const discovered = unifiedDiscovery.getDevices().length;
      const persisted = portRegistry.list().length;
      if (!cancelled) setCounts({ authorized, discovered, persisted });
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const capabilities = detectPlatformCapabilities();
  const hasAnyTransport =
    capabilities.webSerial ||
    capabilities.webUsb ||
    capabilities.webBle ||
    capabilities.capacitorSerial ||
    capabilities.capacitorBle;

  return {
    capabilities,
    platformDisplay: platformLabel(capabilities.platform),
    authorizedCount: counts.authorized,
    discoveredCount: counts.discovered,
    persistedCount: counts.persisted,
    hasAnyTransport,
    rootCause: buildRootCause(capabilities),
    fixSteps: buildFixSteps(capabilities),
    refresh,
  };
}
