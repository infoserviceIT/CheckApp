// Google Play's "app optimization" check: R8 code shrinking + obfuscation,
// plus (a related but separate recommendation) Baseline Profiles.
//
// Sourcing/confidence note, in the same spirit as target-sdk.js's deadline
// comment but weaker: Play Console computes an obfuscation/shrinking
// percentage from the bundle you actually upload, and multiple developers
// reported in 2026 that apps with more than DEX_OPTIMIZATION_THRESHOLD_BYTES
// of compiled code need at least MIN_OPTIMIZATION_PERCENT of that score or
// see "App optimization is below our threshold" warnings, with enforcement
// (visibility/publishing impact) reportedly starting UNCONFIRMED_ENFORCEMENT_DATE.
// Unlike the target-sdk deadline, this is NOT something we found stated on an
// official Google Play Console Help page — only in developer reports/issue
// trackers reacting to the warning. Treat the numbers below as "best current
// understanding from real-world reports", and tighten this comment (with a
// source URL) if Google publishes something more authoritative.
//
// What CheckApp can and can't verify from the .aab alone: it cannot
// reproduce Google's exact percentage (no access to their algorithm), but it
// CAN tell whether R8 minification looks like it ran at all — which, in
// every real report we found (including the one that prompted this rule),
// was the actual root cause: minifyEnabled was simply off.

export const DEX_OPTIMIZATION_THRESHOLD_BYTES = 10 * 1024 * 1024;
export const MIN_OWN_CLASSES_FOR_CONFIDENCE = 5;
export const UNOBFUSCATED_NAME_FRACTION_THRESHOLD = 0.7;
export const UNCONFIRMED_ENFORCEMENT_DATE = '2027-02';

export const rule = {
  id: 'android.optimization.app-optimization',
  title: 'Code shrinking, obfuscation & Baseline Profile ("app optimization")',
  platform: 'android',
  severity: 'medium',
  guideline: 'Android Developers — Enable app optimization with R8',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    return [baselineProfileFinding(data), r8MinificationFinding(data)].filter(Boolean);
  },
};

function baselineProfileFinding(data) {
  if (data.hasBaselineProfile == null) return null; // signal unavailable — say nothing rather than guess

  const id = `${rule.id}.baseline-profile`;
  const title = 'Baseline Profile';

  if (data.hasBaselineProfile) {
    return { id, title, status: 'pass', detail: 'Baseline Profile found in the bundle (assets/dexopt/baseline.prof).' };
  }
  return {
    id,
    title,
    status: 'info',
    detail:
      'No Baseline Profile found (assets/dexopt/baseline.prof is missing from the base module). Not ' +
      'required by Play Store policy, but recommended by Google for faster cold start and less jank ' +
      'on the first few launches after install/update.',
    remediation:
      'Add the androidx.profileinstaller runtime dependency and generate a profile via a Macrobenchmark ' +
      'module (Android Studio offers a "Generate Baseline Profile" run configuration once one exists) — ' +
      'see the Baseline Profiles guide on developer.android.com. On Expo/EAS-managed projects this needs ' +
      'a custom dev client / prebuilt native project rather than config-plugins alone, so weigh the setup ' +
      'cost against the benefit before investing time here if you are fully managed.',
    guideline: 'Android Developers — Baseline Profiles overview',
  };
}

function r8MinificationFinding(data) {
  if (data.dexTotalBytes == null) return null; // signal unavailable — say nothing rather than guess

  const id = `${rule.id}.r8-minification`;
  const title = 'Code shrinking & obfuscation (R8)';
  const dexMb = (data.dexTotalBytes / (1024 * 1024)).toFixed(1);

  if (data.dexTotalBytes <= DEX_OPTIMIZATION_THRESHOLD_BYTES) {
    return {
      id,
      title,
      status: 'info',
      detail:
        `Compiled code is ${dexMb}MB, under the ~10MB mark where Google currently expects a minimum ` +
        `optimization score — this check likely doesn't apply to your app yet, but enabling R8 remains ` +
        `good practice as it grows.`,
    };
  }

  if (data.ownPackageClassTotal == null || data.ownPackageClassTotal < MIN_OWN_CLASSES_FOR_CONFIDENCE) {
    return {
      id,
      title,
      status: 'info',
      severity: 'medium',
      detail:
        `Compiled code is ${dexMb}MB (over the ~10MB mark), but too few of the app's own classes were ` +
        `found in it to judge obfuscation with any confidence — this can also happen when R8 successfully ` +
        `renames and repackages your classes. Check the actual score in Play Console's own App ` +
        `optimization / Android vitals report.`,
    };
  }

  const readableFraction = data.ownPackageReadableNameCount / data.ownPackageClassTotal;
  if (readableFraction >= UNOBFUSCATED_NAME_FRACTION_THRESHOLD) {
    return {
      id,
      title,
      status: 'warn',
      severity: 'high',
      detail:
        `${data.ownPackageReadableNameCount} of ${data.ownPackageClassTotal} of the app's own classes ` +
        `still have their original, human-readable names in the compiled code — a strong sign R8 ` +
        `minification is off. Google Play expects a minimum optimization score for apps with this much ` +
        `compiled code (~${dexMb}MB) and has been reported to affect visibility/publishing from around ` +
        `${UNCONFIRMED_ENFORCEMENT_DATE} — worth fixing well before then rather than after a warning shows up.`,
      remediation:
        'Enable R8 in the release build. Gradle: in build.gradle, buildTypes.release { minifyEnabled true; ' +
        'shrinkResources true; proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), ' +
        '"proguard-rules.pro" }. Expo/EAS: add the expo-build-properties plugin in app.json — ' +
        '["expo-build-properties", { "android": { "enableMinifyInReleaseBuilds": true, ' +
        '"enableShrinkResourcesInReleaseBuilds": true } }] — then rebuild with a new EAS build (this is a ' +
        'native-config change, so it needs a full rebuild, not just a JS/OTA update). Re-run this scan ' +
        'afterwards — the readable-class-name count above should drop sharply if it worked.',
    };
  }

  return {
    id,
    title,
    status: 'pass',
    detail:
      `Only ${data.ownPackageReadableNameCount} of ${data.ownPackageClassTotal} of the app's own classes ` +
      `still have readable names — looks like R8 minification is active.`,
  };
}
