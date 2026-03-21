import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Hook to save/load projects from the database.
 * Auto-saves every 30 seconds when there are changes.
 */
export function useProjectPersistence() {
  const { user } = useAuth();
  const lastSavedRef = useRef<string>('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveProject = useCallback(async () => {
    if (!user) return false;

    const state = useProjectStore.getState();
    const {
      projectName, duration, timelineItems, positions,
      trajectories, droneFormations, cameraKeyframes,
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
        // Update existing
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', id);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
        useProjectStore.getState().setProjectId(id);
      }

      // Save positions
      if (id) {
        // Delete existing and re-insert
        await supabase.from('positions').delete().eq('project_id', id);
        if (positions.length > 0) {
          const posRows = positions.map((p, i) => ({
            project_id: id!,
            name: p.name,
            type: p.type,
            x: p.x,
            y: p.y,
            z: p.z,
            heading: p.heading,
            pitch: p.pitch,
            roll: p.roll,
            color: p.color,
            sort_order: i,
          }));
          const { error } = await supabase.from('positions').insert(posRows);
          if (error) console.warn('Position save error:', error.message);
        }

        // Save timeline items
        await supabase.from('timeline_items').delete().eq('project_id', id);
        if (timelineItems.length > 0) {
          const tlRows = timelineItems.map(item => ({
            project_id: id!,
            effect_id: item.effectId,
            start_time: item.startTime,
            track_index: item.trackIndex,
            pos_x: item.position.x,
            pos_y: item.position.y,
            pos_z: item.position.z,
            position_id: (item as any).positionId || null,
            position_name: (item as any).positionName || null,
            notes: (item as any).notes || null,
          }));
          const { error } = await supabase.from('timeline_items').insert(tlRows);
          if (error) console.warn('Timeline save error:', error.message);
        }
      }

      lastSavedRef.current = JSON.stringify({ projectName, duration, timelineItems: timelineItems.length, positions: positions.length });
      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      return false;
    }
  }, [user]);

  const loadProject = useCallback(async (projectId: string) => {
    if (!user) return false;

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      const store = useProjectStore.getState();
      store.setProjectId(project.id);
      store.setProjectName(project.name);
      store.setDuration(project.duration);
      if (project.audio_url) store.setAudioUrl(project.audio_url);
      if (project.bpm) store.setBpm(project.bpm);
      store.setPlaybackSpeed(project.playback_speed);

      // Load positions
      const { data: posData } = await supabase
        .from('positions')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');

      if (posData) {
        for (const p of posData) {
          store.addPosition({
            id: p.id,
            name: p.name,
            type: p.type as any,
            x: p.x,
            y: p.y,
            z: p.z,
            heading: p.heading,
            pitch: p.pitch,
            roll: p.roll,
            color: p.color,
          });
        }
      }

      // Load timeline items
      const { data: tlData } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('project_id', projectId);

      if (tlData) {
        for (const item of tlData) {
          store.addTimelineItem({
            id: item.id,
            effectId: item.effect_id,
            startTime: item.start_time,
            trackIndex: item.track_index,
            position: { x: item.pos_x, y: item.pos_y, z: item.pos_z },
          });
        }
      }

      // Load trajectories + waypoints
      const { data: trajData } = await supabase
        .from('trajectories')
        .select('*, waypoints(*)')
        .eq('project_id', projectId);

      if (trajData) {
        for (const t of trajData) {
          const waypoints = ((t as any).waypoints || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((w: any) => ({
              id: w.id,
              position: { x: w.x, y: w.y, z: w.z },
              time: w.time_seconds,
            }));

          store.addTrajectory({
            id: t.id,
            positionId: t.position_id,
            name: t.name,
            waypoints,
          });
        }
      }

      return true;
    } catch (err: any) {
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

    if (error) {
      console.error('List error:', error);
      return [];
    }
    return data || [];
  }, [user]);

  const deleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast.error('Erro ao deletar projeto');
      return false;
    }
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
      });

      if (snapshot !== lastSavedRef.current && (state.timelineItems.length > 0 || state.positions.length > 0)) {
        const ok = await saveProject();
        if (ok) {
          // Silent auto-save
        }
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [user, saveProject]);

  return { saveProject, loadProject, listProjects, deleteProject };
}
