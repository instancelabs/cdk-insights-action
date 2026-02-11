import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import { ActionInputs, parseInputs } from './inputs';
import { aggregateResults, setOutputs } from './outputs';

const TOOL_NAME = 'cdk-insights';
const REPORT_SUFFIX = '_analysis_report';

/**
 * Resolve the version string to install.
 * If 'latest', queries npm for the actual version number (needed for cache key).
 */
async function resolveVersion(version: string): Promise<string> {
  if (version !== 'latest') return version;

  let stdout = '';
  await exec.exec('npm', ['view', 'cdk-insights', 'version'], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
    },
  });

  return stdout.trim();
}

/**
 * Install cdk-insights CLI with tool caching.
 * On first run: installs via npm and caches. On subsequent runs: restores from cache.
 */
async function installCdkInsights(requestedVersion: string): Promise<void> {
  const version = await resolveVersion(requestedVersion);
  core.info(`Resolved cdk-insights version: ${version}`);

  // Check tool cache first
  const cachedPath = tc.find(TOOL_NAME, version);
  if (cachedPath) {
    core.info(`Using cached cdk-insights ${version}`);
    core.addPath(path.join(cachedPath, 'bin'));
    return;
  }

  // Not cached — install to a temp directory and cache it
  core.info(`Installing cdk-insights@${version}...`);
  const installDir = path.join(process.env.RUNNER_TEMP || '/tmp', `cdk-insights-${version}`);
  fs.mkdirSync(installDir, { recursive: true });

  await exec.exec('npm', ['install', '--prefix', installDir, `cdk-insights@${version}`], {
    silent: false,
  });

  // The binary is at installDir/node_modules/.bin/cdk-insights
  const binDir = path.join(installDir, 'node_modules', '.bin');
  const cdkInsightsPath = path.join(binDir, 'cdk-insights');
  if (!fs.existsSync(cdkInsightsPath)) {
    throw new Error('cdk-insights installation failed - binary not found after npm install');
  }

  // Cache the install directory for future runs
  const cached = await tc.cacheDir(installDir, TOOL_NAME, version);
  core.addPath(path.join(cached, 'node_modules', '.bin'));

  core.info(`cdk-insights ${version} installed and cached`);
}

async function runAnalysis(
  args: string[],
  workingDirectory: string,
  licenseKey: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const env: Record<string, string> = { CI: 'true' };

  // Copy defined env vars (process.env values can be undefined)
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // Set license key if provided (controls AI analysis in the CLI)
  if (licenseKey) {
    env.CDK_INSIGHTS_LICENSE_KEY = licenseKey;
  }

  const exitCode = await exec.exec('cdk-insights', args, {
    cwd: workingDirectory,
    env,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  });

  return { exitCode, stdout, stderr };
}

/**
 * Find auto-generated report files matching {stackName}_analysis_report.{ext}
 */
function findReportFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const suffix = `${REPORT_SUFFIX}.${ext}`;
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(suffix))
    .map(f => path.join(dir, f));
}

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

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    core.startGroup('Setup');
    await installCdkInsights(inputs.cdkInsightsVersion);
    core.endGroup();

    // Warn if AI requested without license
    if (inputs.aiAnalysis && !inputs.licenseKey) {
      core.warning('AI analysis requested but no license key provided - using static analysis only');
    }

    const args = buildScanArgs(inputs);

    core.startGroup('Running CDK Insights Analysis');
    core.info(`Command: cdk-insights ${args.join(' ')}`);

    const { exitCode, stdout, stderr } = await runAnalysis(
      args,
      inputs.workingDirectory,
      inputs.licenseKey
    );

    if (stdout) {
      core.info(stdout);
    }
    if (stderr) {
      core.warning(stderr);
    }
    core.endGroup();

    // Find auto-generated JSON report files
    const jsonFiles = findReportFiles(inputs.workingDirectory, 'json');

    // Distinguish CLI crash from normal analysis results
    if (exitCode !== 0 && jsonFiles.length === 0) {
      const errorMsg = stderr.trim() || stdout.trim() || `cdk-insights exited with code ${exitCode}`;
      throw new Error(`CDK Insights CLI failed: ${errorMsg}`);
    }

    if (jsonFiles.length === 0) {
      core.warning('No analysis report files found');
    } else {
      core.info(`Found ${jsonFiles.length} report file(s): ${jsonFiles.join(', ')}`);
    }

    // Parse and aggregate results from all report files
    core.startGroup('Processing Results');
    const results = aggregateResults(jsonFiles);

    // Generate SARIF file if requested (users should upload via github/codeql-action/upload-sarif@v3)
    let sarifFiles: string[] = [];
    if (inputs.sarifUpload) {
      core.info('Generating SARIF output...');

      const sarifArgs = buildSarifArgs(inputs);
      const sarifResult = await runAnalysis(sarifArgs, inputs.workingDirectory, inputs.licenseKey);

      sarifFiles = findReportFiles(inputs.workingDirectory, 'sarif');
      if (sarifResult.exitCode !== 0 && sarifFiles.length === 0) {
        core.warning(`SARIF generation failed: ${sarifResult.stderr.trim() || `exit code ${sarifResult.exitCode}`}`);
      } else if (sarifFiles.length > 0) {
        core.info(`SARIF file(s) generated: ${sarifFiles.join(', ')}`);
        core.info('To upload to GitHub Code Scanning, add a step using github/codeql-action/upload-sarif@v3');
      } else {
        core.warning('SARIF generation requested but no SARIF files were produced');
      }
    }

    setOutputs(results, jsonFiles, inputs.failOn, sarifFiles);
    core.endGroup();

    // Check fail conditions
    if (inputs.failOn.length > 0) {
      const failConditions: string[] = [];

      if (inputs.failOn.includes('critical') && results.criticalCount > 0) {
        failConditions.push(`${results.criticalCount} critical`);
      }
      if (inputs.failOn.includes('high') && results.highCount > 0) {
        failConditions.push(`${results.highCount} high`);
      }
      if (inputs.failOn.includes('medium') && results.mediumCount > 0) {
        failConditions.push(`${results.mediumCount} medium`);
      }
      if (inputs.failOn.includes('low') && results.lowCount > 0) {
        failConditions.push(`${results.lowCount} low`);
      }

      if (failConditions.length > 0) {
        core.setFailed(
          `Analysis found issues at configured severity levels: ${failConditions.join(', ')}`
        );
        return;
      }
    }

    // Success summary
    core.info('');
    core.info('='.repeat(50));
    core.info('CDK Insights Analysis Complete');
    core.info('='.repeat(50));
    core.info(`Total Issues: ${results.totalIssues}`);
    core.info(`  Critical: ${results.criticalCount}`);
    core.info(`  High: ${results.highCount}`);
    core.info(`  Medium: ${results.mediumCount}`);
    core.info(`  Low: ${results.lowCount}`);

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
