const STATUS_LABEL = {
  pass: 'PASS',
  fail: 'FAIL',
  warn: 'WARN',
  info: 'INFO',
};

/**
 * @param {import('../rules/index.js').Finding[]} findings
 * @returns {{ pass: number, fail: number, warn: number, info: number, blockingFailures: number }}
 */
export function summarize(findings) {
  const counts = { pass: 0, fail: 0, warn: 0, info: 0 };
  let blockingFailures = 0;
  for (const f of findings) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
    if (f.status === 'fail' && f.severity === 'critical') blockingFailures += 1;
  }
  return { ...counts, blockingFailures };
}

/** Plain-text table, no dependencies, safe for any terminal. */
export function toConsoleReport(findings) {
  const lines = [];
  const summary = summarize(findings);

  lines.push('CheckApp report');
  lines.push('='.repeat(15));
  for (const f of findings) {
    lines.push(`[${STATUS_LABEL[f.status]}] (${f.severity}) ${f.title}`);
    lines.push(`        ${f.detail}`);
  }
  lines.push('');
  lines.push(
    `${summary.pass} pass, ${summary.fail} fail, ${summary.warn} warn, ${summary.info} info — ` +
      `${summary.blockingFailures} blocking (critical) failure(s).`
  );
  return lines.join('\n');
}

export function toJsonReport(findings) {
  return JSON.stringify({ summary: summarize(findings), findings }, null, 2);
}
