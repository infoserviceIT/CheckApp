import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectOptimizationSignals } from '../src/inspectors/android-optimization.js';
import { buildZip } from './fixtures/zip-builder.js';
import { buildDex } from './fixtures/dex-builder.js';

function writeTempAab(zipBuffer) {
  const dir = mkdtempSync(path.join(tmpdir(), 'checkapp-optimization-test-'));
  const file = path.join(dir, 'test.aab');
  writeFileSync(file, zipBuffer);
  return file;
}

test('inspectOptimizationSignals: unobfuscated build — readable own-package classes, no baseline profile', () => {
  const dex = buildDex([
    'Ltech/axiscore/align/MainActivity;',
    'Ltech/axiscore/align/MainApplication;',
    'Ltech/axiscore/align/ui/HomeScreenKt;',
    'Ltech/axiscore/align/ui/HomeScreenKt$Preview$1;', // anonymous/lambda class — should still count as readable
    'Landroidx/core/app/ComponentActivity;', // library class — must NOT count toward own-package totals
  ]);
  const aab = buildZip([{ name: 'base/dex/classes.dex', data: dex, method: 'deflate' }]);

  const signals = inspectOptimizationSignals(writeTempAab(aab), 'tech.axiscore.align');

  assert.equal(signals.hasBaselineProfile, false);
  assert.equal(signals.dexTotalBytes, dex.length);
  assert.equal(signals.ownPackageClassTotal, 4);
  assert.equal(signals.ownPackageReadableNameCount, 4);
});

test('inspectOptimizationSignals: obfuscated build — short synthetic names, baseline profile present', () => {
  const dex = buildDex([
    'La;',
    'La$a;',
    'Lb;',
    'Lc;',
    'Landroidx/core/app/ComponentActivity;',
  ]);
  const aab = buildZip([
    { name: 'base/dex/classes.dex', data: dex, method: 'deflate' },
    { name: 'base/assets/dexopt/baseline.prof', data: Buffer.from([0xaa, 0xbb]), method: 'stored' },
  ]);

  // Repackaged-to-root-package scenario: the app's classes no longer live
  // under its own package prefix at all, which is itself a (deliberately
  // ambiguous, see the rule) signal of successful obfuscation.
  const signals = inspectOptimizationSignals(writeTempAab(aab), 'tech.axiscore.align');

  assert.equal(signals.hasBaselineProfile, true);
  assert.equal(signals.ownPackageClassTotal, 0);
  assert.equal(signals.ownPackageReadableNameCount, 0);
});

test('inspectOptimizationSignals: obfuscated but NOT repackaged — short names, same package prefix', () => {
  const dex = buildDex([
    'Ltech/axiscore/align/a;',
    'Ltech/axiscore/align/b;',
    'Ltech/axiscore/align/c;',
    'Ltech/axiscore/align/d;',
    'Ltech/axiscore/align/e;',
  ]);
  const aab = buildZip([{ name: 'base/dex/classes.dex', data: dex, method: 'stored' }]);

  const signals = inspectOptimizationSignals(writeTempAab(aab), 'tech.axiscore.align');

  assert.equal(signals.ownPackageClassTotal, 5);
  assert.equal(signals.ownPackageReadableNameCount, 0);
});

test('inspectOptimizationSignals: multidex sums both classes.dex and classes2.dex', () => {
  const dex1 = buildDex(['Ltech/axiscore/align/MainActivity;']);
  const dex2 = buildDex(['Ltech/axiscore/align/ui/SettingsScreen;']);
  const aab = buildZip([
    { name: 'base/dex/classes.dex', data: dex1, method: 'stored' },
    { name: 'base/dex/classes2.dex', data: dex2, method: 'stored' },
  ]);

  const signals = inspectOptimizationSignals(writeTempAab(aab), 'tech.axiscore.align');

  assert.equal(signals.dexTotalBytes, dex1.length + dex2.length);
  assert.equal(signals.ownPackageClassTotal, 2);
  assert.equal(signals.ownPackageReadableNameCount, 2);
});

test('inspectOptimizationSignals: no dex at all (manifest-only module) reports zero, not an error', () => {
  const aab = buildZip([{ name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('<manifest/>'), method: 'stored' }]);

  const signals = inspectOptimizationSignals(writeTempAab(aab), 'tech.axiscore.align');

  assert.equal(signals.dexTotalBytes, 0);
  assert.equal(signals.hasBaselineProfile, false);
  assert.equal(signals.ownPackageClassTotal, 0);
});

test('inspectOptimizationSignals: null packageName skips the own-package scan without throwing', () => {
  const dex = buildDex(['Ltech/axiscore/align/MainActivity;']);
  const aab = buildZip([{ name: 'base/dex/classes.dex', data: dex, method: 'stored' }]);

  const signals = inspectOptimizationSignals(writeTempAab(aab), null);

  assert.equal(signals.dexTotalBytes, dex.length);
  assert.equal(signals.ownPackageClassTotal, 0);
  assert.equal(signals.ownPackageReadableNameCount, 0);
});
