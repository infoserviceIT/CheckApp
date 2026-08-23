import { rule as targetSdkRule } from './target-sdk.js';
import { packageNameRule, versionCodeRule, versionNameRule } from './manifest-basics.js';
import { rule as permissionsInventoryRule } from './permissions-inventory.js';

// The full catalog (~30 rules) is mapped out in the CheckApp architecture
// document; this is the slice that's actually implemented and runnable
// today. Add new rule modules here as they're built — each one just needs
// {id, title, platform, severity, guideline, evaluate(manifestData)}.
export const androidRules = [
  targetSdkRule,
  packageNameRule,
  versionCodeRule,
  versionNameRule,
  permissionsInventoryRule,
];
