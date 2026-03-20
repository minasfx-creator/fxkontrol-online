import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LayoutPreset, LayoutOverrides } from '@/lib/fixtureAutoLayout';
import { toast } from 'sonner';

export interface SavedLayoutPreset {
  id: string;
  name: string;
  preset_base: LayoutPreset;
  category_overrides: Record<string, LayoutOverrides>;
  created_at: string;
}

export function useLayoutPresets() {
  const [presets, setPresets] = useState<SavedLayoutPreset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('layout_presets' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('Failed to load layout presets:', error);
      return;
    }
    setPresets((data as any[]) ?? []);
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const savePreset = useCallback(async (
    name: string,
    presetBase: LayoutPreset,
    categoryOverrides: Record<string, LayoutOverrides>,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Login required to save presets');
      return;
    }
    const { error } = await supabase
      .from('layout_presets' as any)
      .insert({
        user_id: user.id,
        name,
        preset_base: presetBase,
        category_overrides: categoryOverrides as any,
      } as any);
    if (error) {
      toast.error('Failed to save preset');
      console.error(error);
      return;
    }
    toast.success(`Preset "${name}" saved`);
    fetchPresets();
  }, [fetchPresets]);

  const deletePreset = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('layout_presets' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to delete preset');
      return;
    }
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success('Preset deleted');
  }, []);

  return { presets, loading, savePreset, deletePreset, refetch: fetchPresets };
}
