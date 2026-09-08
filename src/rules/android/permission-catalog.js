// A small, deliberately curated catalog of Android permissions that carry
// real Google Play review consequences beyond "just works" — either because
// Play Console requires a separate declaration form before you can submit
// with them ("restricted permissions"), or because they map onto a category
// in the Data Safety form every app must fill in. This is not the full
// Android permission list (there are hundreds); it's the subset that has
// actually caused real submissions to be rejected or flagged.
//
// The two catalogs below are deliberately disjoint: a permission that's
// already in PERMISSION_CATALOG (and whose remediation already points at
// the Data Safety form as part of a bigger ask) isn't repeated in
// DATA_SAFETY_PERMISSIONS too — that would just be two findings saying the
// same thing.
//
// Sources (fetched directly from Google when this was built, not memorized —
// these pages change over time and should be re-checked periodically):
//   support.google.com/googleplay/android-developer/answer/9214102  (restricted permissions overview)
//   support.google.com/googleplay/android-developer — SYSTEM_ALERT_WINDOW, background location,
//     All Files Access, SMS & Call Log, package visibility, and Accessibility API each have their
//     own help center article; search Play Console Help for the permission name if any of the
//     remediation text below looks stale.
//   support.google.com/googleplay/android-developer/answer/10787469  (Data safety)

const SMS_CALL_LOG_PERMISSION = {
  severity: 'high',
  why:
    "SMS and Call Log permissions are restricted to apps registered as the user's default SMS, " +
    'Phone, or Assistant handler, require a Play Console declaration, and the data they expose ' +
    'can never be used for advertising.',
  remediation:
    'Confirm the app is set (or will be set) as the default SMS, Phone, or Assistant handler — ' +
    'Play rejects these permissions otherwise — and complete the SMS/Call Log declaration form ' +
    'in Play Console. If the only real need is reading a one-time verification code, switch to ' +
    'the SMS Retriever API instead, which needs no permission at all.',
  guideline: 'Google Play Console Help — SMS and Call Log permissions',
};

/**
 * Permissions Google Play treats as "restricted": declaring one without
 * doing the extra step Play Console requires is a common, avoidable
 * rejection reason. Keyed by the fully-qualified name bundletool prints
 * (e.g. "android.permission.CAMERA").
 *
 * @type {Record<string, { severity: 'critical'|'high'|'medium', why: string, remediation: string, guideline: string }>}
 */
export const PERMISSION_CATALOG = {
  'android.permission.SYSTEM_ALERT_WINDOW': {
    severity: 'high',
    why:
      'Lets the app draw over other apps ("display over other apps"). One of the most commonly ' +
      'misused restricted permissions — Play routinely rejects apps that request it without a ' +
      'core feature that genuinely needs it.',
    remediation:
      'Confirm the app actually needs to draw over other apps. This permission is frequently ' +
      'left over from a template/boilerplate build (Expo/React Native/Bubblewrap) with nothing ' +
      'in the app using it — if so, just remove it. If it is genuinely needed, do not request it ' +
      'as a normal runtime permission: send the user to the system settings screen for approval ' +
      '(Settings.ACTION_MANAGE_OVERLAY_PERMISSION), and be ready to explain the use case if Play ' +
      'Console asks for it.',
    guideline: 'Google Play Console Help — Restricted permissions (SYSTEM_ALERT_WINDOW)',
  },
  'android.permission.ACCESS_BACKGROUND_LOCATION': {
    severity: 'high',
    why:
      "Requires its own Play Console declaration form with a justification tied to the app's " +
      'core functionality, plus explicit user consent — it can never be justified solely by ads ' +
      'or analytics.',
    remediation:
      "If the app doesn't genuinely need location while backgrounded, remove " +
      'ACCESS_BACKGROUND_LOCATION and request only foreground location (ACCESS_FINE_LOCATION / ' +
      'ACCESS_COARSE_LOCATION). If it does, complete the background location declaration form in ' +
      'Play Console (App content → Permissions declaration) describing the core feature that ' +
      'needs it, and request it via a separate, clearly-explained prompt rather than bundling it ' +
      'with the foreground location request.',
    guideline: 'Google Play Console Help — Background location permission',
  },
  'android.permission.MANAGE_EXTERNAL_STORAGE': {
    severity: 'high',
    why:
      'Grants broad, "All Files Access" read/write across the device — requires a Play Console ' +
      'declaration and manual review, and is explicitly not meant for ordinary media/file picking.',
    remediation:
      'Check whether the Storage Access Framework (ACTION_OPEN_DOCUMENT / ACTION_CREATE_DOCUMENT) ' +
      'or the MediaStore API actually covers the use case — most apps that request this permission ' +
      'do not need it and can drop it entirely. If the app genuinely needs broad file-system ' +
      'access, complete the All Files Access declaration form in Play Console before submitting.',
    guideline: 'Google Play Console Help — All Files Access permission',
  },
  'android.permission.READ_SMS': SMS_CALL_LOG_PERMISSION,
  'android.permission.SEND_SMS': SMS_CALL_LOG_PERMISSION,
  'android.permission.RECEIVE_SMS': SMS_CALL_LOG_PERMISSION,
  'android.permission.RECEIVE_MMS': SMS_CALL_LOG_PERMISSION,
  'android.permission.READ_CALL_LOG': SMS_CALL_LOG_PERMISSION,
  'android.permission.WRITE_CALL_LOG': SMS_CALL_LOG_PERMISSION,
  'android.permission.PROCESS_OUTGOING_CALLS': SMS_CALL_LOG_PERMISSION,
  'android.permission.QUERY_ALL_PACKAGES': {
    severity: 'medium',
    why:
      'Gives visibility into every other app installed on the device — requires a Play Console ' +
      'declaration, and the resulting app-inventory data can never be sold or shared for ' +
      'advertising/analytics.',
    remediation:
      'In most cases this permission is unnecessary: replace it with specific <queries> entries ' +
      'in the manifest naming the exact packages, intents, or content providers the app actually ' +
      'needs (targeted queries need no declaration at all). Only keep QUERY_ALL_PACKAGES, and ' +
      'complete its Play Console declaration form, if the app genuinely needs the full list of ' +
      'installed apps (e.g. a launcher or device-management tool).',
    guideline: 'Google Play Console Help — Package visibility (QUERY_ALL_PACKAGES)',
  },
  'android.permission.BIND_ACCESSIBILITY_SERVICE': {
    severity: 'high',
    why:
      'Lets an accessibility service observe and act on screen content system-wide. Exempt from ' +
      'extra disclosure only when the app declares itself a genuine accessibility tool; otherwise ' +
      'needs a Play Console declaration, a clear in-app disclosure, and explicit user consent — ' +
      'and must never be used to bypass privacy controls or record call audio without consent.',
    remediation:
      'If this is a genuine accessibility tool, set android:isAccessibilityTool="true" on the ' +
      "service's metadata so it qualifies for the disclosure exemption. Otherwise, complete the " +
      'accessibility API declaration form in Play Console, add a clear in-app explanation of what ' +
      'the service observes and why, and get explicit user consent before it is enabled.',
    guideline: 'Google Play Console Help — Accessibility API permissions',
  },
};

/**
 * Runtime ("dangerous") permissions that Google Play's Data Safety form asks
 * every app to account for. Declaring one of these without a matching,
 * accurate Data Safety entry (Play Console → App content → Data safety) is a
 * mismatch reviewers do check for. Value is the data category label to help
 * a human find the right checkbox on that form.
 *
 * @type {Record<string, string>}
 */
export const DATA_SAFETY_PERMISSIONS = {
  'android.permission.CAMERA': 'Photos or videos',
  'android.permission.RECORD_AUDIO': 'Audio',
  'android.permission.ACCESS_FINE_LOCATION': 'Precise location',
  'android.permission.ACCESS_COARSE_LOCATION': 'Approximate location',
  'android.permission.READ_EXTERNAL_STORAGE': 'Files and docs',
  'android.permission.WRITE_EXTERNAL_STORAGE': 'Files and docs',
  'android.permission.ACTIVITY_RECOGNITION': 'Fitness or activity data',
  'android.permission.READ_MEDIA_IMAGES': 'Photos or videos',
  'android.permission.READ_MEDIA_VIDEO': 'Photos or videos',
  'android.permission.READ_MEDIA_AUDIO': 'Audio',
};

// Android auto-generates a per-app signature permission of this shape (e.g.
// "tech.axiscore.align.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION") when code
// calls registerReceiver(..., RECEIVER_NOT_EXPORTED) on API 33+. It's not
// something the developer chose to declare, it isn't user-facing, and it
// carries none of the review implications above — flagging it would just be
// noise, so callers should skip it before matching against the catalogs.
const AUTO_GENERATED_PERMISSION_PATTERN = /\.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION$/;

/** @param {string} permissionName */
export function isAutoGeneratedPermission(permissionName) {
  return AUTO_GENERATED_PERMISSION_PATTERN.test(permissionName);
}
