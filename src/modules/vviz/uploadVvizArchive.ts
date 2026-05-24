/**
 * uploadVvizArchive — TUS resumable upload for .vviz files.
 *
 * Uses `tus-js-client` (already a project dependency) to split the file into
 * strict 6 MB PATCH requests against Supabase Storage's TUS endpoint.
 * This avoids network timeouts for shows > 20 MB and supports resume on
 * connectivity loss.
 *
 * After a successful upload the caller should invoke `process-vviz` via the
 * Supabase Edge Function to trigger background parsing.
 *
 * @example
 *   const url = await uploadVvizArchive(file, session.access_token, {
 *     bucket: 'vviz-imports',
 *     onProgress: (pct) => setUploadProgress(pct),
 *   });
 *   await supabase.functions.invoke('process-vviz', {
 *     body: { projectId, storagePath: url.storagePath },
 *   });
 */

import * as tus from 'tus-js-client';

// ── Supabase project URL (resolved from env at build time) ────────────────────
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

// ── Chunk size: 6 MB strict — stays well below Supabase's 10 MB body limit ──
const CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export interface UploadVvizOptions {
  /** Storage bucket name. Default: 'vviz-imports'. */
  bucket?: string;
  /** Optional path prefix inside the bucket. Default: '<userId>/<timestamp>/'. */
  pathPrefix?: string;
  /** Progress callback — receives a value in [0, 100]. */
  onProgress?: (percentComplete: number) => void;
  /** Retry delays in ms (default mirrors tus recommended backoff). */
  retryDelays?: number[];
}

export interface UploadVvizResult {
  /** Full TUS upload URL (opaque — use for resuming). */
  tusUrl: string;
  /** Relative path inside the bucket — pass to process-vviz as `storagePath`. */
  storagePath: string;
}

/**
 * Upload `file` to Supabase Storage using the TUS resumable protocol.
 *
 * @param file                - The .vviz File object from an `<input type="file">`.
 * @param supabaseAccessToken - Current user's JWT (from `supabase.auth.getSession()`).
 * @param options             - Upload configuration (bucket, progress, retry).
 * @returns Resolved with the TUS URL + storage path on success; rejects on unrecoverable error.
 */
export function uploadVvizArchive(
  file: File,
  supabaseAccessToken: string,
  options: UploadVvizOptions = {},
): Promise<UploadVvizResult> {
  const {
    bucket       = 'vviz-imports',
    pathPrefix   = `uploads/${Date.now()}/`,
    onProgress,
    retryDelays  = [0, 3_000, 5_000, 10_000, 20_000],
  } = options;

  const storagePath = `${pathPrefix}${file.name}`;
  const endpoint    = `${SUPABASE_URL}/storage/v1/upload/resumable`;

  return new Promise<UploadVvizResult>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays,
      // Strict 6 MB chunks — avoids gateway timeouts on slow connections
      chunkSize: CHUNK_SIZE_BYTES,
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        // Supabase Storage requires the apikey header for TUS uploads
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string ?? '',
      },
      metadata: {
        bucketName:    bucket,
        objectName:    storagePath,
        contentType:   file.type || 'application/octet-stream',
        cacheControl:  '3600',
      },
      // Allow resuming an existing upload for the same file + path combination
      storeFingerprintForResuming: true,
      onError(error: tus.DetailedError | Error) {
        console.error('[uploadVvizArchive] TUS upload error:', error);
        reject(error);
      },
      onProgress(bytesUploaded: number, bytesTotal: number) {
        const pct = bytesTotal > 0
          ? Math.round((bytesUploaded / bytesTotal) * 100)
          : 0;
        console.debug(`[uploadVvizArchive] ${pct}% — ${bytesUploaded}/${bytesTotal} bytes`);
        onProgress?.(pct);
      },
      onSuccess() {
        const tusUrl = upload.url ?? '';
        console.info('[uploadVvizArchive] Upload complete. TUS URI:', tusUrl);
        resolve({ tusUrl, storagePath });
      },
    });

    // Attempt to resume a previous upload before starting fresh
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) {
        console.info(`[uploadVvizArchive] Resuming previous upload (${previous.length} candidates).`);
        upload.resumeFromPreviousUpload(previous[0]);
      }
      upload.start();
    }).catch(() => {
      // findPreviousUploads failed (e.g. IndexedDB unavailable) — start fresh
      upload.start();
    });
  });
}
