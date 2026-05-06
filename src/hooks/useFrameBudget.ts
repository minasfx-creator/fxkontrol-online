import { useEffect, useState } from 'react';
import { subscribeFrameBudget, getFrameBudget, type FrameBudgetSnapshot } from '@/ecs/frameBudget';

export function useFrameBudget(): FrameBudgetSnapshot {
  const [s, setS] = useState<FrameBudgetSnapshot>(() => getFrameBudget());
  useEffect(() => subscribeFrameBudget(setS), []);
  return s;
}
