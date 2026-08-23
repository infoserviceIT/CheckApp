import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManifestXml } from '../src/inspectors/android-bundletool.js';
import {
  rawManifestXmlBelowTargetSdk35,
  rawManifestXmlCompliantTargetSdk36,
} from './fixtures/manifest-samples.js';

test('parseManifestXml extracts package name, versions, target/min SDK, and permissions', () => {
  const data = parseManifestXml(rawManifestXmlBelowTargetSdk35);

  assert.equal(data.packageName, 'com.axiscore.align');
  assert.equal(data.versionCode, 3);
  assert.equal(data.versionName, '1.2.0');
  assert.equal(data.targetSdkVersion, 35);
  assert.equal(data.minSdkVersion, 24);
  assert.deepEqual(data.permissions, [
    'android.permission.INTERNET',
    'android.permission.CAMERA',
  ]);
});

test('parseManifestXml picks up a bumped targetSdkVersion', () => {
  const data = parseManifestXml(rawManifestXmlCompliantTargetSdk36);
  assert.equal(data.targetSdkVersion, 36);
});

test('parseManifestXml returns nulls instead of throwing on a bare-bones manifest', () => {
  const data = parseManifestXml(
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>'
  );
  assert.equal(data.packageName, null);
  assert.equal(data.versionCode, null);
  assert.equal(data.targetSdkVersion, null);
  assert.deepEqual(data.permissions, []);
});
