

## Plan: Multi-Site Global Sync Layer

### Assessment

The existing `globalClockAdapter.ts` and `globalSyncEngine.ts` already handle single-session multi-operator sync (clock offset, ping/pong, host authority, presence, state snapshots). What's **missing** for multi-site (multi-city) operation:

1. **Site-level grouping** — each physical location is a "site" with its own local execution, all coordinated by a global host
2. **Latency-compensated execution** — adjusting pyro/drone fire times based on per-site measured latency
3. **State hash consistency** — detecting divergence between sites and triggering reconciliation
4. **Graceful local fallback** — if WAN drops, a site continues executing from its local timeline without stopping the show

### New modules (3 files, no existing files modified except index.ts and MissionControlPanel)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/core/sync/multiSiteSyncEngine.ts` | Site registry, site-level state hashing, cross-site reconciliation, local fallback mode |
| 2 | `src/core/sync/latencyCompensator.ts` | Per-site latency tracking + execution time adjustment for pyro/drone cues |
| 3 | `src/core/sync/multiSiteValidator.ts` | Pre-show validation: simulates all sites at 100x, checks cross-site timing alignment |

### Modified files

| File | Change |
|------|--------|
| `src/core/reliability/index.ts` | Add exports for the 3 new modules |
| `src/components/editor/MissionControlPanel.tsx` | Add "MULTI-SITE" section showing per-site latency, offset, status, and consistency hash |

### Technical details

**MultiSiteSyncEngine**: Wraps `globalSync` without modifying it. Adds:
- `SiteInfo` registry (siteId, name, latency, offset, stateHash, status)
- `registerSite()` / `removeSite()` for site management
- `computeStateHash()` using a fast FNV-1a hash of serialized critical state
- `checkConsistency()` comparing local hash vs host hash — if mismatch, requests full state sync
- `enterLocalMode()` — freezes offset, continues local execution when WAN drops
- `exitLocalMode()` — gradual re-sync when connection restores

**LatencyCompensator**: Maintains a per-site rolling window of RTT samples (last 20). Exposes:
- `getCompensation(siteId)` — returns half the median RTT for that site
- `getAdjustedFireTime(cueTime, siteId)` — `cueTime - compensation - hardwareDelay`
- Used by ExecutionBridge tick handler to adjust dispatch timing per-site

**MultiSiteValidator**: Takes timeline + site configs, runs deterministic simulation checking:
- Max cross-site time divergence (must be <10ms)
- Cues that would fire outside their safety window due to latency
- Returns `MultiSiteValidationReport` with pass/fail per site

**MissionControlPanel addition**: New collapsible "MULTI-SITE SYNC" section showing a table of connected sites with columns: Site Name, Latency (ms), Offset (ms), Hash Match (✓/✗), Status badge (SYNCED/DEGRADED/LOCAL).

