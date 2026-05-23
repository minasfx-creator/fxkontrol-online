import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/store', 'src/lib'];
const extensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (extensions.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

function maskNonCode(source) {
  let output = '';
  let state = 'code';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code';
        output += char;
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        output += '  ';
        i += 1;
        state = 'code';
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      const terminator = state === 'single-quote' ? "'" : state === 'double-quote' ? '"' : '`';
      if (char === '\\') {
        output += ' ';
        if (next) {
          output += next === '\n' ? '\n' : ' ';
          i += 1;
        }
      } else if (char === terminator) {
        output += ' ';
        state = 'code';
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      output += '  ';
      i += 1;
      state = 'line-comment';
      continue;
    }

    if (char === '/' && next === '*') {
      output += '  ';
      i += 1;
      state = 'block-comment';
      continue;
    }

    if (char === "'") state = 'single-quote';
    if (char === '"') state = 'double-quote';
    if (char === '`') state = 'template';
    output += char;
  }

  return output;
}

function findTopLevelSetIntervals(source) {
  const masked = maskNonCode(source);
  const matches = [];
  let braceDepth = 0;
  let line = 1;
  let lineStart = 0;

  for (let i = 0; i < masked.length; i += 1) {
    const char = masked[i];
    if (char === '\n') {
      line += 1;
      lineStart = i + 1;
      continue;
    }

    if (char === '{') braceDepth += 1;
    if (char === '}') braceDepth = Math.max(0, braceDepth - 1);

    if (braceDepth === 0 && masked.startsWith('setInterval', i)) {
      const before = masked[i - 1] ?? '';
      const after = masked[i + 'setInterval'.length] ?? '';
      const prefix = masked.slice(Math.max(0, i - 16), i);
      if (/\btypeof\s*$/.test(prefix)) continue;
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        matches.push({
          line,
          column: i - lineStart + 1,
          text: source.slice(lineStart, source.indexOf('\n', lineStart) === -1 ? source.length : source.indexOf('\n', lineStart)).trim(),
        });
      }
    }
  }

  return matches;
}

const violations = [];
for (const root of roots) {
  for (const file of walk(root)) {
    for (const match of findTopLevelSetIntervals(fs.readFileSync(file, 'utf8'))) {
      violations.push(`${file}:${match.line}:${match.column}: ${match.text}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Global timers detected. Use lifecycle-controlled start/stop functions.');
  console.error(violations.join('\n'));
  process.exit(1);
}
