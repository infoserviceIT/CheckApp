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
 * @property {string|null} remediation concrete "how to fix it" guidance for
 *   this specific finding. null when there's nothing to fix (a 'pass', or a
 *   plain inventory 'info') — set on 'fail'/'warn' findings that are actionable.
 */

/**
 * Builds one Finding from one evaluate() result. A result may override the
 * rule's own id/title/severity/guideline — this is what lets a single rule
 * (see the permissions-inventory rule) emit several distinct, individually
 * identifiable findings out of one manifest instead of being locked to one
 * static id/title per rule.
 *
 * @param {object} rule
 * @param {object} result
 * @returns {Finding}
 */
function toFinding(rule, result) {
  return {
    id: result.id ?? rule.id,
    title: result.title ?? rule.title,
    platform: rule.platform,
    severity: result.severity ?? rule.severity,
    guideline: result.guideline ?? rule.guideline,
    status: result.status,
    detail: result.detail,
    remediation: result.remediation ?? null,
  };
}

/**
 * Runs every registered rule for a platform against inspected manifest data
 * and returns one or more Findings per rule. A rule that throws is turned
 * into a 'warn' finding rather than crashing the whole scan — one bad rule
 * shouldn't hide every other result.
 *
 * A rule's evaluate() may return either a single result object, or an array
 * of them. The array form exists for rules that need to flag several
 * distinct issues out of one manifest — e.g. the permissions rule emitting
 * one finding per sensitive permission, each with its own remediation —
 * instead of flattening everything into one long detail string.
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

  return rules.flatMap((rule) => {
    let result;
    try {
      result = rule.evaluate(data);
    } catch (err) {
      result = { status: 'warn', detail: `Rule threw while evaluating: ${err.message}` };
    }
    const results = Array.isArray(result) ? result : [result];
    return results.map((r) => toFinding(rule, r));
  });
}
