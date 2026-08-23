import { inspectAndroidBundle, BundletoolNotFoundError } from './inspectors/android-bundletool.js';
import { runRules } from './rules/index.js';
import { toConsoleReport, toJsonReport, summarize } from './report/format.js';

const USAGE = `Usage:
  checkapp scan <path-to.aab> [--json]

Currently supports Android App Bundles (.aab). iOS support is Phase 2 —
see the architecture doc linked in README.md.`;

export async function main(argv) {
  const [command, target, ...rest] = argv;

  if (command !== 'scan' || !target) {
    console.log(USAGE);
    return command ? 1 : 0;
  }

  const asJson = rest.includes('--json');

  if (!target.endsWith('.aab')) {
    console.error('Only .aab files are supported right now (Phase 1 scope is Android).');
    return 1;
  }

  let findings;
  try {
    const data = inspectAndroidBundle(target);
    findings = runRules('android', data);
  } catch (err) {
    if (err instanceof BundletoolNotFoundError) {
      console.error(err.message);
      return 2;
    }
    console.error(`Scan failed: ${err.message}`);
    return 1;
  }

  console.log(asJson ? toJsonReport(findings) : toConsoleReport(findings));

  const { blockingFailures } = summarize(findings);
  return blockingFailures > 0 ? 1 : 0;
}
