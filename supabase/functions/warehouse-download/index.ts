const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { modelId, format = 'gltf' } = await req.json();

    if (!modelId) {
      return new Response(JSON.stringify({ error: 'modelId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that modelId looks like a real 3D Warehouse UUID, not a fallback slug
    if (modelId.length < 20 && !/^[0-9a-f]{8}-/.test(modelId)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid model ID',
        message: 'This appears to be a placeholder ID. Search 3D Warehouse for real models.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3D Warehouse provides COLLADA (.dae) downloads via their public API
    // The glTF binary endpoint is at /3dw/GetEntity/modelId?format=gltf
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
          // Verify we got binary data, not an HTML error page
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
      // If direct download fails, try the COLLADA endpoint as last resort
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
      return new Response(JSON.stringify({ 
        error: 'Model download failed',
        message: 'Could not download model from 3D Warehouse. The model may not support glTF export.',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ error: 'Internal error', message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
