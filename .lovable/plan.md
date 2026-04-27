# Round 8 — Results

## Carry-forward from Round 7
- ✅ `grok-choreography` structured 401 + actionable copy — **VERIFIED end-to-end** via `curl_edge_functions`. Response body is exactly the user-facing message:
  `{"ok":false,"error":"Invalid XAI_API_KEY — update the secret in Lovable Cloud → Backend → Secrets."}`
- ⏳ User still needs to rotate `XAI_API_KEY` (only blocker for AI Choreography)

## Round 8 health snapshot
- ✅ Tests: **604/604 passing** (56 test files, 25.9s)
- ✅ Typecheck: clean
- ✅ Build: green

## Security scan triage (49 findings, all WARN — no errors)

| Bucket | Count | Status | Action |
|---|---|---|---|
| `pg_graphql_anon_table_exposed` (introspection of public-readable rows) | 40 | Informational | Documented as intentional in lint description — no action |
| `rls_policy_always_true` | 2 | **Reviewed — intentional** | `beta_feedback` + `early_access_signups` are landing-page INSERT-only forms requiring unauthenticated submission. No SELECT exposure to anon. Safe by design. |
| `function_search_path_mutable` | 4 | **Actionable** — needs migration | `move_to_dlq`, `delete_email`, `read_email_batch`, `enqueue_email`. Migration drafted but requires user approval. |
| `OTHER` (assorted info) | 3 | Informational | No action |

### Pending migration (one user approval to fix all 4 search_path warnings)
```sql
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)  SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint)               SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb)               SET search_path = public, pg_temp;
```
Pure hardening — function bodies unchanged. Approve to clear the last actionable security warnings.

## Action items for the user
1. **Rotate `XAI_API_KEY`** — Lovable Cloud → Backend → Secrets. Until then, AI Choreography shows the friendly toast. ✅ Round 7 fix confirmed working.
2. **Approve the search_path migration** above to close the last 4 actionable security warnings.

## Out of scope (carried forward)
- 3D viewport interactive testing — headless browser has no GPU. SkyCanvas fallback guard already shipped Round 6.
- 575 `no-explicit-any` baseline at protocol boundaries — documented buckets, no action.
- pg_graphql introspection (40 warnings) — intentional behavior per the linter's own description.
