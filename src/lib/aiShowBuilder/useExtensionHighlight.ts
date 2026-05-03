import { useEffect, useState } from 'react';
import { extensionHighlight, type ExtensionHighlight } from './extensionHighlight';

/** React subscription helper para ExtensionHighlight singleton. */
export function useExtensionHighlight(): ExtensionHighlight | null {
  const [h, setH] = useState<ExtensionHighlight | null>(() => extensionHighlight.get());
  useEffect(() => extensionHighlight.subscribe(setH), []);
  return h;
}
