import test from 'node:test';
import assert from 'node:assert/strict';
import { rule as targetSdkRule, MIN_REQUIRED_TARGET_SDK } from '../src/rules/android/target-sdk.js';
import {
  packageNameRule,
  versionCodeRule,
  versionNameRule,
} from '../src/rules/android/manifest-basics.js';
import { runRules } from '../src/rules/index.js';
import {
  manifestDataPassing,
  manifestDataFailingTargetSdk,
  manifestDataMissingFields,
} from './fixtures/manifest-samples.js';

test('target-sdk rule fails below the required floor (catches the real Aug 2026 deadline)', () => {
  const result = targetSdkRule.evaluate(manifestDataFailingTargetSdk);
  assert.equal(result.status, 'fail');
  assert.match(result.detail, /35/);
  assert.match(result.detail, new RegExp(String(MIN_REQUIRED_TARGET_SDK)));
});

test('target-sdk rule passes at or above the required floor', () => {
  const result = targetSdkRule.evaluate(manifestDataPassing);
  assert.equal(result.status, 'pass');
});

test('target-sdk rule warns (not fails) when the value could not be read at all', () => {
  const result = targetSdkRule.evaluate(manifestDataMissingFields);
  assert.equal(result.status, 'warn');
});

test('manifest-basics rules pass on a well-formed manifest', () => {
  assert.equal(packageNameRule.evaluate(manifestDataPassing).status, 'pass');
  assert.equal(versionCodeRule.evaluate(manifestDataPassing).status, 'pass');
  assert.equal(versionNameRule.evaluate(manifestDataPassing).status, 'pass');
});

test('manifest-basics rules fail on missing fields', () => {
  assert.equal(packageNameRule.evaluate(manifestDataMissingFields).status, 'fail');
  assert.equal(versionCodeRule.evaluate(manifestDataMissingFields).status, 'fail');
  assert.equal(versionNameRule.evaluate(manifestDataMissingFields).status, 'fail');
});

test('runRules("android", ...) wires every rule and flags a blocking critical failure', () => {
  const findings = runRules('android', manifestDataFailingTargetSdk);
  assert.ok(findings.length >= 5, 'expected all registered android rules to run');

  const targetSdkFinding = findings.find((f) => f.id === 'android.manifest.target-sdk');
  assert.equal(targetSdkFinding.status, 'fail');
  assert.equal(targetSdkFinding.severity, 'critical');
});

test('runRules("android", ...) is all-pass on a clean manifest', () => {
  const findings = runRules('android', manifestDataPassing);
  const blocking = findings.filter((f) => f.status === 'fail' && f.severity === 'critical');
  assert.equal(blocking.length, 0);
});
