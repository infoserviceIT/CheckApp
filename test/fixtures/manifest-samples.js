// Hand-built fixtures. The XML shape below follows the documented format of
// `bundletool dump manifest` output; it has not been diffed against a real
// bundletool run in this environment (GitHub release downloads were not
// reachable from the sandbox this was written in — see docs/SETUP-BUNDLETOOL.md).
// Treat rawManifestXmlBelowTargetSdk35 as "shaped like the real thing" and
// re-verify parseManifestXml() against one real `bundletool dump manifest`
// output before relying on it in production.

export const rawManifestXmlBelowTargetSdk35 = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.axiscore.align"
    android:versionCode="3"
    android:versionName="1.2.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <application android:label="Axis Core Align">
    </application>
</manifest>`;

export const rawManifestXmlCompliantTargetSdk36 = rawManifestXmlBelowTargetSdk35.replace(
  'android:targetSdkVersion="35"',
  'android:targetSdkVersion="36"'
);

/** Parsed-shape fixture for unit-testing individual rules without going through the XML parser. */
export const manifestDataPassing = {
  packageName: 'com.axiscore.align',
  versionCode: 3,
  versionName: '1.2.0',
  targetSdkVersion: 36,
  minSdkVersion: 24,
  permissions: ['android.permission.INTERNET', 'android.permission.CAMERA'],
  rawManifestXml: rawManifestXmlCompliantTargetSdk36,
};

export const manifestDataFailingTargetSdk = {
  ...manifestDataPassing,
  targetSdkVersion: 35,
  rawManifestXml: rawManifestXmlBelowTargetSdk35,
};

export const manifestDataMissingFields = {
  packageName: null,
  versionCode: null,
  versionName: '',
  targetSdkVersion: null,
  minSdkVersion: null,
  permissions: [],
  rawManifestXml: '<manifest xmlns:android="http://schemas.android.com/apk/res/android"></manifest>',
};
