import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError } from "./response.ts";

/**
 * Validate the Authorization header and return a Supabase client + userId.
 * Returns an error Response if auth fails.
 */
export async function requireAuth(req: Request): Promise<
  | { client: ReturnType<typeof createClient>; userId: string; error?: never }
  | { error: Response; client?: never; userId?: never }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonError("Unauthorized", 401) };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: jsonError("Unauthorized", 401) };
  }

  return { client: supabase, userId: user.id };
}

/**
 * Require a specific secret env var. Returns error Response if missing.
 */
export function requireSecret(name: string): string | Response {
  const value = Deno.env.get(name);
  if (!value) {
    return jsonError(`${name} is not configured`, 500);
  }
  return value;
}
