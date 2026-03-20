

# Fix: 3D Engine Crash — SiteModelRenderer loading invalid URLs

## Problem
The error `Could not load : Unexpected token '<', "<!doctype "... is not valid JSON` means `useGLTF(model.url)` in `SiteModelRenderer.tsx` is trying to load a model with an empty or revoked blob URL. The server returns an HTML 404 page instead of a GLB file, which crashes the R3F Canvas and triggers the WebGLErrorBoundary fallback ("3D Engine Unavailable").

This happens when:
1. A blob URL from SceneObjectImporter gets revoked (page reload, dialog close cleanup)
2. A model URL is empty or corrupted in the store

## Fix

### 1. `SiteModelRenderer.tsx` — Add URL validation + error boundary per model
- Skip rendering models with empty/invalid URLs
- Wrap each `LoadedModel` in its own error boundary so one bad model doesn't crash the entire 3D canvas
- Validate `model.url` before passing to `useGLTF`

### 2. `SceneObjectImporter.tsx` — Don't revoke blob URL on dialog close
- Currently line 48 sets `setObjectUrl(null)` after import, but the blob URL is still used by the scene store. Remove the revocation on import success (the URL must stay alive for the renderer).
- Only revoke when replacing with a new file selection.

## Files

| File | Action |
|------|--------|
| `src/components/editor/SiteModelRenderer.tsx` | Edit — add per-model error boundary + URL validation |
| `src/components/editor/SceneObjectImporter.tsx` | Edit — don't revoke blob URL after successful import |

