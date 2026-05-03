import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

/**
 * useIsMobile — true when the *device* is mobile, not just when the window
 * is narrow. Critical fix: phones in landscape go from ~414w to ~896w, which
 * used to flip the editor into the heavy DESKTOP layout (toolbar + timeline
 * 34vh + segment dock + floating panels) on a touch device, hanging the
 * SkyCanvas boot. Now we also classify as mobile when:
 *
 *   - viewport width < 768  (portrait phone — original rule), OR
 *   - viewport height ≤ 500 AND pointer is coarse  (phone in landscape), OR
 *   - the user-agent looks like a phone/tablet  (final safety net)
 *
 * Pointer-coarse + low height is the canonical signal for "small touch
 * device, currently rotated". Desktop browsers with a wide window stay on
 * the desktop layout.
 */
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < MOBILE_BREAKPOINT) return true;
  let coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch { /* ignore */ }
  if (coarse && h <= MOBILE_LANDSCAPE_MAX_HEIGHT) return true;
  if (coarse && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return false;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(detectMobile);

  React.useEffect(() => {
    const onChange = () => setIsMobile(detectMobile());
    const mqlWidth = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlHeight = window.matchMedia(`(max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT}px)`);
    mqlWidth.addEventListener('change', onChange);
    mqlHeight.addEventListener('change', onChange);
    window.addEventListener('orientationchange', onChange);
    window.addEventListener('resize', onChange);
    onChange();
    return () => {
      mqlWidth.removeEventListener('change', onChange);
      mqlHeight.removeEventListener('change', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  return !!isMobile;
}
