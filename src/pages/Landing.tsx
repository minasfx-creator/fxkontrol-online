/**
 * Landing — Public marketing page served via iframe from /landing.html.
 * Keeps the supplied HTML 1:1 (Apple-style hero + sections + base64 imagery)
 * while letting CTAs (target="_parent") navigate the SPA to /studio and /pricing.
 */
import { useEffect } from "react";

export default function Landing() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "FX KONTROL — Software de shows pirotécnicos e SFX";
    return () => {
      document.title = prevTitle;
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
