import { androidRules } from './android/index.js';

const RULES_BY_PLATFORM = {
  android: androidRules,
  // ios: iosRules,  — next platform to add (Phase 2 of the architecture doc)
};

/**
 * @typedef {Object} Finding
 * @property {string} id
 * @property {string} title
 * @property {'android'|'ios'} platform
 * @property {'critical'|'high'|'medium'} severity
 * @property {string} guideline
 * @property {'pass'|'fail'|'warn'|'info'} status
 * @property {string} detail
 */

/**
 * Runs every registered rule for a platform against inspected manifest data
 * and returns one Finding per rule. A rule that throws is turned into a
 * 'warn' finding rather than crashing the whole scan — one bad rule
 * shouldn't hide every other result.
 *
 * @param {'android'|'ios'} platform
 * @param {object} data platform-specific inspected data (see the inspectors/ module for the shape)
 * @returns {Finding[]}
 */
export function runRules(platform, data) {
  const rules = RULES_BY_PLATFORM[platform];
  if (!rules) {
    throw new Error(`No rules registered for platform "${platform}" yet.`);
  }

  return rules.map((rule) => {
    let result;
    try {
      result = rule.evaluate(data);
    } catch (err) {
      result = { status: 'warn', detail: `Rule threw while evaluating: ${err.message}` };
    }
    return {
      id: rule.id,
      title: rule.title,
      platform: rule.platform,
      severity: rule.severity,
      guideline: rule.guideline,
      status: result.status,
      detail: result.detail,
    };
  });
}
