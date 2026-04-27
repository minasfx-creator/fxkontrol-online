/**
 * Local ESLint plugin — project-specific rules that don't belong in
 * any published package. Loaded by eslint.config.js as `local`.
 */
'use strict';

const noZustandWithoutSelector = require('./no-zustand-without-selector');

module.exports = {
  rules: {
    'no-zustand-without-selector': noZustandWithoutSelector,
  },
};
