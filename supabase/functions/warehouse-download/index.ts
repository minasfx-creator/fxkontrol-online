import { handleCors } from "../_shared/cors.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { modelId, format = 'gltf' } = await req.json();

    if (!modelId) return jsonError('modelId is required', 400);

    if (modelId.length < 20 && !/^[0-9a-f]{8}-/.test(modelId)) {
      return jsonError('Invalid model ID', 400, {
        message: 'This appears to be a placeholder ID. Search 3D Warehouse for real models.',
      });
    }

    const downloadUrls = [
      `https://3dwarehouse.sketchup.com/3dw/GetBinary?id=${modelId}&format=gltf`,
      `https://3dwarehouse.sketchup.com/3dw/GetEntity/${modelId}?format=gltf`,
      `https://3dwarehouse.sketchup.com/3dw/GetBinary/${modelId}?format=glb`,
    ];

    let modelData: ArrayBuffer | null = null;
    let contentType = 'model/gltf-binary';

    for (const url of downloadUrls) {
      try {
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/octet-stream, model/gltf-binary, */*',
            'User-Agent': 'FXKontrol/1.0',
          },
        });

        if (resp.ok) {
          const ct = resp.headers.get('content-type') || '';
          if (!ct.includes('text/html')) {
            modelData = await resp.arrayBuffer();
            if (ct) contentType = ct;
            break;
          }
        }
      } catch {
        // Try next URL
      }
    }

    if (!modelData || modelData.byteLength < 100) {
      try {
        const colladaUrl = `https://3dwarehouse.sketchup.com/3dw/GetBinary?id=${modelId}&format=dae`;
        const resp = await fetch(colladaUrl, {
          headers: { 'User-Agent': 'FXKontrol/1.0' },
        });
        if (resp.ok) {
          modelData = await resp.arrayBuffer();
          contentType = 'model/vnd.collada+xml';
        }
      } catch {
        // Fall through to error
      }
    }

    if (!modelData || modelData.byteLength < 100) {
      return jsonError('Model download failed', 404, {
        message: 'Could not download model from 3D Warehouse. The model may not support glTF export.',
      });
    }

    return new Response(modelData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': String(modelData.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return jsonError('Internal error', 500, { message: String(err) });
  }
});
