/**
 * ─── Multi-Site Sync Engine ─────────────────────────────────────────
 * Site-level grouping, state hashing, cross-site reconciliation,
 * and graceful local fallback for multi-city show execution.
 * Wraps globalSync without modifying it.
 */

export type SiteStatus = 'synced' | 'degraded' | 'local' | 'disconnected';

export interface SiteInfo {
  siteId: string;
  name: string;
  latencyMs: number;
  offsetMs: number;
  stateHash: string;
  status: SiteStatus;
  lastSeen: number;
  isHost: boolean;
}

export interface MultiSiteState {
  localSiteId: string;
  sites: Map<string, SiteInfo>;
  isLocalMode: boolean;
  frozenOffset: number;
  hostSiteId: string | null;
  lastConsistencyCheck: number;
}

export interface ConsistencyResult {
  consistent: boolean;
  mismatchedSites: string[];
  hostHash: string;
}

// ── FNV-1a Hash (fast, non-crypto) ─────────────────────────────────

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Engine ──────────────────────────────────────────────────────────

class MultiSiteSyncEngine {
  private _state: MultiSiteState = {
    localSiteId: this._generateId(),
    sites: new Map(),
    isLocalMode: false,
    frozenOffset: 0,
    hostSiteId: null,
    lastConsistencyCheck: 0,
  };

  private _listeners: Array<(state: MultiSiteState) => void> = [];
  private _consistencyInterval: ReturnType<typeof setInterval> | null = null;
  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _staleThresholdMs = 5000;
  private _consistencyIntervalMs = 2000;

  // ── Site Management ─────────────────────────────────────────────

  getLocalSiteId(): string {
    return this._state.localSiteId;
  }

  registerSite(siteId: string, name: string, isHost = false): void {
    const site: SiteInfo = {
      siteId,
      name,
      latencyMs: 0,
      offsetMs: 0,
      stateHash: '',
      status: 'synced',
      lastSeen: Date.now(),
      isHost,
    };
    this._state.sites.set(siteId, site);
    if (isHost) this._state.hostSiteId = siteId;
    this._notify();
  }

  removeSite(siteId: string): void {
    this._state.sites.delete(siteId);
    if (this._state.hostSiteId === siteId) {
      this._state.hostSiteId = null;
    }
    this._notify();
  }

  updateSiteMetrics(siteId: string, latencyMs: number, offsetMs: number): void {
    const site = this._state.sites.get(siteId);
    if (!site) return;
    site.latencyMs = latencyMs;
    site.offsetMs = offsetMs;
    site.lastSeen = Date.now();
    this._updateSiteStatus(site);
    this._notify();
  }

  updateSiteHash(siteId: string, hash: string): void {
    const site = this._state.sites.get(siteId);
    if (!site) return;
    site.stateHash = hash;
    site.lastSeen = Date.now();
  }

  getSite(siteId: string): SiteInfo | undefined {
    return this._state.sites.get(siteId);
  }

  getAllSites(): SiteInfo[] {
    return Array.from(this._state.sites.values());
  }

  getHostSite(): SiteInfo | undefined {
    return this._state.hostSiteId
      ? this._state.sites.get(this._state.hostSiteId)
      : undefined;
  }

  // ── State Hashing ──────────────────────────────────────────────

  computeStateHash(criticalState: Record<string, unknown>): string {
    const serialized = JSON.stringify(criticalState, Object.keys(criticalState).sort());
    return fnv1aHash(serialized);
  }

  // ── Consistency ────────────────────────────────────────────────

  checkConsistency(): ConsistencyResult {
    const host = this.getHostSite();
    if (!host || !host.stateHash) {
      return { consistent: true, mismatchedSites: [], hostHash: '' };
    }

    const mismatched: string[] = [];
    for (const site of this._state.sites.values()) {
      if (site.siteId === host.siteId) continue;
      if (site.stateHash && site.stateHash !== host.stateHash) {
        mismatched.push(site.siteId);
      }
    }

    this._state.lastConsistencyCheck = Date.now();
    return {
      consistent: mismatched.length === 0,
      mismatchedSites: mismatched,
      hostHash: host.stateHash,
    };
  }

  // ── Local Mode (WAN Fallback) ──────────────────────────────────

  enterLocalMode(currentOffset: number): void {
    this._state.isLocalMode = true;
    this._state.frozenOffset = currentOffset;
    this._notify();
  }

  exitLocalMode(): void {
    this._state.isLocalMode = false;
    this._notify();
  }

  isLocalMode(): boolean {
    return this._state.isLocalMode;
  }

  getFrozenOffset(): number {
    return this._state.frozenOffset;
  }

  // ── Monitoring ─────────────────────────────────────────────────

  startMonitoring(): void {
    this.stopMonitoring();

    this._heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const site of this._state.sites.values()) {
        if (site.siteId === this._state.localSiteId) continue;
        if (now - site.lastSeen > this._staleThresholdMs) {
          site.status = 'disconnected';
        }
      }
      this._notify();
    }, 1000);

    this._consistencyInterval = setInterval(() => {
      this.checkConsistency();
    }, this._consistencyIntervalMs);
  }

  stopMonitoring(): void {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this._consistencyInterval) clearInterval(this._consistencyInterval);
    this._heartbeatInterval = null;
    this._consistencyInterval = null;
  }

  // ── Subscriptions ──────────────────────────────────────────────

  onStateChange(cb: (state: MultiSiteState) => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(l => l !== cb);
    };
  }

  getState(): Readonly<MultiSiteState> {
    return this._state;
  }

  // ── Internal ───────────────────────────────────────────────────

  private _updateSiteStatus(site: SiteInfo): void {
    if (site.latencyMs > 200) {
      site.status = 'degraded';
    } else if (site.status !== 'local') {
      site.status = 'synced';
    }
  }

  private _notify(): void {
    for (const cb of this._listeners) cb(this._state);
  }

  private _generateId(): string {
    return `site-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

export const multiSiteSync = new MultiSiteSyncEngine();
