/**
 * useBlackBox — IndexedDB Crash Recovery System ("Black Box")
 * Auto-saves project state every 500ms. On load, detects dirty sessions
 * and prompts for instant restoration.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { getDB } from '@/core/persistence/dbConnection';

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

async function saveSnapshot(snapshot: BlackBoxSnapshot) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(snapshot);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSnapshot(): Promise<BlackBoxSnapshot | null> {
  const db = await getDB();
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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      markClean().catch(() => {});
    };
  }, []);

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
    // Guard against snapshots restored with speed=0 (timeline would play frozen).
    const restoredSpeed = Number.isFinite(st.playbackSpeed) && st.playbackSpeed > 0 ? st.playbackSpeed : 1;
    s.setPlaybackSpeed(restoredSpeed);

    st.positions.forEach(p => s.addPosition(p));
    st.timelineItems.forEach(item => s.addTimelineItem(item));
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
