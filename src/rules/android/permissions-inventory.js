// Not a pass/fail rule yet — an inventory. Cross-checking declared
// permissions against the Play Console Data Safety form and against what
// the code actually uses them for is the next real rule to build here
// (see the "Permessi & privacy" category in the architecture doc). Shipping
// the inventory first means the report already surfaces the data a human
// needs to do that check by hand, instead of waiting for the full rule.

export const rule = {
  id: 'android.manifest.permissions-inventory',
  title: 'Declared permissions (inventory, not yet scored)',
  platform: 'android',
  severity: 'medium',
  guideline: 'Google Play Console Help — Data safety',

  /** @param {import('../../inspectors/android-bundletool.js').AndroidManifestData} data */
  evaluate(data) {
    if (data.permissions.length === 0) {
      return { status: 'info', detail: 'No uses-permission entries found.' };
    }
    return {
      status: 'info',
      detail:
        `${data.permissions.length} permission(s) declared: ${data.permissions.join(', ')}. ` +
        `Check each against the app's Data Safety declaration in Play Console.`,
    };
  },
};
