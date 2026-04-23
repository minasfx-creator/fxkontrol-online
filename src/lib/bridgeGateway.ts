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
  isSecureContext?: boolean;
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

export type BridgeSecuritySeverity = 'info' | 'warning' | 'error';

export interface BridgeSecurityDiagnostic extends BridgeCapabilityHints {
  pageProtocol: string;
  bridgeProtocol: string;
  isSecureContext: boolean;
  standalonePwa: boolean;
  mdnsHost: boolean;
  localNetworkHost: boolean;
  usesSelfSignedLocalTls: boolean;
  compatibleWithIOSPwa: boolean;
  recommendedAction: string;
  summary: string;
  severity: BridgeSecuritySeverity;
}

export interface BridgeConnectionGuardResult {
  allowed: boolean;
  diagnostic: BridgeSecurityDiagnostic;
  reason?: string;
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

function runtimeSecureContext(runtime?: BridgeRuntime): boolean {
  if (typeof runtime?.isSecureContext === 'boolean') return runtime.isSecureContext;
  if (typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  return runtimeLocation(runtime)?.protocol === 'https:';
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

function isPrivateIpv4Host(host: string): boolean {
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
}

export function isMdnsBridgeHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return /\.local$/i.test(host.trim());
}

export function isLocalBridgeHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || isMdnsBridgeHost(normalized)
    || isPrivateIpv4Host(normalized);
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

export function parseBridgeGatewayUrl(raw: string): BridgeGatewayConfig | null {
  try {
    const url = new URL(raw);
    const port = url.port ? Number(url.port) : undefined;
    return {
      host: url.hostname || undefined,
      secure: url.protocol === 'wss:' || url.protocol === 'https:',
      port,
      securePort: url.protocol === 'wss:' || url.protocol === 'https:' ? port : undefined,
      path: normalizePath(url.pathname),
    };
  } catch {
    return null;
  }
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

function resolveBridgeEndpoint(
  input: string | BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): string {
  return typeof input === 'string' ? input : buildBridgeWebSocketUrl(input, runtime);
}

function summarizeBridgeDiagnostic(diagnostic: BridgeSecurityDiagnostic): Pick<BridgeSecurityDiagnostic, 'severity' | 'summary' | 'recommendedAction'> {
  if (diagnostic.mixedContentBlocked) {
    return {
      severity: 'error',
      summary: 'Página HTTPS detectada, mas o bridge local está em WS inseguro. O navegador bloqueará mixed content.',
      recommendedAction: 'Abra o bridge local em https://fxk-relay.local:9443, confie no certificado self-signed no dispositivo e reconecte em WSS.',
    };
  }

  if (diagnostic.iosWebKit && !diagnostic.secure) {
    return {
      severity: 'error',
      summary: 'No iPhone/PWA, o bridge local precisa responder em WSS para o canal local funcionar com confiabilidade.',
      recommendedAction: 'Use o host mDNS .local com TLS local e pareamento seguro antes de tentar abrir o canal no iPhone.',
    };
  }

  if (diagnostic.mdnsHost && !diagnostic.isSecureContext) {
    return {
      severity: 'warning',
      summary: 'Host mDNS local detectado, mas a página atual ainda não está em secure context.',
      recommendedAction: 'Abra o app em HTTPS/instalado na tela inicial e valide o certificado local antes do pareamento.',
    };
  }

  if (diagnostic.localNetworkHost && !diagnostic.secure) {
    return {
      severity: 'warning',
      summary: 'O bridge local está usando fallback inseguro; isso é aceitável apenas em desktop/dev local.',
      recommendedAction: 'Para iPhone/PWA e operação de campo, migre para fxk-relay.local com WSS e certificado confiável.',
    };
  }

  return {
    severity: 'info',
    summary: diagnostic.usesSelfSignedLocalTls
      ? 'Bridge local seguro detectado via mDNS/TLS local.'
      : 'Diagnóstico do bridge local sem bloqueios estruturais no contexto atual.',
    recommendedAction: diagnostic.usesSelfSignedLocalTls
      ? 'Se este for o primeiro acesso no dispositivo, abra o endpoint HTTPS do bridge e confie no certificado antes de operar.'
      : 'Valide conectividade, pareamento e confiança do certificado local antes do uso em campo.',
  };
}

export function getBridgeSecurityDiagnostic(
  input: string | BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): BridgeSecurityDiagnostic {
  const endpoint = resolveBridgeEndpoint(input, runtime);
  const url = new URL(endpoint);
  const location = runtimeLocation(runtime);
  const nav = runtimeNavigator(runtime);
  const secure = url.protocol === 'wss:';
  const pageProtocol = location?.protocol ?? 'http:';
  const standalonePwa = Boolean(nav?.standalone);
  const mdnsHost = isMdnsBridgeHost(url.hostname);
  const localNetworkHost = isLocalBridgeHost(url.hostname);
  const isSecureContext = runtimeSecureContext(runtime);
  const compatibleWithIOSPwa = secure && (mdnsHost || !localNetworkHost || isSecureContext);

  const diagnosticBase: BridgeSecurityDiagnostic = {
    endpoint,
    secure,
    iosWebKit: isIOSWebKit(nav),
    mixedContentBlocked: pageProtocol === 'https:' && url.protocol === 'ws:',
    host: url.hostname,
    port: Number(url.port),
    pageProtocol,
    bridgeProtocol: url.protocol,
    isSecureContext,
    standalonePwa,
    mdnsHost,
    localNetworkHost,
    usesSelfSignedLocalTls: secure && mdnsHost,
    compatibleWithIOSPwa,
    recommendedAction: '',
    summary: '',
    severity: 'info',
  };

  return {
    ...diagnosticBase,
    ...summarizeBridgeDiagnostic(diagnosticBase),
  };
}

export function evaluateBridgeWebSocketConnection(
  input: string | BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): BridgeConnectionGuardResult {
  const diagnostic = getBridgeSecurityDiagnostic(input, runtime);
  const allowed = !diagnostic.mixedContentBlocked && !(diagnostic.iosWebKit && !diagnostic.secure);
  return {
    allowed,
    diagnostic,
    reason: allowed ? undefined : diagnostic.summary,
  };
}

export function assertBridgeWebSocketAllowed(
  input: string | BridgeEndpointOptions = {},
  runtime?: BridgeRuntime,
): BridgeSecurityDiagnostic {
  const result = evaluateBridgeWebSocketConnection(input, runtime);
  if (!result.allowed) {
    throw new Error(result.reason ?? 'Bridge local bloqueado pelo contexto de segurança atual.');
  }
  return result.diagnostic;
}

export function openBridgeWebSocket(
  endpoint: string,
  protocols: string[] = [],
  runtime?: BridgeRuntime,
): WebSocket {
  assertBridgeWebSocketAllowed(endpoint, runtime);
  return protocols.length > 0 ? new WebSocket(endpoint, protocols) : new WebSocket(endpoint);
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
  const diagnostic = getBridgeSecurityDiagnostic(options, runtime);
  return {
    endpoint: diagnostic.endpoint,
    secure: diagnostic.secure,
    iosWebKit: diagnostic.iosWebKit,
    mixedContentBlocked: diagnostic.mixedContentBlocked,
    host: diagnostic.host,
    port: diagnostic.port,
  };
}
