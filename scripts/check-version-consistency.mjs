#!/usr/bin/env node
// Guard against version drift: package.json is the single source of truth, and
// both generated manifests must carry that same version. Run after a build
// (`npm run build` + `npm run build:firefox`). Exits non-zero on any mismatch.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;

const targets = [
  ['chrome', path.join(root, '.output/chrome-mv3/manifest.json')],
  ['firefox', path.join(root, '.output/firefox-mv3/manifest.json')],
];

let failed = false;

for (const [name, file] of targets) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✖ ${name}: cannot read ${path.relative(root, file)} (${err.code}). Build first.`);
    failed = true;
    continue;
  }
  if (manifest.version !== version) {
    console.error(`✖ ${name}: manifest version ${manifest.version} != package.json ${version}`);
    failed = true;
  } else {
    console.log(`✔ ${name}: manifest version ${version}`);
  }
}

if (failed) {
  console.error(`\nVersion mismatch — package.json is ${version}.`);
  process.exit(1);
}
console.log(`\n✔ version ${version} matches package.json and both manifests.`);
