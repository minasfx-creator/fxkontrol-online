import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  phone: string;
  company: string;
  role_title: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        // Auto-create profile if missing
        if (!data) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({ id: user.id, display_name: user.email?.split('@')[0] ?? '' })
            .select()
            .single();
          setProfile(newProfile as Profile | null);
        }
      } else {
        setProfile(data as Profile | null);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Erro ao salvar perfil', description: error.message, variant: 'destructive' });
    } else {
      setProfile(prev => prev ? { ...prev, ...updates } : prev);
      toast({ title: 'Perfil atualizado' });
    }
  };

  return { profile, loading, updateProfile };
}
