import { describe, expect, it } from 'vitest';
import {
  buildBridgeWebSocketProtocols,
  buildBridgeWebSocketUrl,
  getBridgeCapabilityHints,
  getBridgeKey,
  getMobileGatewayChannelName,
  maskBridgeKey,
  normalizeBridgeKey,
  setBridgeKey,
} from '@/lib/bridgeGateway';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const validKey = 'fxkb_1234567890abcdef1234567890abcdef';

describe('bridgeGateway key handling', () => {
  it('accepts only fxkb bridge keys', () => {
    expect(normalizeBridgeKey(validKey)).toBe(validKey);
    expect(normalizeBridgeKey('abc_1234567890abcdef')).toBeNull();
    expect(normalizeBridgeKey('fxkb_short')).toBeNull();
    expect(normalizeBridgeKey('fxkb_1234 with space')).toBeNull();
  });

  it('stores bridge keys in session storage and clears legacy localStorage', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    localStorage.setItem('fxk_bridge_key', validKey);

    const migrated = getBridgeKey({ localStorage, sessionStorage });

    expect(migrated).toBe(validKey);
    expect(sessionStorage.getItem('fxk_bridge_key_session')).toBe(validKey);
    expect(localStorage.getItem('fxk_bridge_key')).toBeNull();
  });

  it('does not persist new bridge keys in localStorage', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    expect(setBridgeKey(validKey, { localStorage, sessionStorage })).toBe(validKey);
    expect(sessionStorage.getItem('fxk_bridge_key_session')).toBe(validKey);
    expect(localStorage.getItem('fxk_bridge_key')).toBeNull();
    expect(maskBridgeKey(validKey)).toBe('fxkb_123...cdef');
  });

  it('uses websocket subprotocol auth without putting the raw key in the URL', () => {
    const protocols = buildBridgeWebSocketProtocols(validKey);

    expect(protocols[0]).toBe('fxk-bridge.v1');
    expect(protocols[1]).toMatch(/^fxk-key\./);
    expect(protocols.join(',')).not.toContain(validKey);
  });
});

describe('bridgeGateway endpoint selection', () => {
  it('uses wss fxk-relay.local on secure iPhone/PWA contexts', () => {
    const endpoint = buildBridgeWebSocketUrl(
      {},
      {
        location: { protocol: 'https:', hostname: 'app.fxk.test' } as Location,
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
          maxTouchPoints: 5,
          standalone: true,
        } as Navigator & { standalone: boolean },
        localStorage: new MemoryStorage(),
        sessionStorage: new MemoryStorage(),
      },
    );

    expect(endpoint).toBe('wss://fxk-relay.local:9443/ws');
  });

  it('keeps localhost relay compatibility on insecure desktop dev', () => {
    const endpoint = buildBridgeWebSocketUrl(
      {},
      {
        location: { protocol: 'http:', hostname: 'localhost' } as Location,
        navigator: { userAgent: 'Mozilla/5.0', maxTouchPoints: 0 } as Navigator,
        localStorage: new MemoryStorage(),
        sessionStorage: new MemoryStorage(),
      },
    );

    expect(endpoint).toBe('ws://localhost:9001/ws');
  });

  it('reports no mixed-content block after secure endpoint selection', () => {
    const hints = getBridgeCapabilityHints(
      {},
      {
        location: { protocol: 'https:', hostname: 'app.fxk.test' } as Location,
        navigator: { userAgent: 'Mozilla/5.0 (iPhone)', maxTouchPoints: 5 } as Navigator,
        localStorage: new MemoryStorage(),
        sessionStorage: new MemoryStorage(),
      },
    );

    expect(hints.secure).toBe(true);
    expect(hints.mixedContentBlocked).toBe(false);
    expect(hints.host).toBe('fxk-relay.local');
    expect(hints.port).toBe(9443);
  });

  it('scopes mobile gateway channels by project id', () => {
    expect(getMobileGatewayChannelName('Project ABC/123')).toBe('mobile-link:project-abc-123');
    expect(getMobileGatewayChannelName(null)).toBe('mobile-link:local');
  });
});
