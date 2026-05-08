/**
 * ShowvenM1PairingWizard — guided pairing for the Showven M1 / FXcommander
 * Pro master controller over USB-serial PBus.
 *
 * Four steps:
 *   1. Welcome   — scope + WebSerial readiness
 *   2. Link      — confirm cable/TNC + pick master address
 *   3. Handshake — open port, send PBus STATUS, validate firmware ≥ V1.5
 *   4. Success   — show firmware/master/slaves summary
 *
 * Read-only: NEVER sends ARM or FIRE. All operational commands go through
 * uiCommandGateway from the operator console.
 *
 * On success:
 *   • portRegistry.upsert({ profileId: 'showven-m1' }) so the device is
 *     auto-classified next session.
 *   • pairingAuditLog.recordPairing(success).
 *   • notifyHandshakeOk(...) promotes the adapter to LIVE READ-ONLY via
 *     the discovery bridge.
 *
 * On any failure: pairingAuditLog.recordPairing(failure). Registry/bridge
 * are never touched on failure (honest hardware contract).
 */
import { useCallback, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Radio } from 'lucide-react';
import { WizardStepIndicator } from '@/components/pairing/WizardStepIndicator';
import { M1WelcomeStep } from '@/components/pairing/m1/M1WelcomeStep';
import { M1LinkStep } from '@/components/pairing/m1/M1LinkStep';
import { M1HandshakeStep, type M1Attempt } from '@/components/pairing/m1/M1HandshakeStep';
import { M1SuccessStep } from '@/components/pairing/m1/M1SuccessStep';
import {
  performM1Handshake,
  requestM1Port,
  ShowvenM1HandshakeError,
  M1_DEFAULT_MASTER_ADDR,
  M1_BAUD,
  type ShowvenM1HandshakeResult,
} from '@/lib/showvenM1Handshake';
import { recordPairing } from '@/lib/pairingAuditLog';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';
import { portRegistry } from '@/core/discovery/portRegistry';
import { notifyHandshakeOk as notifyM1HandshakeOk } from '@/hooks/useShowvenM1Bridge';
import { logger } from '@/lib/logger';

type Step = 'welcome' | 'link' | 'handshake' | 'success';

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Início' },
  { key: 'link', label: 'Enlace' },
  { key: 'handshake', label: 'Handshake' },
  { key: 'success', label: 'Pronto' },
];

interface State {
  step: Step;
  masterAddress: number;
  attempts: M1Attempt[];
  isHandshaking: boolean;
  handshake: ShowvenM1HandshakeResult | null;
}

type Action =
  | { type: 'GOTO'; step: Step }
  | { type: 'SET_ADDR'; addr: number }
  | { type: 'ATTEMPT_START'; attempt: M1Attempt }
  | { type: 'ATTEMPT_UPDATE'; id: string; outcome: M1Attempt['outcome'] }
  | { type: 'HANDSHAKE_OK'; handshake: ShowvenM1HandshakeResult }
  | { type: 'RESET' };

const ATTEMPT_CAP = 20;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO':
      return { ...state, step: action.step };
    case 'SET_ADDR':
      return { ...state, masterAddress: action.addr, step: 'handshake' };
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
      return { step: 'welcome', masterAddress: M1_DEFAULT_MASTER_ADDR, attempts: [], isHandshaking: false, handshake: null };
  }
}

const initialState: State = {
  step: 'welcome',
  masterAddress: M1_DEFAULT_MASTER_ADDR,
  attempts: [],
  isHandshaking: false,
  handshake: null,
};

export default function ShowvenM1PairingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const attemptCounter = useRef(0);
  const platform = detectPlatformCapabilities().platform;

  const runHandshake = useCallback(async () => {
    const id = `m1-${++attemptCounter.current}-${Date.now().toString(36)}`;
    const startedAt = Date.now();
    const t0 = performance.now();
    const masterAddress = state.masterAddress;

    dispatch({
      type: 'ATTEMPT_START',
      attempt: { id, startedAt, masterAddress, outcome: { kind: 'connecting' } },
    });

    try {
      const port = await requestM1Port();
      const hs = await performM1Handshake({ port, masterAddress, timeoutMs: 3000 });

      dispatch({
        type: 'ATTEMPT_UPDATE',
        id,
        outcome: {
          kind: 'ok',
          latencyMs: hs.latencyMs,
          firmware: hs.firmware,
          masterAddress: hs.masterAddress,
          slavesOnline: hs.slavesOnline,
          raw: hs.rawHex,
        },
      });

      // Persist for auto-classification on next boot.
      try {
        const key = `showven-m1:addr-${hs.masterAddress}:baud-${hs.baudRate}`;
        portRegistry.upsert({
          key,
          aliases: [key],
          lastLabel: `Showven M1 (FW ${hs.firmware})`,
          operatorConfirmedGeneric: false,
          profileId: 'showven-m1',
        });
      } catch (err) {
        logger.warn('[ShowvenM1PairingWizard] portRegistry.upsert failed', err);
      }

      // Promote adapter to LIVE READ-ONLY via discovery bridge.
      try {
        notifyM1HandshakeOk({
          firmware: hs.firmware,
          masterAddress: hs.masterAddress,
          baudRate: hs.baudRate,
          slavesOnline: hs.slavesOnline,
        });
        logger.info(
          `[ShowvenM1PairingWizard] handshake ok — fw=${hs.firmware} addr=${hs.masterAddress} slaves=${hs.slavesOnline} latency=${hs.latencyMs}ms`,
        );
      } catch (err) {
        logger.warn('[ShowvenM1PairingWizard] notifyHandshakeOk failed', err);
      }

      try {
        recordPairing({
          transport: 'webserial',
          platform,
          label: `Showven M1 (addr ${hs.masterAddress})`,
          protocolKind: 'showven-m1',
          protocolLabel: `Showven M1 FW ${hs.firmware} · ${hs.slavesOnline} slave(s)`,
          baudRate: hs.baudRate,
          success: true,
        });
      } catch (err) {
        logger.warn('[ShowvenM1PairingWizard] audit success failed', err);
      }

      dispatch({ type: 'HANDSHAKE_OK', handshake: hs });
    } catch (err) {
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      const code = err instanceof ShowvenM1HandshakeError ? err.code : 'unknown';
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
          label: 'Showven M1 (handshake)',
          protocolKind: 'showven-m1',
          protocolLabel: `Showven M1 baud ${M1_BAUD}`,
          baudRate: M1_BAUD,
          success: false,
          errorCode: code,
          errorMessage: message,
        });
      } catch (auditErr) {
        logger.warn('[ShowvenM1PairingWizard] audit failure failed', auditErr);
      }
    }
  }, [state.masterAddress, platform]);

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
            <Radio className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-sm font-bold truncate">Pareamento — Showven M1</h1>
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
          <M1WelcomeStep onContinue={() => dispatch({ type: 'GOTO', step: 'link' })} />
        )}
        {state.step === 'link' && (
          <M1LinkStep
            initialAddress={state.masterAddress}
            onBack={() => dispatch({ type: 'GOTO', step: 'welcome' })}
            onContinue={(addr) => dispatch({ type: 'SET_ADDR', addr })}
          />
        )}
        {state.step === 'handshake' && (
          <M1HandshakeStep
            masterAddress={state.masterAddress}
            attempts={state.attempts}
            isHandshaking={state.isHandshaking}
            onRetry={runHandshake}
            onChangeAddress={() => dispatch({ type: 'GOTO', step: 'link' })}
          />
        )}
        {state.step === 'success' && state.handshake && (
          <M1SuccessStep
            handshake={state.handshake}
            onPairAnother={() => {
              attemptCounter.current = 0;
              dispatch({ type: 'RESET' });
              dispatch({ type: 'GOTO', step: 'link' });
            }}
          />
        )}
      </main>
    </div>
  );
}
