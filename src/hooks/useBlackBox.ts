/**
 * useBlackBox — IndexedDB Crash Recovery System ("Black Box")
 * Auto-saves project state every 500ms. On load, detects dirty sessions
 * and prompts for instant restoration.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

const DB_NAME = 'fxkontrol_blackbox';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current_session';

interface BlackBoxSnapshot {
  key: string;
  timestamp: number;
  dirty: boolean;
  projectName: string;
  projectId: string | null;
  state: {
    projectName: string;
    duration: number;
    timelineItems: any[];
    positions: any[];
    trajectories: any[];
    droneFormations: any[];
    cameraKeyframes: any[];
    audioUrl: string | null;
    bpm: number;
    playbackSpeed: number;
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSnapshot(snapshot: BlackBoxSnapshot) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(snapshot);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSnapshot(): Promise<BlackBoxSnapshot | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(SESSION_KEY);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function markClean() {
  const snapshot = await loadSnapshot();
  if (snapshot) {
    snapshot.dirty = false;
    await saveSnapshot(snapshot);
  }
}

export function useBlackBox() {
  const [hasDirtySession, setHasDirtySession] = useState(false);
  const [dirtySessionName, setDirtySessionName] = useState('');
  const [dirtyTimestamp, setDirtyTimestamp] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialCheckDone = useRef(false);

  // Check for dirty session on mount
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    loadSnapshot().then((snap) => {
      if (snap?.dirty && snap.state.timelineItems.length > 0) {
        setHasDirtySession(true);
        setDirtySessionName(snap.projectName || 'Untitled');
        setDirtyTimestamp(snap.timestamp);
      }
    }).catch(() => {});
  }, []);

  // Auto-save every 500ms
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const s = useProjectStore.getState();
      const snapshot: BlackBoxSnapshot = {
        key: SESSION_KEY,
        timestamp: Date.now(),
        dirty: true,
        projectName: s.projectName,
        projectId: s.projectId,
        state: {
          projectName: s.projectName,
          duration: s.duration,
          timelineItems: s.timelineItems,
          positions: s.positions,
          trajectories: s.trajectories,
          droneFormations: s.droneFormations,
          cameraKeyframes: s.cameraKeyframes,
          audioUrl: s.audioUrl,
          bpm: s.bpm,
          playbackSpeed: s.playbackSpeed,
        },
      };
      saveSnapshot(snapshot).catch(() => {});
    }, 500);

    // Mark clean on orderly unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      markClean().catch(() => {});
    };
  }, []);

  // Mark clean on beforeunload if possible
  useEffect(() => {
    const handler = () => { markClean().catch(() => {}); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const restoreSession = useCallback(async () => {
    const snap = await loadSnapshot();
    if (!snap) return false;

    const s = useProjectStore.getState();
    const st = snap.state;
    s.setProjectName(st.projectName);
    s.setDuration(st.duration);
    if (st.audioUrl) s.setAudioUrl(st.audioUrl);
    s.setBpm(st.bpm);
    s.setPlaybackSpeed(st.playbackSpeed);

    // Restore positions
    st.positions.forEach(p => s.addPosition(p));

    // Restore timeline items
    st.timelineItems.forEach(item => s.addTimelineItem(item));

    // Restore trajectories
    st.trajectories.forEach(t => s.addTrajectory(t));

    await markClean();
    setHasDirtySession(false);
    toast.success('Sessão restaurada com sucesso!');
    return true;
  }, []);

  const dismissSession = useCallback(async () => {
    await markClean();
    setHasDirtySession(false);
  }, []);

  return {
    hasDirtySession,
    dirtySessionName,
    dirtyTimestamp,
    restoreSession,
    dismissSession,
  };
}
