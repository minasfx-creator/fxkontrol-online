import { useMemo } from 'react';
import {
  type BridgeEndpointOptions,
  type BridgeSecurityDiagnostic,
  getBridgeSecurityDiagnostic,
} from '@/lib/bridgeGateway';

export function useBridgeSecurityDiagnostics(input: string | BridgeEndpointOptions = {}): BridgeSecurityDiagnostic {
  return useMemo(() => getBridgeSecurityDiagnostic(input), [input]);
}