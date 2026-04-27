/**
 * ─── uiWorkspaceStore ─────────────────────────────────────────────
 * Macro-store consolidating UI layout, panels, preferences, undo/redo,
 * AI co-pilot state, feature flags, and operational telemetry mirrors
 * (command_journal + executive_reports rolling buffers).
 *
 * SLICE TOPOLOGY (minimize subscription fan-out):
 *   • layout    — openPanels, aiCoPilotOpen (PERSISTED)
 *   • prefs     — preferences (PERSISTED)
 *   • flags     — featureFlags (PERSISTED) — `consolidatedStores` is the
 *                 master switch checked by `migrateLegacyStores()`
 *   • telemetry — commandJournal, executiveReports (HIGH frequency,
 *                 rolling buffers — NEVER persisted)
 *
 * Critical: telemetry slice can churn at >5Hz under load. Layout
 * panels (TacticalDock, header, status bar) MUST use the layout/prefs
 * slice selectors so they don't re-render on every journal entry.
 */
import { useShallow } from 'zustand/react/shallow';
import { createStore } from './createStore';

export interface CommandJournalEntry {
  timestamp: number;
  command: string;
  payload?: Record<string, unknown>;
  outcome?: 'success' | 'partial' | 'error' | 'refused' | 'timeout';
}

export interface ExecutiveReportEntry {
  id: string;
  timestamp: number;
  showName: string;
  readinessStatus: string;
}

export type FeatureFlags = {
  /** Master switch for the 23 → 4 store consolidation. */
  consolidatedStores: boolean;
  /** Show SafetyGate panel/badge in the operator UI. */
  safetyGateUI: boolean;
  /** Require `outcome` on every Grok telemetry event. */
  grokTelemetryFull: boolean;
  [key: string]: boolean;
};

export interface UIWorkspaceLayoutSlice {
  openPanels: string[];
  aiCoPilotOpen: boolean;
}

export interface UIWorkspacePrefsSlice {
  preferences: Record<string, unknown>;
}

export interface UIWorkspaceFlagsSlice {
  featureFlags: FeatureFlags;
}

export interface UIWorkspaceTelemetrySlice {
  commandJournal: CommandJournalEntry[];
  executiveReports: ExecutiveReportEntry[];
}

export interface UIWorkspaceActions {
  togglePanel: (panel: string) => void;
  setPreference: <V>(key: string, value: V) => void;
  setFeatureFlag: (key: keyof FeatureFlags | string, value: boolean) => void;
  toggleAICopilot: () => void;
  addCommandToJournal: (entry: Omit<CommandJournalEntry, 'timestamp'>) => void;
  addExecutiveReport: (entry: Omit<ExecutiveReportEntry, 'timestamp'>) => void;
  clearTelemetryBuffers: () => void;
}

export type UIWorkspaceState =
  & UIWorkspaceLayoutSlice
  & UIWorkspacePrefsSlice
  & UIWorkspaceFlagsSlice
  & UIWorkspaceTelemetrySlice
  & UIWorkspaceActions;

const MAX_JOURNAL = 100;
const MAX_REPORTS = 50;

export const useUIWorkspaceStore = createStore<UIWorkspaceState>(
  'ui',
  (set) => ({
    // layout
    openPanels: ['timeline', 'hardware', 'viewport'],
    aiCoPilotOpen: false,
    // prefs
    preferences: {},
    // flags
    featureFlags: {
      consolidatedStores: false,
      safetyGateUI: true,
      grokTelemetryFull: false,
    },
    // telemetry (hot)
    commandJournal: [],
    executiveReports: [],

    togglePanel: (panel) => set((s) => {
      const idx = s.openPanels.indexOf(panel);
      if (idx >= 0) s.openPanels.splice(idx, 1);
      else s.openPanels.push(panel);
    }),
    setPreference: (key, value) => set((s) => { s.preferences[key] = value; }),
    setFeatureFlag: (key, value) => set((s) => { s.featureFlags[key] = value; }),
    toggleAICopilot: () => set((s) => { s.aiCoPilotOpen = !s.aiCoPilotOpen; }),
    addCommandToJournal: (entry) => set((s) => {
      s.commandJournal.unshift({ ...entry, timestamp: Date.now() });
      if (s.commandJournal.length > MAX_JOURNAL) {
        s.commandJournal.length = MAX_JOURNAL;
      }
    }),
    addExecutiveReport: (entry) => set((s) => {
      s.executiveReports.unshift({ ...entry, timestamp: Date.now() });
      if (s.executiveReports.length > MAX_REPORTS) {
        s.executiveReports.length = MAX_REPORTS;
      }
    }),
    clearTelemetryBuffers: () => set((s) => {
      s.commandJournal = [];
      s.executiveReports = [];
    }),
  }),
  {
    // Persist ONLY layout + prefs + flags. Telemetry buffers are
    // explicitly excluded — they would bloat localStorage and are
    // never useful across sessions.
    partialize: (state) => ({
      openPanels: state.openPanels,
      aiCoPilotOpen: state.aiCoPilotOpen,
      preferences: state.preferences,
      featureFlags: state.featureFlags,
    }),
  },
);

// ── Slice selectors ──────────────────────────────────────────────
export const useUIWorkspaceLayout = () =>
  useUIWorkspaceStore(useShallow((s): UIWorkspaceLayoutSlice => ({
    openPanels: s.openPanels,
    aiCoPilotOpen: s.aiCoPilotOpen,
  })));

export const useUIWorkspacePrefs = () =>
  useUIWorkspaceStore(useShallow((s): UIWorkspacePrefsSlice => ({
    preferences: s.preferences,
  })));

export const useUIWorkspaceFlags = () =>
  useUIWorkspaceStore(useShallow((s): UIWorkspaceFlagsSlice => ({
    featureFlags: s.featureFlags,
  })));

export const useUIWorkspaceTelemetry = () =>
  useUIWorkspaceStore(useShallow((s): UIWorkspaceTelemetrySlice => ({
    commandJournal: s.commandJournal,
    executiveReports: s.executiveReports,
  })));

export const useUIWorkspaceActions = (): UIWorkspaceActions =>
  useUIWorkspaceStore(useShallow((s) => ({
    togglePanel: s.togglePanel,
    setPreference: s.setPreference,
    setFeatureFlag: s.setFeatureFlag,
    toggleAICopilot: s.toggleAICopilot,
    addCommandToJournal: s.addCommandToJournal,
    addExecutiveReport: s.addExecutiveReport,
    clearTelemetryBuffers: s.clearTelemetryBuffers,
  })));
