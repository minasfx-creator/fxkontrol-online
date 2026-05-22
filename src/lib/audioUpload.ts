/**
 * Shared audio-upload helper. Used by:
 *   - AudioWaveform's "Upload MP3/WAV" button
 *   - useViewportDrop, when an audio file is dropped on the editor
 *
 * Uploads the file to the Supabase `audio` bucket under the user's namespace,
 * returns a 1h signed URL, and sets it as the project's `audioUrl` so the
 * waveform/BPM detection/playback sync chain picks it up automatically.
 */
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

export const SUPPORTED_AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'webm', 'opus',
] as const;

export function isAudioFile(file: File): boolean {
  if (file.type?.startsWith('audio/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

export interface UploadAudioResult {
  ok: boolean;
  signedUrl?: string;
  error?: string;
}

export async function uploadAudioForProject(file: File, userId: string | undefined | null): Promise<UploadAudioResult> {
  if (!userId) {
    toast.error('Faça login para enviar áudio para o projeto');
    return { ok: false, error: 'unauthenticated' };
  }
  try {
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('audio').upload(path, file);
    if (uploadError) throw uploadError;

    const { data: signedData, error: signError } = await supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);
    if (signError) throw signError;

    useProjectStore.getState().setAudioUrl(signedData.signedUrl);
    toast.success(`🎵 ${file.name} carregado · sincronizado com a timeline`);
    return { ok: true, signedUrl: signedData.signedUrl };
  } catch (err: any) {
    const msg = err?.message || 'Erro no upload de áudio';
    toast.error(msg);
    return { ok: false, error: msg };
  }
}
