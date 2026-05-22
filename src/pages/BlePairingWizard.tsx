/**
 * BlePairingWizard — guided BLE pairing flow for FXK16-XXXXXX modules.
 *
 * Four steps: Welcome → Scan → Handshake (with per-attempt status log)
 * → Success. Read-only handshake (VERSION + STATUS); never sends FIRE.
 *
 * On confirmed handshake:
 *   • portRegistry.upsert with `ble:${device.id}` so DeviceAggregator
 *     can auto-reconnect later.
 *   • pairingAuditLog.recordPairing(success) for audit trail.
 *
 * On failure: pairingAuditLog.recordPairing(failure). Registry is
 * NOT touched — honest hardware: no synthetic device is created.
 */
import { useCallback, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Bluetooth } from 'lucide-react';
import { WizardStepIndicator } from '@/components/pairing/WizardStepIndicator';
import { BleWelcomeStep } from '@/components/pairing/ble/BleWelcomeStep';
import { BleScanStep } from '@/components/pairing/ble/BleScanStep';
import { BleHandshakeStep } from '@/components/pairing/ble/BleHandshakeStep';
import { BleSuccessStep } from '@/components/pairing/ble/BleSuccessStep';
import type { PairingAttempt } from '@/components/pairing/ble/AttemptLogList';
import {
  performHandshake,
  HandshakeError,
  type FXK16Handshake,
  type ScanResult,
} from '@/lib/fxk16BleHandshake';
import { recordPairing } from '@/lib/pairingAuditLog';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';
import { portRegistry } from '@/core/discovery/portRegistry';
import { logger } from '@/lib/logger';

type Step = 'welcome' | 'scan' | 'handshake' | 'success';

const STEPS: { key: Step; label: string }[] = [
  { key: 'welcome', label: 'Início' },
  { key: 'scan', label: 'Buscar' },
  { key: 'handshake', label: 'Handshake' },
  { key: 'success', label: 'Pronto' },
];

interface State {
  step: Step;
  picked: ScanResult | null;
  handshake: FXK16Handshake | null;
  attempts: PairingAttempt[];
  isHandshaking: boolean;
}

type Action =
  | { type: 'GOTO'; step: Step }
  | { type: 'PICKED'; pick: ScanResult }
  | { type: 'ATTEMPT_START'; attempt: PairingAttempt }
  | { type: 'ATTEMPT_UPDATE'; id: string; outcome: PairingAttempt['outcome'] }
  | { type: 'HANDSHAKE_OK'; handshake: FXK16Handshake }
  | { type: 'RESET' };

const ATTEMPT_CAP = 20;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'GOTO': return { ...state, step: action.step };
    case 'PICKED': return { ...state, picked: action.pick, step: 'handshake' };
    case 'ATTEMPT_START':
      return {
        ...state,
        isHandshaking: true,
        attempts: [...state.attempts, action.attempt].slice(-ATTEMPT_CAP),
      };
    case 'ATTEMPT_UPDATE':
      return {
        ...state,
        isHandshaking: action.outcome.kind === 'connecting' || action.outcome.kind === 'pending',
        attempts: state.attempts.map((a) =>
          a.id === action.id ? { ...a, outcome: action.outcome } : a),
      };
    case 'HANDSHAKE_OK':
      return { ...state, handshake: action.handshake, isHandshaking: false, step: 'success' };
    case 'RESET':
      return { step: 'welcome', picked: null, handshake: null, attempts: [], isHandshaking: false };
  }
}

const initialState: State = {
  step: 'welcome',
  picked: null,
  handshake: null,
  attempts: [],
  isHandshaking: false,
};

export default function BlePairingWizard() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const attemptCounter = useRef(0);

  const platform = detectPlatformCapabilities().platform;

  const runHandshake = useCallback(async () => {
    if (!state.picked) return;
    const id = `att-${++attemptCounter.current}-${Date.now().toString(36)}`;
    const startedAt = Date.now();
    const t0 = performance.now();

    dispatch({
      type: 'ATTEMPT_START',
      attempt: {
        id, startedAt, deviceName: state.picked.name,
        outcome: { kind: 'connecting' },
      },
    });

    try {
      const hs = await performHandshake(state.picked.device, { timeoutMs: 3000 });

      dispatch({
        type: 'ATTEMPT_UPDATE',
        id,
        outcome: {
          kind: 'ok', raw: hs.raw, latencyMs: hs.latencyMs,
          firmware: hs.firmware, deviceId: hs.deviceId,
        },
      });

      // Persist for auto-reconnect
      try {
        const key = `ble:${state.picked.device.id}`;
        portRegistry.upsert({
          key,
          aliases: [key],
          lastLabel: state.picked.name,
          operatorConfirmedGeneric: false,
          profileId: 'fxk16-esp32s3',
        });
      } catch (err) {
        logger.warn('[BlePairingWizard] portRegistry.upsert failed', err);
      }

      // Audit log
      try {
        recordPairing({
          transport: 'webble',
          platform,
          label: state.picked.name,
          protocolKind: 'fxk16-ascii',
          protocolLabel: `FXK16 (${hs.channels}ch, FW ${hs.firmware ?? 'n/a'})`,
          baudRate: 0,
          success: true,
        });
      } catch (err) {
        logger.warn('[BlePairingWizard] audit success failed', err);
      }

      dispatch({ type: 'HANDSHAKE_OK', handshake: hs });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      const code = err instanceof HandshakeError ? err.code : 'unknown';
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';

      dispatch({
        type: 'ATTEMPT_UPDATE',
        id,
        outcome: { kind: 'error', code, message, latencyMs },
      });

      try {
        recordPairing({
          transport: 'webble',
          platform,
          label: state.picked.name,
          protocolKind: 'fxk16-ascii',
          protocolLabel: 'FXK16 (handshake)',
          baudRate: 0,
          success: false,
          errorCode: code,
          errorMessage: message,
        });
      } catch (auditErr) {
        logger.warn('[BlePairingWizard] audit failure failed', auditErr);
      }
    }
  }, [state.picked, platform]);

  const currentIndex = STEPS.findIndex((s) => s.key === state.step);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Header */}
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
            <Bluetooth className="w-4 h-4 text-primary shrink-0" />
            <h1 className="text-sm font-bold truncate">Pareamento BLE — FXK16</h1>
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

      {/* Body */}
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-5">
        {state.step === 'welcome' && (
          <BleWelcomeStep onNext={() => dispatch({ type: 'GOTO', step: 'scan' })} />
        )}
        {state.step === 'scan' && (
          <BleScanStep
            onBack={() => dispatch({ type: 'GOTO', step: 'welcome' })}
            onPicked={(pick) => dispatch({ type: 'PICKED', pick })}
          />
        )}
        {state.step === 'handshake' && state.picked && (
          <BleHandshakeStep
            attempts={state.attempts}
            isHandshaking={state.isHandshaking}
            deviceName={state.picked.name}
            onRetry={runHandshake}
            onPickAnother={() => {
              attemptCounter.current = 0;
              dispatch({ type: 'RESET' });
              dispatch({ type: 'GOTO', step: 'scan' });
            }}
          />
        )}
        {state.step === 'success' && state.handshake && state.picked && (
          <BleSuccessStep
            handshake={state.handshake}
            deviceName={state.picked.name}
            onPairAnother={() => {
              attemptCounter.current = 0;
              dispatch({ type: 'RESET' });
              dispatch({ type: 'GOTO', step: 'scan' });
            }}
          />
        )}
      </main>
    </div>
  );
}
