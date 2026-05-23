/**
 * no-zustand-without-selector
 * ─────────────────────────────────────────────────────────────────
 * Performance guardrail for Zustand consumers.
 *
 * Forbids two patterns that subscribe components to the *entire* store
 * and trigger re-renders on every unrelated state change:
 *
 *   1. `useXStore()` with no arguments
 *      → subscribes to all state. Operator-facing hot paths (timeline,
 *        viewport, hardware sync) must never do this.
 *
 *   2. `useXStore(s => ({ a: s.a, b: s.b }))` without `useShallow`
 *      → returns a fresh object reference every render, so the default
 *        `Object.is` equality check always fails. Renders fire on every
 *        store change anywhere in the slice. Must be wrapped in
 *        `useShallow(...)` from `zustand/react/shallow`.
 *
 * The rule pattern-matches any identifier that ends in "Store" and
 * starts with "use", which is the convention enforced across this
 * codebase (see src/store/*.ts and src/stores/*.ts).
 *
 * Auto-fix is intentionally NOT provided: rewriting the call site
 * requires choosing per-field selectors vs. an object + useShallow,
 * which is a judgement call. The error message points the operator
 * at the two valid shapes.
 */


/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an explicit selector for Zustand store hooks; require useShallow when returning an object literal.',
      recommended: true,
    },
    schema: [],
    messages: {
      noBareCall:
        '`{{name}}()` subscribes to the entire store and re-renders on every change. Pass a selector: `{{name}}((s) => s.field)` or wrap multi-field selectors with `useShallow`.',
      objectLiteralWithoutShallow:
        '`{{name}}((s) => ({{ ... }}))` returns a fresh object every render, defeating Zustand equality checks. Wrap with `useShallow` from `zustand/react/shallow`.',
    },
  },
  create(context) {
    const isStoreHookName = (name) =>
      typeof name === 'string' && /^use[A-Z]\w*Store$/.test(name);

    const isShallowWrapped = (arg) =>
      arg &&
      arg.type === 'CallExpression' &&
      arg.callee.type === 'Identifier' &&
      arg.callee.name === 'useShallow';

    const returnsObjectLiteral = (arg) => {
      if (!arg) return false;
      if (arg.type !== 'ArrowFunctionExpression' && arg.type !== 'FunctionExpression') {
        return false;
      }
      // `(s) => ({ ... })`
      if (arg.body.type === 'ObjectExpression') return true;
      // `(s) => { return { ... } }`
      if (arg.body.type === 'BlockStatement') {
        for (const stmt of arg.body.body) {
          if (stmt.type === 'ReturnStatement' && stmt.argument?.type === 'ObjectExpression') {
            return true;
          }
        }
      }
      return false;
    };

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        const name = node.callee.name;
        if (!isStoreHookName(name)) return;

        // Pattern 1: bare call with no selector.
        if (node.arguments.length === 0) {
          context.report({ node, messageId: 'noBareCall', data: { name } });
          return;
        }

        // Pattern 2: object-literal selector without useShallow.
        const first = node.arguments[0];
        if (returnsObjectLiteral(first) && !isShallowWrapped(first)) {
          context.report({
            node,
            messageId: 'objectLiteralWithoutShallow',
            data: { name },
          });
        }
      },
    };
  },
};
