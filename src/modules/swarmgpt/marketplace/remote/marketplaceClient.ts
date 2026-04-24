/**
 * Remote marketplace client.
 *
 * Wraps a single CDN-backed marketplace endpoint:
 *   GET  ${baseUrl}/index.json         -> { packages: RemotePackageEntry[] }
 *   GET  ${baseUrl}/p/{id}.json        -> RemotePackageDetail
 *
 * The client is stateless — callers may instantiate one per region / mirror.
 */
import { fetchJson } from "./cdnClient";
import type {
  RemoteFetchOptions,
  RemotePackageDetail,
  RemotePackageEntry,
} from "./types";
import { RemoteMarketplaceError } from "./types";

export type RemoteMarketplaceClientOptions = {
  baseUrl: string;
  /** Optional path resolver; default `${baseUrl}/p/{id}.json`. */
  detailUrlFor?: (id: string) => string;
};

export class RemoteMarketplaceClient {
  readonly baseUrl: string;
  private readonly detailUrlFor: (id: string) => string;

  constructor(opts: RemoteMarketplaceClientOptions) {
    if (!/^https?:\/\//.test(opts.baseUrl)) {
      throw new RemoteMarketplaceError("INVALID_BASE_URL", `baseUrl must be http(s): "${opts.baseUrl}"`);
    }
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.detailUrlFor = opts.detailUrlFor ?? ((id) => `${this.baseUrl}/p/${encodeURIComponent(id)}.json`);
  }

  async listPackages(opts?: RemoteFetchOptions): Promise<RemotePackageEntry[]> {
    const data = await fetchJson<{ packages?: RemotePackageEntry[] }>(`${this.baseUrl}/index.json`, opts);
    if (!data || !Array.isArray(data.packages)) {
      throw new RemoteMarketplaceError("INVALID_INDEX", "Remote index is missing `packages` array.");
    }
    return data.packages;
  }

  async searchPackages(query: string, opts?: RemoteFetchOptions): Promise<RemotePackageEntry[]> {
    const all = await this.listPackages(opts);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => {
      const haystack = `${p.id} ${p.name} ${p.author} ${p.description} ${p.tags.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  async getPackageDetail(id: string, opts?: RemoteFetchOptions): Promise<RemotePackageDetail> {
    const url = this.detailUrlFor(id);
    const detail = await fetchJson<RemotePackageDetail>(url, opts);
    if (!detail || !detail.manifest || !detail.artifactUrl || !detail.integrity || !detail.signature) {
      throw new RemoteMarketplaceError("INVALID_DETAIL", `Malformed package detail for "${id}".`);
    }
    if (detail.manifest.id !== id) {
      throw new RemoteMarketplaceError(
        "ID_MISMATCH",
        `Detail manifest id "${detail.manifest.id}" does not match requested "${id}".`,
      );
    }
    return detail;
  }
}
