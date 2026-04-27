/**
 * Local ESLint plugin — project-specific rules that don't belong in
 * any published package. Loaded by eslint.config.js as `local`.
 */
import noZustandWithoutSelector from './no-zustand-without-selector.js';

export default {
  rules: {
    'no-zustand-without-selector': noZustandWithoutSelector,
  },
};
