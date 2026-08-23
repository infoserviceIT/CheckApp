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
      return { status: 'fail', detail: 'No package name found on the <manifest> element.' };
    }
    const looksValid = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(data.packageName);
    if (!looksValid) {
      return {
        status: 'fail',
        detail: `Package name "${data.packageName}" doesn't look like a valid reverse-domain application ID.`,
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
    if (data.versionCode == null || Number.isNaN(data.versionCode)) {
      return { status: 'fail', detail: 'android:versionCode is missing or not a number.' };
    }
    if (data.versionCode <= 0) {
      return { status: 'fail', detail: `android:versionCode is ${data.versionCode}, must be a positive integer.` };
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
      return { status: 'fail', detail: 'android:versionName is missing or empty.' };
    }
    return { status: 'pass', detail: `versionName: ${data.versionName}` };
  },
};
