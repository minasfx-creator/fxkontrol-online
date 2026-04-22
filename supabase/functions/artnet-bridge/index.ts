import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonError } from "../_shared/response.ts";
import { requireUniverses, validateUniverse } from "../_shared/artnet/validation.ts";
import { handleValidate, handlePoll, handleSync, handleRdm, handleExportBinary, handleSend } from "../_shared/artnet/handlers.ts";
import type { ArtNetRequest } from "../_shared/artnet/types.ts";

serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body: ArtNetRequest = await req.json();
    const { action, universes, targetIp, targetPort } = body;

    switch (action) {
      case 'validate':
        return handleValidate(universes);

      case 'poll':
        return handlePoll(targetIp, targetPort);

      case 'sync':
        return handleSync();

      case 'rdm':
        return handleRdm(body);

      case 'send':
      case 'export-binary': {
        const guard = requireUniverses(universes);
        if (guard) return guard;

        const allErrors: string[] = [];
        for (const u of universes!) allErrors.push(...validateUniverse(u));
        if (allErrors.length > 0) return jsonError('Validation failed', 400, { details: allErrors });

        return action === 'export-binary'
          ? handleExportBinary(universes!, targetIp, targetPort)
          : handleSend(universes!, targetIp, targetPort);
      }

      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return jsonError(error.message, 500);
  }
});
