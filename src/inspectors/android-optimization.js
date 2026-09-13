// Derives signals related to Google Play's "app optimization" check (R8 code
// shrinking/obfuscation) and Baseline Profile presence, by opening the .aab
// directly as a zip — bundletool's own `dump` commands only ever expose the
// manifest as text, never raw module bytes, so this is the one place in
// CheckApp that reads a bundle's actual compiled output instead of asking
// bundletool to describe it.
//
// Why this check exists at all: Google Play Console computes an obfuscation/
// shrinking percentage from the bundle you actually upload, and — per
// multiple developers hitting this in 2026 (see the app-optimization rule's
// own comments for sourcing/caveats) — apps with more than ~10MB of compiled
// DEX code need at least 25% of that score or see "App optimization is below
// our threshold" warnings, reportedly becoming enforcement (visibility/
// publishing impact) from February 2027. CheckApp can't reproduce Google's
// exact percentage (no access to their algorithm), but it CAN tell, from the
// bundle alone, whether R8 minification looks like it ran at all — which is
// the actual root cause in every real report we found.

import { readFileSync } from 'node:fs';
import { listZipEntries, readZipEntry } from './zip-reader.js';
import { readDexTypeDescriptors } from './dex-reader.js';

const BASELINE_PROFILE_ENTRY = 'base/assets/dexopt/baseline.prof';
const DEX_ENTRY_PATTERN = /^base\/dex\/classes\d*\.dex$/; // classes.dex, classes2.dex, ... (multidex)

/**
 * @typedef {Object} OptimizationSignals
 * @property {number} dexTotalBytes total uncompressed size of the base module's classes*.dex files
 * @property {boolean} hasBaselineProfile
 * @property {number} ownPackageClassTotal how many type descriptors live under the app's own package
 * @property {number} ownPackageReadableNameCount ...of those, how many still look human-written (not R8-renamed)
 */

/**
 * @param {string} aabPath
 * @param {string|null} packageName from the already-parsed manifest — used to scope the
 *   obfuscation heuristic to the app's own classes rather than the much larger set of
 *   third-party/library classes every app bundles (those get obfuscated or not on their
 *   own schedule and say nothing about whether *this app's* R8 config is on).
 * @returns {OptimizationSignals}
 */
export function inspectOptimizationSignals(aabPath, packageName) {
  const buffer = readFileSync(aabPath);
  const entries = listZipEntries(buffer);

  const hasBaselineProfile = entries.some((entry) => entry.name === BASELINE_PROFILE_ENTRY);
  const dexEntries = entries.filter((entry) => DEX_ENTRY_PATTERN.test(entry.name));
  const dexTotalBytes = dexEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);

  let ownPackageClassTotal = 0;
  let ownPackageReadableNameCount = 0;
  const ownPackagePrefix = packageName ? `L${packageName.replace(/\./g, '/')}/` : null;

  if (ownPackagePrefix) {
    for (const entry of dexEntries) {
      const descriptors = readDexTypeDescriptors(readZipEntry(buffer, entry));
      for (const descriptor of descriptors) {
        if (!descriptor.startsWith(ownPackagePrefix)) continue;
        ownPackageClassTotal++;
        if (looksLikeReadableClassName(descriptor)) ownPackageReadableNameCount++;
      }
    }
  }

  return { dexTotalBytes, hasBaselineProfile, ownPackageClassTotal, ownPackageReadableNameCount };
}

/**
 * Heuristic for "does this look like a name a person wrote" vs. "does this
 * look like R8's default synthetic name" (a, b, aa, a1, ...). Not trying to
 * be exact: R8-renamed classes get short (often 1-2 char), lowercase-start
 * names; ordinary Java/Kotlin class names are capitalized and essentially
 * never that short.
 *
 * Compiler-generated inner/lambda/anonymous classes (MainActivity$1,
 * HomeScreenKt$Preview$2) are real even in fully unobfuscated code and their
 * $-suffixed part is often just a number — so this only judges the leading
 * segment before the first '$', which is the part an obfuscator actually
 * renames and a person actually wrote.
 *
 * @param {string} typeDescriptor e.g. "Ltech/axiscore/align/MainActivity;"
 */
function looksLikeReadableClassName(typeDescriptor) {
  const simpleName = typeDescriptor.slice(1, -1).split('/').pop(); // strip leading L / trailing ; / package path
  const leadingSegment = simpleName.split('$')[0];
  return /^[A-Z][A-Za-z0-9_]{2,}$/.test(leadingSegment);
}
