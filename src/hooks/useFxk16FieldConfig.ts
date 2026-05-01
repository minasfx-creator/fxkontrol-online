/**
 * useFxk16FieldConfig — React hook over fxk16FieldConfigStore. Returns
 * the current config + a `set(patch)` updater. Re-renders only when the
 * snapshot identity changes (store mutates atomically).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  fxk16FieldConfig,
  type Fxk16FieldConfig,
} from '@/components/field/fxk16FieldConfigStore';

export function useFxk16FieldConfig() {
  const [config, setConfig] = useState<Fxk16FieldConfig>(() => fxk16FieldConfig.get());

  useEffect(() => {
    const unsub = fxk16FieldConfig.subscribe(setConfig);
    return unsub;
  }, []);

  const set = useCallback((patch: Partial<Fxk16FieldConfig>) => {
    return fxk16FieldConfig.set(patch);
  }, []);

  const reset = useCallback(() => fxk16FieldConfig.reset(), []);

  return { config, set, reset };
}
