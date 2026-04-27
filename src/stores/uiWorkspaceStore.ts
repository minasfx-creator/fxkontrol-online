/**
 * ─── uiWorkspaceStore ─────────────────────────────────────────────
 * Macro-store consolidating UI layout, panels, preferences, undo/redo,
 * AI co-pilot state, feature flags, and operational telemetry mirrors
 * (command_journal + executive_reports rolling buffers).
 *
 * The `consolidatedStores` flag here is the master switch that
 * `migrateLegacyStores()` checks on bootstrap.
 */
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

export interface UIWorkspaceState {
  // ── Layout slice ─────────────────────────────────────────────────
  openPanels: string[];

  // ── Preferences slice ────────────────────────────────────────────
  preferences: Record<string, unknown>;

  // ── Feature flag slice ───────────────────────────────────────────
  featureFlags: FeatureFlags;

  // ── AI co-pilot slice ────────────────────────────────────────────
  aiCoPilotOpen: boolean;

  // ── Telemetry slice (rolling buffers, not full mirror) ───────────
  commandJournal: CommandJournalEntry[];
  executiveReports: ExecutiveReportEntry[];

  // ── Actions ──────────────────────────────────────────────────────
  togglePanel: (panel: string) => void;
  setPreference: <V>(key: string, value: V) => void;
  setFeatureFlag: (key: keyof FeatureFlags | string, value: boolean) => void;
  toggleAICopilot: () => void;
  addCommandToJournal: (entry: Omit<CommandJournalEntry, 'timestamp'>) => void;
  addExecutiveReport: (entry: Omit<ExecutiveReportEntry, 'timestamp'>) => void;
  clearTelemetryBuffers: () => void;
}

const MAX_JOURNAL = 100;
const MAX_REPORTS = 50;

export const useUIWorkspaceStore = createStore<UIWorkspaceState>(
  'ui',
  (set) => ({
    openPanels: ['timeline', 'hardware', 'viewport'],
    preferences: {},
    featureFlags: {
      consolidatedStores: false,
      safetyGateUI: true,
      grokTelemetryFull: false,
    },
    aiCoPilotOpen: false,
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
    partialize: (state) => ({
      openPanels: state.openPanels,
      preferences: state.preferences,
      featureFlags: state.featureFlags,
      aiCoPilotOpen: state.aiCoPilotOpen,
    }),
  },
);
