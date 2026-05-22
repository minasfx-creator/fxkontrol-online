/**
 * UsbPairingWizard — iOS-first guided USB authorization flow.
 *
 * Five-step wizard:
 *   1. Welcome   — platform detection, contextual routing
 *   2. Cable     — physical checklist with MFi/data-cable hints
 *   3. Authorize — Web Serial requestPort() with actionable error hints
 *   4. Classify  — pick protocol (auto-suggested by VID/PID)
 *   5. Success   — audit log entry summary + CTAs
 *
 * Persists every authorization (success + failure) to pairingAuditLog
 * and to portRegistry so the operator only confirms once per browser.
 */
import { useReducer, useCallback } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WizardStepIndicator } from '@/components/pairing/WizardStepIndicator';
import { WelcomeStep } from '@/components/pairing/WelcomeStep';
import { CableCheckStep } from '@/components/pairing/CableCheckStep';
import { AuthorizeStep } from '@/components/pairing/AuthorizeStep';
import { ClassifyStep } from '@/components/pairing/ClassifyStep';
import { SuccessStep } from '@/components/pairing/SuccessStep';
import { recordPairing, type PairingAuditEntry, type PairingTransport } from '@/lib/pairingAuditLog';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';
import { portRegistry, keyFor } from '@/core/discovery/portRegistry';
import { USBConnectionError, type USBDeviceProfile } from '@/lib/usbEngine';
import { logger } from '@/lib/logger';

export interface AuthorizedDevice {
  port: unknown;          // SerialPort (kept opaque)
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  manufacturer?: string;
  label: string;
  transport: PairingTransport;
}

type Step = 'welcome' | 'cable' | 'authorize' | 'classify' | 'success';

interface State {
  step: Step;
  device: AuthorizedDevice | null;
  entry: PairingAuditEntry | null;
}

type Action =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'AUTHORIZED'; device: AuthorizedDevice }
  | { type: 'CONFIRMED'; entry: PairingAuditEntry }
  | { type: 'RESET' };

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Início' },
  { key: 'cable', label: 'Cabo' },
  { key: 'authorize', label: 'Autorizar' },
  { key: 'classify', label: 'Protocolo' },
  { key: 'success', label: 'Pronto' },
];

function nextStep(s: Step): Step {
  const i = STEPS.findIndex(x => x.key === s);
  return STEPS[Math.min(i + 1, STEPS.length - 1)].key;
}
function prevStep(s: Step): Step {
  const i = STEPS.findIndex(x => x.key === s);
  return STEPS[Math.max(i - 1, 0)].key;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT':
      return { ...state, step: nextStep(state.step) };
    case 'BACK':
      return { ...state, step: prevStep(state.step) };
    case 'AUTHORIZED':
      return { ...state, device: action.device, step: 'classify' };
    case 'CONFIRMED':
      return { ...state, entry: action.entry, step: 'success' };
    case 'RESET':
      return { step: 'welcome', device: null, entry: null };
  }
}

export default function UsbPairingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, {
    step: 'welcome',
    device: null,
    entry: null,
  });

  const currentIndex = STEPS.findIndex(s => s.key === state.step);

  const handleAuthorized = useCallback((device: AuthorizedDevice) => {
    dispatch({ type: 'AUTHORIZED', device });
  }, []);

  const handleAuthError = useCallback((err: USBConnectionError) => {
    const caps = detectPlatformCapabilities();
    recordPairing({
      transport: 'webserial',
      platform: caps.platform,
      label: 'Pareamento abortado',
      protocolKind: 'unknown',
      protocolLabel: 'Não classificado',
      baudRate: 0,
      success: false,
      errorCode: err.code,
      errorMessage: err.message,
    });
  }, []);

  const handleConfirm = useCallback((profile: USBDeviceProfile) => {
    if (!state.device) return;
    const caps = detectPlatformCapabilities();
    const dev = state.device;

    // Persist to portRegistry so future sessions skip the prompt.
    if (dev.vendorId !== undefined && dev.productId !== undefined) {
      try {
        const key = keyFor({
          vendorId: dev.vendorId,
          productId: dev.productId,
          serialNumber: dev.serialNumber,
        });
        portRegistry.upsert({
          key,
          vendorId: dev.vendorId,
          productId: dev.productId,
          lastLabel: profile.label,
          profileId: profile.label,
          operatorConfirmedGeneric: true,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      } catch (e) {
        logger.warn('[UsbPairingWizard] portRegistry.upsert failed', e);
      }
    }

    const entry = recordPairing({
      transport: dev.transport,
      platform: caps.platform,
      vendorId: dev.vendorId,
      productId: dev.productId,
      serialNumber: dev.serialNumber,
      label: dev.label,
      manufacturer: dev.manufacturer,
      protocolKind: profile.type,
      protocolLabel: profile.label,
      baudRate: profile.baudRate,
      success: true,
    });
    dispatch({ type: 'CONFIRMED', entry });
  }, [state.device]);

  return (
    <div
      className="min-h-dvh bg-background text-foreground flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/20 backdrop-blur sticky top-0 z-10">
        {state.step === 'welcome' || state.step === 'success' ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: 'BACK' })}
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted/40 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          USB Pairing
        </h1>
        <div className="w-10" />
      </header>

      <WizardStepIndicator steps={STEPS} currentIndex={currentIndex} />

      <main className="flex-1 px-4 pb-8 max-w-md w-full mx-auto">
        {state.step === 'welcome' && (
          <WelcomeStep onContinue={() => dispatch({ type: 'NEXT' })} />
        )}
        {state.step === 'cable' && (
          <CableCheckStep
            onBack={() => dispatch({ type: 'BACK' })}
            onContinue={() => dispatch({ type: 'NEXT' })}
          />
        )}
        {state.step === 'authorize' && (
          <AuthorizeStep
            onBack={() => dispatch({ type: 'BACK' })}
            onAuthorized={handleAuthorized}
            onError={handleAuthError}
          />
        )}
        {state.step === 'classify' && state.device && (
          <ClassifyStep
            device={state.device}
            onBack={() => dispatch({ type: 'BACK' })}
            onConfirm={handleConfirm}
          />
        )}
        {state.step === 'success' && state.entry && (
          <SuccessStep
            entry={state.entry}
            onPairAnother={() => dispatch({ type: 'RESET' })}
          />
        )}
      </main>
    </div>
  );
}
