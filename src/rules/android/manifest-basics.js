// Baseline manifest sanity checks. Cheap to run, and catches the kind of
// build-config mistake that wastes a full store review cycle for nothing
// (Google Play especially will bounce a submission with a duplicate or
// non-incremented versionCode before a human ever looks at it).

export const packageNameRule = {
  id: 'android.manifest.package-name',
  title: 'Package name present and looks like a valid application ID',
  platform: 'android',
  severity: 'critical',
  guideline: 'Google Play Console Help — application ID requirements',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    if (!data.packageName) {
      return {
        status: 'fail',
        detail: 'No package name found on the <manifest> element.',
        remediation:
          'Set an application ID in the build config, then rebuild — Gradle: applicationId ' +
          '"com.yourcompany.yourapp" in build.gradle; Expo: the expo.android.package field in ' +
          'app.json.',
      };
    }
    const looksValid = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(data.packageName);
    if (!looksValid) {
      return {
        status: 'fail',
        detail: `Package name "${data.packageName}" doesn't look like a valid reverse-domain application ID.`,
        remediation:
          'Use reverse-domain notation with at least two segments, each starting with a letter ' +
          "(e.g. com.yourcompany.yourapp) — no leading digits, no hyphens. Fix it in build.gradle's " +
          "applicationId (or app.json's expo.android.package for Expo) and rebuild. Note Google " +
          'Play does not allow changing the package name after the first release, so get it right ' +
          'before the first submission.',
      };
    }
    return { status: 'pass', detail: `Package name: ${data.packageName}` };
  },
};

export const versionCodeRule = {
  id: 'android.manifest.version-code',
  title: 'versionCode is a positive integer',
  platform: 'android',
  severity: 'high',
  guideline: 'Google Play Console Help — versioning your app',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    const remediation =
      'Set versionCode to a positive integer that increases with every release you submit — ' +
      "Play Console rejects a build whose versionCode isn't strictly higher than your last " +
      'published one. Gradle: defaultConfig.versionCode in build.gradle; Expo: ' +
      "expo.android.versionCode in app.json (or let EAS auto-increment it via eas.json's " +
      '"autoIncrement").';
    if (data.versionCode == null || Number.isNaN(data.versionCode)) {
      return { status: 'fail', detail: 'android:versionCode is missing or not a number.', remediation };
    }
    if (data.versionCode <= 0) {
      return {
        status: 'fail',
        detail: `android:versionCode is ${data.versionCode}, must be a positive integer.`,
        remediation,
      };
    }
    return { status: 'pass', detail: `versionCode: ${data.versionCode}` };
  },
};

export const versionNameRule = {
  id: 'android.manifest.version-name',
  title: 'versionName is present and non-empty',
  platform: 'android',
  severity: 'medium',
  guideline: 'Google Play Console Help — versioning your app',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    if (!data.versionName || !data.versionName.trim()) {
      return {
        status: 'fail',
        detail: 'android:versionName is missing or empty.',
        remediation:
          'Set a human-readable versionName (e.g. "1.2.0") — Gradle: defaultConfig.versionName ' +
          'in build.gradle; Expo: the top-level "version" field in app.json. Unlike versionCode ' +
          'this is just a display string, but Play Console still requires it to be present.',
      };
    }
    return { status: 'pass', detail: `versionName: ${data.versionName}` };
  },
};
