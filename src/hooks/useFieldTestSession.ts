/**
 * useFieldTestSession — shared contract between FieldTestMobile and
 * FieldTestDesktop shells. Both shells subscribe to the same
 * `fieldTestEngine` singleton and route arm/disarm/eStop through the
 * canonical `uiCommandGateway` (UI → CommandBus → SafetyStateMachine).
 *
 * Goal: eliminate divergent bridge code paths so a fix in one shell
 * automatically applies to the other. Pure presentation stays in the
 * shells; ALL session/bridge interactions live here.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { uiCommandGateway } from '@/core/safety/uiCommandGateway';
import {
  fieldTestEngine,
  type DeviceRole,
  type TestTransport,
  type FieldTestSession,
} from '@/services/fieldTestService';

export interface FieldTestSessionApi {
  /** Live session snapshot (null = setup screen). */
  session: FieldTestSession | null;
  /** Start a new session (controller/module + transport). */
  start: (code: string, role: DeviceRole, transport: TestTransport) => Promise<boolean>;
  /** Tear down the active session. */
  stop: () => Promise<void>;
  /** Toggle ARM via uiCommandGateway + engine mirror. */
  toggleArm: (source: string) => void;
  /** Force E-STOP via uiCommandGateway + engine mirror. */
  panic: (source: string) => void;
  /** Fire a single channel (controller + armed only). */
  fire: (channel: number) => void;
  /** Run benchmark over N channels. */
  runBenchmark: (channels: number) => Promise<void>;
  /** Stop a running benchmark. */
  stopBenchmark: () => void;
  /** Copy human-readable report to clipboard. */
  exportReport: () => void;
  /** Fresh tuning suggestions from engine. */
  getSuggestions: () => ReturnType<typeof fieldTestEngine.getSuggestions>;
}

export function useFieldTestSession(): FieldTestSessionApi {
  const [session, setSession] = useState<FieldTestSession | null>(null);

  useEffect(() => {
    const unsub = fieldTestEngine.subscribe(setSession);
    return () => { unsub(); };
  }, []);

  const start = useCallback<FieldTestSessionApi['start']>(async (code, role, transport) => {
    const ok = await fieldTestEngine.start(code, role, transport);
    if (ok) {
      haptics.success();
      toast.success(`Sessão iniciada como ${role.toUpperCase()}`);
    } else {
      toast.error('Falha ao iniciar sessão');
    }
    return ok;
  }, []);

  const stop = useCallback(async () => {
    await fieldTestEngine.stop();
    toast.info('Sessão encerrada');
  }, []);

  const toggleArm = useCallback((source: string) => {
    const armed = fieldTestEngine.session?.armed ?? false;
    if (armed) {
      uiCommandGateway.disarm({ source });
      fieldTestEngine.disarm();
    } else {
      uiCommandGateway.arm({ source });
      fieldTestEngine.arm();
    }
  }, []);

  const panic = useCallback((source: string) => {
    uiCommandGateway.eStop({ source, detail: 'PANIC' });
    fieldTestEngine.eStop();
    haptics.panic();
  }, []);

  const fire = useCallback((channel: number) => {
    const s = fieldTestEngine.session;
    if (!s?.armed || s.role !== 'controller') return;
    fieldTestEngine.fire(channel);
    haptics.fire();
  }, []);

  const runBenchmark = useCallback(async (channels: number) => {
    if (!fieldTestEngine.session?.armed) {
      toast.error('Arme primeiro');
      return;
    }
    await fieldTestEngine.runBenchmark(channels);
    toast.success('Benchmark completo!');
  }, []);

  const stopBenchmark = useCallback(() => {
    fieldTestEngine.stopBenchmark();
  }, []);

  const exportReport = useCallback(() => {
    const report = fieldTestEngine.generateReport();
    navigator.clipboard?.writeText(report);
    toast.success('Relatório copiado!');
  }, []);

  const getSuggestions = useCallback(() => fieldTestEngine.getSuggestions(), []);

  return { session, start, stop, toggleArm, panic, fire, runBenchmark, stopBenchmark, exportReport, getSuggestions };
}
