// Google Play requires every new app and every update to target a minimum
// API level, and raises that floor roughly once a year. As of today
// (see MIN_REQUIRED_TARGET_SDK below) it is API level 36 (Android 16),
// mandatory for new apps/updates from 2026-08-31, with a technical
// extension available in Play Console through 2026-11-01.
//
// This number WILL go stale — Google moves it again in 2027. Bump
// MIN_REQUIRED_TARGET_SDK (and the two dates below) when they do, rather
// than treating this file as a one-time fix.
// Source: https://support.google.com/googleplay/android-developer/answer/11926878

export const MIN_REQUIRED_TARGET_SDK = 36;
export const HARD_DEADLINE = '2026-08-31';
export const EXTENDED_DEADLINE = '2026-11-01';

export const rule = {
  id: 'android.manifest.target-sdk',
  title: `targetSdkVersion >= ${MIN_REQUIRED_TARGET_SDK} (Android ${MIN_REQUIRED_TARGET_SDK - 20})`,
  platform: 'android',
  severity: 'critical',
  guideline: 'Google Play Console Help — target API level requirements',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    if (data.targetSdkVersion == null) {
      return {
        status: 'warn',
        detail:
          'Could not read android:targetSdkVersion from the manifest (missing <uses-sdk> tag?).',
        remediation:
          'This is normally set implicitly by the build tooling rather than hand-edited, so a ' +
          'missing value usually means the manifest is unusual or bundletool could not read it. ' +
          'Run `bundletool dump manifest --bundle <file>` yourself and check the <uses-sdk> line.',
      };
    }
    if (data.targetSdkVersion < MIN_REQUIRED_TARGET_SDK) {
      return {
        status: 'fail',
        detail:
          `targetSdkVersion is ${data.targetSdkVersion}, below the required ` +
          `${MIN_REQUIRED_TARGET_SDK}. Google Play rejects new submissions/updates ` +
          `below this floor from ${HARD_DEADLINE} (technical extension to ${EXTENDED_DEADLINE} ` +
          `available in Play Console).`,
        remediation:
          `Raise targetSdkVersion to ${MIN_REQUIRED_TARGET_SDK} and rebuild — where that's set ` +
          `depends on the build pipeline: Gradle projects set it in build.gradle ` +
          `(defaultConfig.targetSdkVersion); Expo/EAS builds set it via app.json/app.config.js's ` +
          `expo.android.targetSdkVersion (often actually controlled by the Expo SDK version, so ` +
          `an SDK upgrade may be what's really needed); Bubblewrap/TWA builds set it in ` +
          `twa-manifest.json before running "bubblewrap build".`,
      };
    }
    return {
      status: 'pass',
      detail: `targetSdkVersion is ${data.targetSdkVersion} (>= ${MIN_REQUIRED_TARGET_SDK}).`,
    };
  },
};
