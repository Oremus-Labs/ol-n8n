import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const targetPath = process.argv[2];

if (!targetPath) {
  console.error('[normalize-schema] Usage: node ci/scripts/normalize-schema.mjs <schema.json>');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), targetPath);

const raw = await readFile(resolvedPath, 'utf8');
const schema = JSON.parse(raw);

const definitions = schema.definitions;
if (!definitions) {
  await writeFile(resolvedPath, JSON.stringify(schema, null, 2));
  process.exit(0);
}

const sanitizeKey = (key) => key.replace(/[^A-Za-z0-9_.-]/g, '_');
const renameMap = new Map();
const occupied = new Set(Object.keys(definitions));
const counters = new Map();

for (const key of Object.keys(definitions)) {
  const cleaned = sanitizeKey(key);
  if (cleaned === key) {
    continue;
  }
  let candidate = cleaned;
  let attempts = counters.get(cleaned) ?? 0;
  while (occupied.has(candidate)) {
    attempts += 1;
    candidate = `${cleaned}_${attempts}`;
  }
  counters.set(cleaned, attempts);
  renameMap.set(key, candidate);
  occupied.add(candidate);
  occupied.delete(key);
}

if (renameMap.size === 0) {
  await writeFile(resolvedPath, JSON.stringify(schema, null, 2));
  process.exit(0);
}

const newDefinitions = {};
for (const [key, value] of Object.entries(definitions)) {
  const targetKey = renameMap.get(key) ?? key;
  newDefinitions[targetKey] = value;
}
schema.definitions = newDefinitions;

const pointerMap = new Map();
for (const [oldKey, newKey] of renameMap.entries()) {
  const encoded = encodeURIComponent(oldKey);
  pointerMap.set(`#/definitions/${encoded}`, `#/definitions/${newKey}`);
}

const rewriteRefs = (node) => {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach(rewriteRefs);
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && pointerMap.has(value)) {
        node[key] = pointerMap.get(value);
        continue;
      }
      rewriteRefs(value);
    }
  }
};

rewriteRefs(schema);

await writeFile(resolvedPath, JSON.stringify(schema, null, 2));
console.log('[normalize-schema] Updated schema definitions for JSON pointer compatibility');
