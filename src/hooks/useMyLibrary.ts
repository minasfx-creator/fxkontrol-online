import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface LibraryAsset {
  id: string;
  user_id: string;
  name: string;
  source: string;
  file_format: string;
  file_size: number;
  file_path: string;
  thumbnail_base64: string | null;
  tags: string[];
  created_at: string;
}

export function useMyLibrary() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_library_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssets((data as any[]) || []);
    } catch (err: any) {
      console.error('Library fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const saveToLibrary = useCallback(async (
    file: File | Blob,
    metadata: { name: string; source: string; file_format: string; thumbnail_base64?: string; tags?: string[] }
  ): Promise<LibraryAsset | null> => {
    if (!user) { toast.error('Faça login para salvar na biblioteca'); return null; }

    const filePath = `${user.id}/${Date.now()}-${metadata.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${metadata.file_format}`;

    try {
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { contentType: 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;

      // Save metadata
      const { data, error } = await supabase
        .from('user_library_assets')
        .insert({
          user_id: user.id,
          name: metadata.name,
          source: metadata.source,
          file_format: metadata.file_format,
          file_size: file instanceof File ? file.size : file.size,
          file_path: filePath,
          thumbnail_base64: metadata.thumbnail_base64 || null,
          tags: metadata.tags || [],
        } as any)
        .select()
        .single();

      if (error) throw error;
      const asset = data as any as LibraryAsset;
      setAssets(prev => [asset, ...prev]);
      return asset;
    } catch (err: any) {
      console.error('Save to library error:', err);
      toast.error(`Erro ao salvar: ${err.message}`);
      return null;
    }
  }, [user]);

  const deleteFromLibrary = useCallback(async (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    try {
      // Delete from storage
      await supabase.storage.from('assets').remove([asset.file_path]);
      // Delete metadata
      const { error } = await supabase.from('user_library_assets').delete().eq('id', id) as any;
      if (error) throw error;
      setAssets(prev => prev.filter(a => a.id !== id));
      toast.success(`"${asset.name}" removido da biblioteca`);
    } catch (err: any) {
      toast.error(`Erro ao deletar: ${err.message}`);
    }
  }, [assets]);

  const downloadAsset = useCallback(async (asset: LibraryAsset): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('assets')
        .download(asset.file_path);
      if (error) throw error;
      return URL.createObjectURL(data);
    } catch (err: any) {
      toast.error(`Erro ao baixar: ${err.message}`);
      return null;
    }
  }, []);

  return { assets, loading, fetchAssets, saveToLibrary, deleteFromLibrary, downloadAsset };
}
