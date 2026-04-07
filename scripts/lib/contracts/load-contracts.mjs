import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(rootDir, relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function loadDomain(rootDir, entries = {}) {
  const loadedEntries = await Promise.all(
    Object.entries(entries).map(async ([key, relativePath]) => [key, await readJson(rootDir, relativePath)]),
  );
  return Object.fromEntries(loadedEntries);
}

export async function loadContracts(rootDir) {
  const index = await readJson(rootDir, 'contracts/index.json');

  return {
    index,
    schema: await loadDomain(rootDir, index.schema),
    setup: await loadDomain(rootDir, index.setup),
    sdk: await loadDomain(rootDir, index.sdk),
  };
}
