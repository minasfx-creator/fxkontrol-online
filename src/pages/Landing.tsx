/**
 * Landing — Public marketing page served via iframe from /landing.html.
 * Keeps the supplied HTML 1:1 (Apple-style hero + sections + base64 imagery)
 * while letting CTAs (target="_parent") navigate the SPA to /studio and /pricing.
 *
 * SEO note: crawlers landing on /landing read the SPA's <head> (index.html), not
 * the iframe — so we override title/description/OG/Twitter/canonical at runtime
 * to match the marketing copy and ensure correct social previews.
 */
import { useEffect } from "react";

const TITLE = "FX KONTROL — Software de shows pirotécnicos, SFX, DMX e ArtNet";
const DESC =
  "FX KONTROL é a plataforma moderna para design, simulação e controle de shows pirotécnicos, SFX, drones, DMX e ArtNet. Migre do Finale 3D com menor custo e mais automação.";
const CANONICAL = "https://fxkontrol.online/landing";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/HNWwID77XlhLhwds00GYkOiIPMm2/social-images/social-1777070046139-ChatGPT_Image_23_de_abr._de_2026,_21_34_00.webp";

/** Upsert a <meta> by name or property. Returns the (possibly created) element. */
function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("content");
  el.setAttribute("content", content);
  return { el, prev, created: prev === null };
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("href");
  el.setAttribute("href", href);
  return { el, prev, created: prev === null };
}

export default function Landing() {
  useEffect(() => {
    // Snapshot previous values so we restore them when leaving the route.
    const prevTitle = document.title;
    document.title = TITLE;

    const restorers: Array<() => void> = [];
    const apply = (
      attr: "name" | "property",
      key: string,
      content: string,
    ) => {
      const { el, prev, created } = upsertMeta(attr, key, content);
      restorers.push(() => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute("content", prev);
      });
    };
    const applyLink = (rel: string, href: string) => {
      const { el, prev, created } = upsertLink(rel, href);
      restorers.push(() => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute("href", prev);
      });
    };

    apply("name", "description", DESC);
    apply("name", "robots", "index,follow");
    apply("name", "author", "Minas FX");
    apply("property", "og:type", "website");
    apply("property", "og:site_name", "FX KONTROL");
    apply("property", "og:locale", "pt_BR");
    apply("property", "og:url", CANONICAL);
    apply("property", "og:title", TITLE);
    apply("property", "og:description", DESC);
    apply("property", "og:image", OG_IMAGE);
    apply("property", "og:image:width", "1200");
    apply("property", "og:image:height", "630");
    apply("name", "twitter:card", "summary_large_image");
    apply("name", "twitter:site", "@MinasFX");
    apply("name", "twitter:title", TITLE);
    apply("name", "twitter:description", DESC);
    apply("name", "twitter:image", OG_IMAGE);
    applyLink("canonical", CANONICAL);

    return () => {
      document.title = prevTitle;
      restorers.forEach((r) => r());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#050509]">
      <iframe
        src="/landing.html"
        title="FX KONTROL Landing"
        className="w-full h-full border-0"
        style={{ width: "100%", height: "100dvh" }}
      />
    </div>
  );
}
