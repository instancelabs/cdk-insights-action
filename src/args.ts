import { ActionInputs } from './inputs';

/**
 * Build CLI arguments for the main scan command.
 * Pure function — no side effects, fully testable.
 */
export function buildScanArgs(inputs: ActionInputs): string[] {
  const args: string[] = ['scan'];

  // Stack name or analyze all
  if (inputs.stackName) {
    args.push(inputs.stackName);
  } else {
    args.push('--all');
  }

  // Skip interactive prompts in CI
  args.push('--yes');

  // Disable CLI's built-in failOnCritical so the action controls failure
  args.push('--no-failOnCritical');

  // AI analysis is controlled by CDK_INSIGHTS_LICENSE_KEY env var (no --ai flag in CLI)
  // Use --local to force static-only analysis when user has a license but wants to skip AI
  if (!inputs.aiAnalysis && inputs.licenseKey) {
    args.push('--local');
  }

  // PR comment (uses gh CLI, which auto-authenticates via GITHUB_TOKEN in GitHub Actions)
  if (inputs.prComment) {
    args.push('--prComment');
  }

  // Services filter (yargs array type — pass as individual args)
  if (inputs.services.length > 0) {
    args.push('--services', ...inputs.services);
  }

  // Rule filter (yargs array type — pass as individual args)
  if (inputs.ruleFilter.length > 0) {
    args.push('--ruleFilter', ...inputs.ruleFilter);
  }

  // Output as JSON (CLI auto-generates {stackName}_analysis_report.json)
  args.push('--format', 'json');

  return args;
}

/**
 * Build CLI arguments for the SARIF generation run.
 */
export function buildSarifArgs(inputs: ActionInputs): string[] {
  const args: string[] = ['scan'];

  if (inputs.stackName) {
    args.push(inputs.stackName);
  } else {
    args.push('--all');
  }

  args.push('--yes');
  args.push('--no-failOnCritical');
  args.push('--format', 'sarif');

  return args;
}
