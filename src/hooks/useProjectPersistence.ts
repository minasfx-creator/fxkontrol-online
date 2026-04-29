import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { saveProjectAtomic } from '@/lib/persistence/saveProjectAtomic';
import type {
  ProjectSavePayload,
  PositionSavePayload,
  TimelineItemSavePayload,
  TrajectorySavePayload,
} from '@/lib/persistence/savePayloadTypes';
import { validateSavePayload } from '@/lib/persistence/validateSavePayload';

// Narrow indexed-access helpers so we don't need `any` to read optional
// timeline-item fields the in-memory model carries but doesn't type yet.
// (Once the store gains positionId/positionName/notes natively, drop these.)
type TimelineItemExtra = {
  positionId?: string | null;
  positionName?: string | null;
  notes?: string | null;
};

/**
 * Project persistence hook.
 *
 * Transactionality: `saveProject` calls the Postgres RPC `save_project_atomic`
 * (via the typed `saveProjectAtomic` wrapper), which wipes and re-inserts
 * positions / timeline_items / trajectories / waypoints inside a single
 * transaction. Either the whole save commits or nothing changes — eliminates
 * the partial-save failure mode without client-side rollback.
 *
 * Pre-flight validation runs BEFORE the RPC call so obvious user errors
 * (empty name, NaN coords, out-of-order waypoints) surface as a clear toast
 * instead of a generic transaction-reverted message.
 */
export function useProjectPersistence() {
  const { user } = useAuth();
  const lastSavedRef = useRef<string>('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveProject = useCallback(async () => {
    if (!user) return false;

    const state = useProjectStore.getState();
    const {
      projectName, duration, timelineItems, positions, trajectories,
      audioUrl, bpm, playbackSpeed, projectId,
    } = state;

    // ── Build typed RPC payloads (snake_case to match the SQL function). ──
    const p_project: ProjectSavePayload = {
      name: projectName,
      duration,
      audio_url: audioUrl ?? null,
      bpm: bpm ?? null,
      playback_speed: playbackSpeed,
    };

    const p_positions: PositionSavePayload[] = positions.map((p, i) => ({
      name: p.name,
      type: p.type,
      x: p.x, y: p.y, z: p.z,
      heading: p.heading, pitch: p.pitch, roll: p.roll,
      color: p.color,
      sort_order: i,
    }));

    const p_timeline_items: TimelineItemSavePayload[] = timelineItems.map((item) => {
      const extra = item as unknown as TimelineItemExtra;
      return {
        effect_id: item.effectId,
        start_time: item.startTime,
        track_index: item.trackIndex,
        pos_x: item.position.x, pos_y: item.position.y, pos_z: item.position.z,
        position_id: extra.positionId ?? null,
        position_name: extra.positionName ?? null,
        notes: extra.notes ?? null,
      };
    });

    const p_trajectories: TrajectorySavePayload[] = trajectories.map((t) => ({
      id: t.id ?? null,
      name: t.name,
      position_id: t.positionId ?? null,
      waypoints: (t.waypoints ?? []).map((w, i) => ({
        x: w.position.x, y: w.position.y, z: w.position.z,
        time_seconds: w.time,
        sort_order: i,
      })),
    }));

    // ── Pre-flight validation: fail fast with a clear message. ──
    const validation = validateSavePayload({
      projectName, duration,
      positions: p_positions,
      timelineItems: p_timeline_items,
      trajectories: p_trajectories,
    });
    if (!validation.ok) {
      toast.error(validation.message);
      return false;
    }

    try {
      const { data: returnedId, error } = await saveProjectAtomic({
        p_project_id: projectId ?? null,
        p_project,
        p_positions,
        p_timeline_items,
        p_trajectories,
      });

      if (error) throw error;
      if (returnedId && !projectId) {
        useProjectStore.getState().setProjectId(returnedId);
      }

      lastSavedRef.current = JSON.stringify({
        projectName, duration,
        timelineItems: timelineItems.length,
        positions: positions.length,
        trajectories: trajectories.length,
      });
      return true;
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erro ao salvar — nenhuma alteração foi aplicada (transação revertida)');
      return false;
    }
  }, [user]);

  const loadProject = useCallback(async (projectId: string) => {
    if (!user) return false;

    try {
      const [{ data: project, error }, { data: posData }, { data: tlData }, { data: trajData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('positions').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('timeline_items').select('*').eq('project_id', projectId),
        supabase.from('trajectories').select('*, waypoints(*)').eq('project_id', projectId),
      ]);

      if (error || !project) throw error ?? new Error('project not found');

      const persistedSpeed = Number(project.playback_speed);
      const safeSpeed = Number.isFinite(persistedSpeed) && persistedSpeed > 0 ? persistedSpeed : 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const positions = (posData || []).map((p: any) => ({
        id: p.id, name: p.name, type: p.type, x: p.x, y: p.y, z: p.z,
        heading: p.heading, pitch: p.pitch, roll: p.roll, color: p.color,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timelineItems = (tlData || []).map((item: any) => ({
        id: item.id, effectId: item.effect_id, startTime: item.start_time, trackIndex: item.track_index,
        position: { x: item.pos_x, y: item.pos_y, z: item.pos_z },
        positionId: item.position_id || undefined,
        positionName: item.position_name || undefined,
        notes: item.notes || undefined,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trajectories = (trajData || []).map((t: any) => ({
        id: t.id, positionId: t.position_id, name: t.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        waypoints: ((t.waypoints || []) as any[])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((w) => ({ id: w.id, position: { x: w.x, y: w.y, z: w.z }, time: w.time_seconds })),
      }));

      // ── ATOMIC replace — wipes any leftover state from a previously-loaded
      //     project in a single set() call. Eliminates duplicate-id bugs.
      useProjectStore.getState().replaceProjectState({
        projectId: project.id,
        projectName: project.name,
        duration: project.duration,
        audioUrl: project.audio_url ?? null,
        bpm: project.bpm ?? null,
        playbackSpeed: safeSpeed,
        positions,
        timelineItems,
        trajectories,
        cameraKeyframes: [],
        droneFormations: [],
      });

      return true;
    } catch (err) {
      console.error('Load error:', err);
      toast.error('Erro ao carregar projeto');
      return false;
    }
  }, [user]);

  const listProjects = useCallback(async () => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, updated_at, duration')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) { console.error('List error:', error); return []; }
    return data || [];
  }, [user]);

  const deleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { toast.error('Erro ao deletar projeto'); return false; }
    return true;
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    if (!user) return;
    autoSaveTimerRef.current = setInterval(async () => {
      const state = useProjectStore.getState();
      const snapshot = JSON.stringify({
        projectName: state.projectName,
        duration: state.duration,
        timelineItems: state.timelineItems.length,
        positions: state.positions.length,
        trajectories: state.trajectories.length,
      });
      if (snapshot !== lastSavedRef.current && (state.timelineItems.length > 0 || state.positions.length > 0)) {
        await saveProject();
      }
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [user, saveProject]);

  return { saveProject, loadProject, listProjects, deleteProject };
}
