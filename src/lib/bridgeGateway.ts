const LEGACY_BRIDGE_KEY_STORAGE = 'fxk_bridge_key';
const SESSION_BRIDGE_KEY_STORAGE = 'fxk_bridge_key_session';
const BRIDGE_GATEWAY_CONFIG_STORAGE = 'fxk_bridge_gateway';

export const DEFAULT_BRIDGE_HOST = 'fxk-relay.local';
export const DEFAULT_BRIDGE_INSECURE_PORT = 9001;
export const DEFAULT_BRIDGE_SECURE_PORT = 9443;

export interface BridgeGatewayConfig {
  host?: string;
  port?: number;
  securePort?: number;
  secure?: boolean;
  path?: string;
}

export interface BridgeEndpointOptions extends BridgeGatewayConfig {
  defaultInsecurePort?: number;
  defaultSecurePort?: number;
}

export interface BridgeRuntime {
  location?: Pick<Location, 'protocol' | 'hostname'>;
  navigator?: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { standalone?: boolean };
  localStorage?: Storage | null;
  sessionStorage?: Storage | null;
}

type BridgeNavigatorLike = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { standalone?: boolean };

export interface BridgeCapabilityHints {
  endpoint: string;
  secure: boolean;
  iosWebKit: boolean;
  mixedContentBlocked: boolean;
  host: string;
  port: number;
}

function runtimeLocation(runtime?: BridgeRuntime) {
  if (runtime?.location) return runtime.location;
  if (typeof window !== 'undefined') return window.location;
  return undefined;
}

function runtimeNavigator(runtime?: BridgeRuntime): BridgeNavigatorLike | undefined {
  if (runtime?.navigator) return runtime.navigator;
  if (typeof navigator !== 'undefined') return navigator as BridgeNavigatorLike;
  return undefined;
}

function runtimeLocalStorage(runtime?: BridgeRuntime) {
  if ('localStorage' in (runtime ?? {})) return runtime?.localStorage ?? null;
  if (typeof window !== 'undefined') return window.localStorage;
  return null;
}

function runtimeSessionStorage(runtime?: BridgeRuntime) {
  if ('sessionStorage' in (runtime ?? {})) return runtime?.sessionStorage ?? null;
  if (typeof window !== 'undefined') return window.sessionStorage;
  return null;
}

function storageGet(storage: Storage | null, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function storageSet(storage: Storage | null, key: string, value: string): void {
  try { storage?.setItem(key, value); } catch {}
}

function storageRemove(storage: Storage | null, key: string): void {
  try { storage?.removeItem(key); } catch {}
}

function normalizePath(path: string | undefined): string {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function readStoredGatewayConfig(runtime?: BridgeRuntime): BridgeGatewayConfig {
  const raw = storageGet(runtimeLocalStorage(runtime), BRIDGE_GATEWAY_CONFIG_STORAGE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as BridgeGatewayConfig;
    return {
      host: typeof parsed.host === 'string' && parsed.host.trim() ? parsed.host.trim() : undefined,
      port: typeof parsed.port === 'number' && Number.isFinite(parsed.port) ? parsed.port : undefined,
      securePort: typeof parsed.securePort === 'number' && Number.isFinite(parsed.securePort) ? parsed.securePort : undefined,
      secure: typeof parsed.secure === 'boolean' ? parsed.secure : undefined,
      path: typeof parsed.path === 'string' ? parsed.path : undefined,
    };
  } catch {
    return {};
  }
}

export function saveBridgeGatewayConfig(config: BridgeGatewayConfig, runtime?: BridgeRuntime): void {
  const clean: BridgeGatewayConfig = {};
  if (config.host?.trim()) clean.host = config.host.trim();
  if (typeof config.port === 'number' && Number.isFinite(config.port)) clean.port = config.port;
  if (typeof config.securePort === 'number' && Number.isFinite(config.securePort)) clean.securePort = config.securePort;
  if (typeof config.secure === 'boolean') clean.secure = config.secure;
  if (config.path !== undefined) clean.path = normalizePath(config.path);
  storageSet(runtimeLocalStorage(runtime), BRIDGE_GATEWAY_CONFIG_STORAGE, JSON.stringify(clean));
}

export function isIOSWebKit(nav = runtimeNavigator()): boolean {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/i.test(ua);
  const iPadOSDesktopUA = /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
  return iOSDevice || iPadOSDesktopUA;
}

export function requiresSecureBridgeTransport(
  location = runtimeLocation(),
  nav = runtimeNavigator(),
): boolean {
  return location?.protocol === 'https:' || Boolean(nav?.standalone && isIOSWebKit(nav));
}

export function normalizeBridgeKey(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return /^fxkb_[A-Za-z0-9_-]{16,128}$/.test(value) ? value : null;
}

export function setBridgeKey(raw: string | null | undefined, runtime?: BridgeRuntime): string | null {
  const session = runtimeSessionStorage(runtime);
  const local = runtimeLocalStorage(runtime);
  storageRemove(local, LEGACY_BRIDGE_KEY_STORAGE);

  const key = normalizeBridgeKey(raw);
  if (!key) {
    storageRemove(session, SESSION_BRIDGE_KEY_STORAGE);
    return null;
  }

  storageSet(session, SESSION_BRIDGE_KEY_STORAGE, key);
  return key;
}

export function getBridgeKey(runtime?: BridgeRuntime): string | null {
  const session = runtimeSessionStorage(runtime);
  const local = runtimeLocalStorage(runtime);

  const sessionKey = normalizeBridgeKey(storageGet(session, SESSION_BRIDGE_KEY_STORAGE));
  if (sessionKey) return sessionKey;
  storageRemove(session, SESSION_BRIDGE_KEY_STORAGE);

  const legacyKey = normalizeBridgeKey(storageGet(local, LEGACY_BRIDGE_KEY_STORAGE));
  if (!legacyKey) {
    storageRemove(local, LEGACY_BRIDGE_KEY_STORAGE);
    return null;
  }

  storageSet(session, SESSION_BRIDGE_KEY_STORAGE, legacyKey);
  storageRemove(local, LEGACY_BRIDGE_KEY_STORAGE);
  return legacyKey;
}

export function clearBridgeKey(runtime?: BridgeRuntime): void {
  storageRemove(runtimeSessionStorage(runtime), SESSION_BRIDGE_KEY_STORAGE);
  storageRemove(runtimeLocalStorage(runtime), LEGACY_BRIDGE_KEY_STORAGE);
}

export function maskBridgeKey(key: string | null | undefined): string {
  const normalized = normalizeBridgeKey(key);
  if (!normalized) return 'unpaired';
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildBridgeAuthHeaders(key = getBridgeKey()): Record<string, string> {
  const normalized = normalizeBridgeKey(key);
  return normalized ? { 'X-FXK-Bridge-Key': normalized } : {};
}

export function buildBridgeWebSocketProtocols(key = getBridgeKey()): string[] {
  const normalized = normalizeBridgeKey(key);
  return normalized ? ['fxk-bridge.v1', `fxk-key.${base64UrlEncode(normalized)}`] : [];
}

export function getMobileGatewayChannelName(projectId?: string | null): string {
  const safeProjectId = (projectId || 'local')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64) || 'local';
  return `mobile-link:${safeProjectId}`;
}

export function buildBridgeWebSocketUrl(
  options: BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): string {
  const stored = readStoredGatewayConfig(runtime);
  const secure = options.secure ?? stored.secure ?? requiresSecureBridgeTransport(
    runtimeLocation(runtime),
    runtimeNavigator(runtime),
  );
  const host = options.host ?? stored.host ?? (secure ? DEFAULT_BRIDGE_HOST : 'localhost');
  const port = options.port ?? stored.port ?? (
    secure
      ? options.securePort ?? stored.securePort ?? options.defaultSecurePort ?? DEFAULT_BRIDGE_SECURE_PORT
      : options.defaultInsecurePort ?? DEFAULT_BRIDGE_INSECURE_PORT
  );
  const path = normalizePath(options.path ?? stored.path ?? '/ws');
  return `${secure ? 'wss' : 'ws'}://${host}:${port}${path}`;
}

export function getBridgeCapabilityHints(
  options: BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): BridgeCapabilityHints {
  const endpoint = buildBridgeWebSocketUrl(options, runtime);
  const url = new URL(endpoint);
  const location = runtimeLocation(runtime);
  const secure = url.protocol === 'wss:';

  return {
    endpoint,
    secure,
    iosWebKit: isIOSWebKit(runtimeNavigator(runtime)),
    mixedContentBlocked: location?.protocol === 'https:' && url.protocol === 'ws:',
    host: url.hostname,
    port: Number(url.port),
  };
}
