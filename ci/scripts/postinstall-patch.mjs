import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = path.resolve('node_modules', '@n8n', 'rest-api-client', 'dist', 'utils2.cjs');

try {
  await access(target);
} catch {
  console.warn('[postinstall] @n8n/rest-api-client not found; skipping patch');
  process.exit(0);
}

const marker = '{}.env.NODE_ENV';
const replacement = '((typeof process !== "undefined" && process.env) ? process.env : {}).NODE_ENV';

let contents = await readFile(target, 'utf8');
if (!contents.includes(marker)) {
  console.log('[postinstall] patch already applied');
  process.exit(0);
}

contents = contents.replace(marker, replacement);
await writeFile(target, contents);
console.log('[postinstall] patched rest-api-client utils for process.env access');
