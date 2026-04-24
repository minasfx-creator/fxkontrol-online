/**
 * CDN/HTTP client with timeout, bounded retries, and size-capped binary fetch.
 *
 * Pure fetch — no DOM, no auth headers, no cookies. Intended for immutable
 * CDN-hosted artifacts and JSON manifests.
 */
import type { RemoteFetchOptions } from "./types";
import { RemoteMarketplaceError } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_MS = 250;

export async function fetchJson<T>(url: string, opts: RemoteFetchOptions = {}): Promise<T> {
  const res = await fetchWithRetry(url, opts, "FETCH_JSON_FAILED");
  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new RemoteMarketplaceError("INVALID_JSON", `Invalid JSON from ${url}`, err);
  }
}

export async function fetchBytes(
  url: string,
  maxBytes: number,
  opts: RemoteFetchOptions = {},
): Promise<Uint8Array> {
  const res = await fetchWithRetry(url, opts, "FETCH_BYTES_FAILED");

  // Defensive: reject obviously oversized responses before reading.
  const contentLength = Number(res.headers.get("content-length") ?? "0");
  if (contentLength > 0 && contentLength > maxBytes) {
    throw new RemoteMarketplaceError(
      "ARTIFACT_TOO_LARGE",
      `Artifact at ${url} declares ${contentLength} bytes, exceeds cap ${maxBytes}.`,
    );
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new RemoteMarketplaceError(
        "ARTIFACT_TOO_LARGE",
        `Artifact at ${url} (${buf.byteLength} bytes) exceeds cap ${maxBytes}.`,
      );
    }
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  // Stream so we can abort early on oversize without buffering everything.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* swallow */
      }
      throw new RemoteMarketplaceError(
        "ARTIFACT_TOO_LARGE",
        `Artifact at ${url} streamed past cap ${maxBytes} bytes.`,
      );
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

async function fetchWithRetry(
  url: string,
  opts: RemoteFetchOptions,
  errCode: string,
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, opts.retries ?? DEFAULT_RETRIES);

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onUserAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onUserAbort, { once: true });

    try {
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      if (res.ok) return res;
      // Retry on 5xx, fail fast on 4xx.
      if (res.status >= 500 && attempt < retries) {
        lastErr = new RemoteMarketplaceError(errCode, `HTTP ${res.status} from ${url}`);
      } else {
        throw new RemoteMarketplaceError(errCode, `HTTP ${res.status} from ${url}`);
      }
    } catch (err) {
      lastErr = err;
      if (opts.signal?.aborted) {
        throw new RemoteMarketplaceError("ABORTED", `Request to ${url} aborted by caller.`, err);
      }
      if (attempt >= retries) {
        if (err instanceof RemoteMarketplaceError) throw err;
        throw new RemoteMarketplaceError(errCode, `Network failure for ${url}`, err);
      }
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onUserAbort);
    }

    // Exponential backoff with jitter.
    const delay = RETRY_BASE_MS * 2 ** attempt + Math.random() * RETRY_BASE_MS;
    await sleep(delay);
  }

  throw lastErr instanceof RemoteMarketplaceError
    ? lastErr
    : new RemoteMarketplaceError(errCode, `Exhausted retries for ${url}`, lastErr);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
