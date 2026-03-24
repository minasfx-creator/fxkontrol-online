/**
 * useRemoteRelay — Auto-relay hook for slave→master action mirroring.
 * When active as slave, wraps commands and forwards them via the remote session.
 */
import { useCallback, useMemo } from 'react';
import type { RemoteSession, CommandAction } from '@/lib/remoteCommandEngine';

interface UseRemoteRelayOptions {
  session: RemoteSession | null;
  connected: boolean;
  role: 'master' | 'slave';
}

export function useRemoteRelay({ session, connected, role }: UseRemoteRelayOptions) {
  const isRelaying = role === 'slave' && connected && !!session;

  const relayAction = useCallback(
    (action: CommandAction, payload: Record<string, unknown>) => {
      if (isRelaying && session) {
        session.sendCommand(action, payload);
      }
    },
    [isRelaying, session],
  );

  const relayLiveFx = useCallback(
    (type: string, detail: Record<string, unknown>) => {
      relayAction('livefx', { type, ...detail });
    },
    [relayAction],
  );

  const relaySfxChannel = useCallback(
    (effect: Record<string, unknown>) => {
      relayAction('sfx-channel', { effect });
    },
    [relayAction],
  );

  return useMemo(
    () => ({ isRelaying, relayAction, relayLiveFx, relaySfxChannel }),
    [isRelaying, relayAction, relayLiveFx, relaySfxChannel],
  );
}
