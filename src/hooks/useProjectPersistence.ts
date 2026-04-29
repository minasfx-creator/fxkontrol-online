import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Project persistence hook.
 *
 * NOTE on transactionality: ideally `saveProject` would call a Postgres RPC
 * (`save_project_atomic`) so positions/timeline_items/trajectories are wiped
 * and re-inserted in a single transaction. The migration tool failed to
 * deploy that RPC in this turn, so we fall back to a client-side
 * snapshot-and-rollback: we read the current rows BEFORE deleting, and if
 * any insert step fails we re-insert the snapshot. Not as strong as a true
 * tx (a crash mid-rollback still loses data), but eliminates the most
 * common failure mode (insert returns an error → user is left with empty
 * positions table). Promote to RPC once the migration tool recovers.
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

    const projectData = {
      name: projectName,
      duration,
      audio_url: audioUrl,
      bpm,
      playback_speed: playbackSpeed,
      user_id: user.id,
    };

    try {
      let id = projectId;

      if (id) {
        const { error } = await supabase.from('projects').update(projectData).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('projects').insert(projectData).select('id').single();
        if (error) throw error;
        id = data.id;
        useProjectStore.getState().setProjectId(id);
      }

      if (!id) throw new Error('project id missing after upsert');

      // ── Snapshot existing rows BEFORE delete (manual rollback safety net).
      const [posSnap, tlSnap, trajSnap] = await Promise.all([
        supabase.from('positions').select('*').eq('project_id', id),
        supabase.from('timeline_items').select('*').eq('project_id', id),
        supabase.from('trajectories').select('id, name, position_id, waypoints:waypoints(*)').eq('project_id', id),
      ]);

      const rollback = async () => {
        try {
          if (posSnap.data?.length) await supabase.from('positions').insert(posSnap.data);
          if (tlSnap.data?.length) await supabase.from('timeline_items').insert(tlSnap.data);
          if (trajSnap.data?.length) {
            const trajRows = trajSnap.data.map((t) => ({ id: t.id, project_id: id!, name: t.name, position_id: t.position_id }));
            await supabase.from('trajectories').insert(trajRows);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wpRows = trajSnap.data.flatMap((t: any) => (t.waypoints || []).map((w: any) => ({ ...w, trajectory_id: t.id })));
            if (wpRows.length) await supabase.from('waypoints').insert(wpRows);
          }
        } catch (rbErr) {
          console.error('[saveProject] rollback failed:', rbErr);
          toast.error('Erro ao reverter save parcial — verifique o backup');
        }
      };

      // 1. positions
      await supabase.from('positions').delete().eq('project_id', id);
      if (positions.length > 0) {
        const posRows = positions.map((p, i) => ({
          project_id: id!, name: p.name, type: p.type, x: p.x, y: p.y, z: p.z,
          heading: p.heading, pitch: p.pitch, roll: p.roll, color: p.color, sort_order: i,
        }));
        const { error } = await supabase.from('positions').insert(posRows);
        if (error) { await rollback(); throw error; }
      }

      // 2. timeline_items
      await supabase.from('timeline_items').delete().eq('project_id', id);
      if (timelineItems.length > 0) {
        const tlRows = timelineItems.map((item) => ({
          project_id: id!, effect_id: item.effectId, start_time: item.startTime, track_index: item.trackIndex,
          pos_x: item.position.x, pos_y: item.position.y, pos_z: item.position.z,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          position_id: (item as any).positionId || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          position_name: (item as any).positionName || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notes: (item as any).notes || null,
        }));
        const { error } = await supabase.from('timeline_items').insert(tlRows);
        if (error) { await rollback(); throw error; }
      }

      // 3. trajectories + waypoints (previously NEVER persisted — ghost feature)
      const oldTrajIds = (trajSnap.data || []).map((t) => t.id);
      if (oldTrajIds.length) {
        await supabase.from('waypoints').delete().in('trajectory_id', oldTrajIds);
      }
      await supabase.from('trajectories').delete().eq('project_id', id);
      if (trajectories.length > 0) {
        const trajRows = trajectories.map((t) => ({
          id: t.id, project_id: id!, name: t.name, position_id: t.positionId,
        }));
        const { error: trajErr } = await supabase.from('trajectories').insert(trajRows);
        if (trajErr) { await rollback(); throw trajErr; }

        const wpRows = trajectories.flatMap((t) =>
          (t.waypoints || []).map((w, i) => ({
            trajectory_id: t.id, x: w.position.x, y: w.position.y, z: w.position.z,
            time_seconds: w.time, sort_order: i,
          })),
        );
        if (wpRows.length) {
          const { error: wpErr } = await supabase.from('waypoints').insert(wpRows);
          if (wpErr) { await rollback(); throw wpErr; }
        }
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
      toast.error('Erro ao salvar — alterações revertidas para o estado anterior');
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
