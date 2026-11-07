// Generates the markdown API reference in docs/api/ from the JSDoc of the
// package entry points (see typedoc.json), then labels each module with the
// import specifier it is consumed with instead of the entry file name.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'api');

// Entry file name -> import specifier, in display order.
const modules = {
  index: 'valifetch',
  error: 'valifetch/error',
  types: 'valifetch/types',
  auth: 'valifetch/auth',
  mock: 'valifetch/mock',
};

execFileSync(
  process.execPath,
  [
    '--import',
    path.join(root, 'scripts', 'typedoc-minimatch-compat.mjs'),
    path.join(root, 'node_modules', 'typedoc', 'bin', 'typedoc'),
  ],
  { cwd: root, stdio: 'inherit' }
);

// Generated pages have no hand-editable source in docs/, so hide the
// "Edit this page" link on every one of them.
function hideEditLink(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hideEditLink(full);
    else if (entry.name.endsWith('.md')) {
      writeFileSync(
        full,
        `---\neditLink: false\n---\n\n${readFileSync(full, 'utf8')}`
      );
    }
  }
}

for (const [name, specifier] of Object.entries(modules)) {
  const file = path.join(outDir, name, 'index.md');
  const content = readFileSync(file, 'utf8');
  writeFileSync(file, content.replace(/^# .*/, `# ${specifier}`));
}

const overview = path.join(outDir, 'index.md');
const lines = readFileSync(overview, 'utf8')
  .split('\n')
  .filter((line) => !line.startsWith('- ['));
const insertAt = lines.indexOf('## Modules') + 2;
lines.splice(
  insertAt,
  0,
  ...Object.entries(modules).map(
    ([name, specifier]) => `- [${specifier}](${name}/index.md)`
  )
);
writeFileSync(overview, lines.join('\n'));

hideEditLink(outDir);

const sidebarFile = path.join(outDir, 'typedoc-sidebar.json');
const sidebar = JSON.parse(readFileSync(sidebarFile, 'utf8'));
const byName = new Map(sidebar.map((item) => [item.text, item]));
const relabeled = Object.entries(modules).map(([name, specifier]) => {
  const item = byName.get(name);
  if (!item) throw new Error(`Module missing from API sidebar: ${name}`);
  return { ...item, text: specifier };
});
writeFileSync(sidebarFile, JSON.stringify(relabeled, null, 2));
