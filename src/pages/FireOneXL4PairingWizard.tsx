/**
 * FireOneXL4PairingWizard — guided pairing for the FireOne XL4+ master
 * controller (XLII+/XL4-3/XL4+ family) over USB-serial.
 *
 * Five steps:
 *   1. Welcome  — scope + WebSerial readiness
 *   2. Cable    — physical checklist (reuses the iOS-first CableCheckStep)
 *   3. Baud     — 9600 / 19200 / 38400 picker
 *   4. Handshake — open port, send IDENTIFY, validate firmware ≥ 5.00
 *   5. Success  — show firmware/addr/igniter summary
 *
 * Read-only: NEVER sends ARM or FIRE. All operational commands go through
 * uiCommandGateway from the operator console.
 *
 * On success:
 *   • portRegistry.upsert({ profileId: 'fireone-xl4' }) so the device is
 *     auto-classified next session.
 *   • pairingAuditLog.recordPairing(success).
 *
 * On any failure: pairingAuditLog.recordPairing(failure). Registry is
 * never touched on failure (honest hardware contract).
 */
import { useCallback, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Flame } from 'lucide-react';
import { WizardStepIndicator } from '@/components/pairing/WizardStepIndicator';
import { CableCheckStep } from '@/components/pairing/CableCheckStep';
import { XL4WelcomeStep } from '@/components/pairing/xl4/XL4WelcomeStep';
import { XL4BaudStep } from '@/components/pairing/xl4/XL4BaudStep';
import { XL4HandshakeStep, type XL4Attempt } from '@/components/pairing/xl4/XL4HandshakeStep';
import { XL4SuccessStep } from '@/components/pairing/xl4/XL4SuccessStep';
import {
  performXL4Handshake,
  requestXL4Port,
  XL4HandshakeError,
  DEFAULT_XL4_BAUD,
  type XL4Baud,
  type XL4Handshake,
} from '@/lib/fireoneXL4Handshake';
import { recordPairing } from '@/lib/pairingAuditLog';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';
import { portRegistry } from '@/core/discovery/portRegistry';
import { logger } from '@/lib/logger';

type Step = 'welcome' | 'cable' | 'baud' | 'handshake' | 'success';

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Início' },
  { key: 'cable', label: 'Cabo' },
  { key: 'baud', label: 'Baud' },
  { key: 'handshake', label: 'Handshake' },
  { key: 'success', label: 'Pronto' },
];

interface State {
  step: Step;
  baudRate: XL4Baud;
  attempts: XL4Attempt[];
  isHandshaking: boolean;
  handshake: XL4Handshake | null;
}

type Action =
  | { type: 'GOTO'; step: Step }
  | { type: 'SET_BAUD'; baud: XL4Baud }
  | { type: 'ATTEMPT_START'; attempt: XL4Attempt }
  | { type: 'ATTEMPT_UPDATE'; id: string; outcome: XL4Attempt['outcome'] }
  | { type: 'HANDSHAKE_OK'; handshake: XL4Handshake }
  | { type: 'RESET' };

const ATTEMPT_CAP = 20;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO':
      return { ...state, step: action.step };
    case 'SET_BAUD':
      return { ...state, baudRate: action.baud, step: 'handshake' };
    case 'ATTEMPT_START':
      return {
        ...state,
        isHandshaking: true,
        attempts: [...state.attempts, action.attempt].slice(-ATTEMPT_CAP),
      };
    case 'ATTEMPT_UPDATE':
      return {
        ...state,
        isHandshaking: action.outcome.kind === 'connecting',
        attempts: state.attempts.map((a) =>
          a.id === action.id ? { ...a, outcome: action.outcome } : a),
      };
    case 'HANDSHAKE_OK':
      return { ...state, handshake: action.handshake, isHandshaking: false, step: 'success' };
    case 'RESET':
      return { step: 'welcome', baudRate: DEFAULT_XL4_BAUD, attempts: [], isHandshaking: false, handshake: null };
  }
}

const initialState: State = {
  step: 'welcome',
  baudRate: DEFAULT_XL4_BAUD,
  attempts: [],
  isHandshaking: false,
  handshake: null,
};

export default function FireOneXL4PairingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const attemptCounter = useRef(0);
  const platform = detectPlatformCapabilities().platform;

  const runHandshake = useCallback(async () => {
    const id = `xl4-${++attemptCounter.current}-${Date.now().toString(36)}`;
    const startedAt = Date.now();
    const t0 = performance.now();
    const baudRate = state.baudRate;

    dispatch({
      type: 'ATTEMPT_START',
      attempt: { id, startedAt, baudRate, outcome: { kind: 'connecting' } },
    });

    try {
      // Acquire port via user gesture *before* opening so cancel is honest.
      const port = await requestXL4Port();
      const hs = await performXL4Handshake({ port, baudRate, timeoutMs: 3000 });

      dispatch({
        type: 'ATTEMPT_UPDATE',
        id,
        outcome: {
          kind: 'ok',
          latencyMs: hs.latencyMs,
          firmware: hs.firmware,
          moduleAddress: hs.moduleAddress,
          igniterCount: hs.igniterCount,
          raw: hs.raw,
        },
      });

      // Persist for auto-classification on next boot.
      try {
        const key = `fireone-xl4:addr-${hs.moduleAddress}:baud-${hs.baudRate}`;
        portRegistry.upsert({
          key,
          aliases: [key],
          lastLabel: `FireOne XL4+ (FW ${hs.firmware})`,
          operatorConfirmedGeneric: false,
          profileId: 'fireone-xl4',
        });
      } catch (err) {
        logger.warn('[FireOneXL4PairingWizard] portRegistry.upsert failed', err);
      }

      try {
        recordPairing({
          transport: 'webserial',
          platform,
          label: `FireOne XL4+ (addr ${hs.moduleAddress})`,
          protocolKind: 'fireone-xl4',
          protocolLabel: `FireOne XL4+ FW ${hs.firmware}, ${hs.igniterCount} ign`,
          baudRate: hs.baudRate,
          success: true,
        });
      } catch (err) {
        logger.warn('[FireOneXL4PairingWizard] audit success failed', err);
      }

      dispatch({ type: 'HANDSHAKE_OK', handshake: hs });
    } catch (err) {
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      const code = err instanceof XL4HandshakeError ? err.code : 'unknown';
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';

      dispatch({
        type: 'ATTEMPT_UPDATE',
        id,
        outcome: { kind: 'error', code, message, latencyMs },
      });

      try {
        recordPairing({
          transport: 'webserial',
          platform,
          label: 'FireOne XL4+ (handshake)',
          protocolKind: 'fireone-xl4',
          protocolLabel: `FireOne XL4+ baud ${baudRate}`,
          baudRate,
          success: false,
          errorCode: code,
          errorMessage: message,
        });
      } catch (auditErr) {
        logger.warn('[FireOneXL4PairingWizard] audit failure failed', auditErr);
      }
    }
  }, [state.baudRate, platform]);

  const currentIndex = STEPS.findIndex((s) => s.key === state.step);

  return (
    <div
      className="min-h-dvh bg-background text-foreground flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="border-b border-border/40 bg-card/30 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => state.step === 'welcome' ? navigate(-1) : dispatch({ type: 'GOTO', step: 'welcome' })}
            className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Flame className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-sm font-bold truncate">Pareamento — FireOne XL4+</h1>
          </div>
          <button
            onClick={() => navigate('/command?mode=hw_overview')}
            className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mx-auto max-w-md px-2">
          <WizardStepIndicator steps={STEPS} currentIndex={currentIndex} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 py-5">
        {state.step === 'welcome' && (
          <XL4WelcomeStep onContinue={() => dispatch({ type: 'GOTO', step: 'cable' })} />
        )}
        {state.step === 'cable' && (
          <CableCheckStep
            onBack={() => dispatch({ type: 'GOTO', step: 'welcome' })}
            onContinue={() => dispatch({ type: 'GOTO', step: 'baud' })}
          />
        )}
        {state.step === 'baud' && (
          <XL4BaudStep
            initial={state.baudRate}
            onBack={() => dispatch({ type: 'GOTO', step: 'cable' })}
            onContinue={(baud) => dispatch({ type: 'SET_BAUD', baud })}
          />
        )}
        {state.step === 'handshake' && (
          <XL4HandshakeStep
            baudRate={state.baudRate}
            attempts={state.attempts}
            isHandshaking={state.isHandshaking}
            onRetry={runHandshake}
            onChangeBaud={() => dispatch({ type: 'GOTO', step: 'baud' })}
          />
        )}
        {state.step === 'success' && state.handshake && (
          <XL4SuccessStep
            handshake={state.handshake}
            onPairAnother={() => {
              attemptCounter.current = 0;
              dispatch({ type: 'RESET' });
              dispatch({ type: 'GOTO', step: 'baud' });
            }}
          />
        )}
      </main>
    </div>
  );
}
