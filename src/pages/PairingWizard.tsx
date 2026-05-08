/**
 * PairingWizard — unified entry at /pairing/:transport.
 *
 * Replaces /pairing/usb and /pairing/ble with one configurable route
 * that picks the correct flow from the URL param. The actual step
 * components already live under src/components/pairing/{,ble} and are
 * reused untouched — this file is just the polymorphic shell so we
 * have a single canonical pairing route.
 *
 * Supported transports: 'usb' | 'ble'.
 * Unknown transports fall back to USB and log a warning.
 */
import { lazy, Suspense } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { logger } from '@/lib/logger';

const UsbPairingWizard = lazy(() => import('./UsbPairingWizard'));
const BlePairingWizard = lazy(() => import('./BlePairingWizard'));
const FireOneXL4PairingWizard = lazy(() => import('./FireOneXL4PairingWizard'));
const ShowvenM1PairingWizard = lazy(() => import('./ShowvenM1PairingWizard'));

export type PairingTransportParam = 'usb' | 'ble' | 'xl4' | 'm1';

const SUPPORTED: PairingTransportParam[] = ['usb', 'ble', 'xl4', 'm1'];

function isSupported(t: string | undefined): t is PairingTransportParam {
  return !!t && (SUPPORTED as string[]).includes(t);
}

function Fallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function PairingWizard() {
  const { transport } = useParams<{ transport: string }>();

  if (!isSupported(transport)) {
    logger.warn('[PairingWizard] unknown transport, redirecting to usb', { transport });
    return <Navigate to="/pairing/usb" replace />;
  }

  return (
    <Suspense fallback={<Fallback />}>
      {transport === 'm1'
        ? <ShowvenM1PairingWizard />
        : transport === 'xl4'
          ? <FireOneXL4PairingWizard />
          : transport === 'ble'
            ? <BlePairingWizard />
            : <UsbPairingWizard />}
    </Suspense>
  );
}
