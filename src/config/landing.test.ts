import { describe, it, expect } from "vitest";
import { decideLandingRedirect, LANDING_SITE } from "./landing";

describe("decideLandingRedirect", () => {
  const cfg = LANDING_SITE;

  it("noop quando já é canônico", () => {
    const r = decideLandingRedirect("https://fxkontrol.online/landing", cfg);
    expect(r.kind).toBe("noop");
  });

  it("hard-redirect de host alias (www → apex)", () => {
    const r = decideLandingRedirect("https://www.fxkontrol.online/landing", cfg);
    expect(r.kind).toBe("hard-redirect");
    expect((r as any).to).toBe("https://fxkontrol.online/landing");
  });

  it("hard-redirect de subdomínio Lovable publicado para canônico", () => {
    const r = decideLandingRedirect("https://fxkontrol-online.lovable.app/landing", cfg);
    expect(r.kind).toBe("hard-redirect");
    expect((r as any).to).toBe("https://fxkontrol.online/landing");
  });

  it("noop em preview host (id-preview--*)", () => {
    const r = decideLandingRedirect(
      "https://id-preview--abc.lovable.app/landing",
      cfg,
    );
    expect(r.kind).toBe("noop");
    expect((r as any).reason).toBe("preview-host");
  });

  it("noop em localhost", () => {
    const r = decideLandingRedirect("http://localhost:8080/landing", cfg);
    expect(r.kind).toBe("noop");
  });

  it("spa-replace remove utm_* e fbclid", () => {
    const r = decideLandingRedirect(
      "https://fxkontrol.online/landing?utm_source=ig&utm_medium=cpc&fbclid=xyz",
      cfg,
    );
    expect(r.kind).toBe("spa-replace");
    expect((r as any).to).toBe("/landing");
  });

  it("preserva ?target=mobile no redirect cross-origin", () => {
    const r = decideLandingRedirect(
      "https://www.fxkontrol.online/landing?target=mobile&utm_source=x",
      cfg,
    );
    expect(r.kind).toBe("hard-redirect");
    expect((r as any).to).toBe("https://fxkontrol.online/landing?target=mobile");
  });

  it("spa-replace normaliza trailing slash em /landing/", () => {
    const r = decideLandingRedirect("https://fxkontrol.online/landing/", cfg);
    expect(r.kind).toBe("spa-replace");
    expect((r as any).to).toBe("/landing");
  });

  it("preserva hash âncora", () => {
    const r = decideLandingRedirect(
      "https://www.fxkontrol.online/landing#pricing",
      cfg,
    );
    expect(r.kind).toBe("hard-redirect");
    expect((r as any).to).toBe("https://fxkontrol.online/landing#pricing");
  });
});
