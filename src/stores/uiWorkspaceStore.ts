/**
 * ─── uiWorkspaceStore ─────────────────────────────────────────────
 * Macro-store for UI layout + prefs + journal/report mirrors.
 *
 * Canonical sources (DO NOT mirror here):
 *   - Feature flags: @/lib/featureFlags (used by 40+ files)
 *
 * SLICE TOPOLOGY:
 *   • layout    — openPanels, aiCoPilotOpen (PERSISTED)
 *   • prefs     — preferences (PERSISTED)
 *   • telemetry — commandJournal, executiveReports (HIGH freq,
 *                 rolling buffers, NEVER persisted)
 *
 * Telemetry slice can churn at >5Hz under load. Layout panels MUST
 * use the layout/prefs slice selectors so they don't re-render on
 * every journal entry.
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

export interface UIWorkspaceLayoutSlice {
  openPanels: string[];
  aiCoPilotOpen: boolean;
}

export interface UIWorkspacePrefsSlice {
  preferences: Record<string, unknown>;
}

export interface UIWorkspaceTelemetrySlice {
  commandJournal: CommandJournalEntry[];
  executiveReports: ExecutiveReportEntry[];
}

export interface UIWorkspaceActions {
  togglePanel: (panel: string) => void;
  setPreference: <V>(key: string, value: V) => void;
  toggleAICopilot: () => void;
  addCommandToJournal: (entry: Omit<CommandJournalEntry, 'timestamp'>) => void;
  addExecutiveReport: (entry: Omit<ExecutiveReportEntry, 'timestamp'>) => void;
  clearTelemetryBuffers: () => void;
}

export type UIWorkspaceState =
  & UIWorkspaceLayoutSlice
  & UIWorkspacePrefsSlice
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
    // telemetry (hot)
    commandJournal: [],
    executiveReports: [],

    togglePanel: (panel) => set((s) => {
      const idx = s.openPanels.indexOf(panel);
      if (idx >= 0) s.openPanels.splice(idx, 1);
      else s.openPanels.push(panel);
    }),
    setPreference: (key, value) => set((s) => { s.preferences[key] = value; }),
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
    // Persist ONLY layout + prefs. Telemetry buffers are excluded —
    // they would bloat localStorage and aren't useful across sessions.
    partialize: (state) => ({
      openPanels: state.openPanels,
      aiCoPilotOpen: state.aiCoPilotOpen,
      preferences: state.preferences,
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

export const useUIWorkspaceTelemetry = () =>
  useUIWorkspaceStore(useShallow((s): UIWorkspaceTelemetrySlice => ({
    commandJournal: s.commandJournal,
    executiveReports: s.executiveReports,
  })));

export const useUIWorkspaceActions = (): UIWorkspaceActions =>
  useUIWorkspaceStore(useShallow((s) => ({
    togglePanel: s.togglePanel,
    setPreference: s.setPreference,
    toggleAICopilot: s.toggleAICopilot,
    addCommandToJournal: s.addCommandToJournal,
    addExecutiveReport: s.addExecutiveReport,
    clearTelemetryBuffers: s.clearTelemetryBuffers,
  })));
