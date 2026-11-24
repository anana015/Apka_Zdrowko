import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zbudujManifest, zbierzPliki } from '../scripts/generuj-precache.mjs';

const korzen = fileURLToPath(new URL('..', import.meta.url));

test('precache-manifest.js jest aktualny (npm run precache)', () => {
  const obecny = readFileSync(join(korzen, 'precache-manifest.js'), 'utf8');
  assert.equal(obecny, zbudujManifest(korzen));
});

test('wszystkie pliki z index.html są w precache', () => {
  const pliki = new Set(zbierzPliki(korzen));
  const html = readFileSync(join(korzen, 'index.html'), 'utf8');
  const odwolania = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const o of odwolania) {
    assert.ok(existsSync(join(korzen, o)), `brak pliku ${o}`);
    assert.ok(pliki.has(o), `plik ${o} nie jest w precache`);
  }
});
