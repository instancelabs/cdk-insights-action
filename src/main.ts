import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';
import { parseInputs } from './inputs';
import { parseResults, setOutputs } from './outputs';

const SARIF_FILE = 'cdk-insights-results.sarif';
const JSON_FILE = 'cdk-insights-results.json';

async function installCdkInsights(version: string): Promise<void> {
  const packageSpec = version === 'latest' ? 'cdk-insights' : `cdk-insights@${version}`;

  core.info(`Installing ${packageSpec}...`);

  await exec.exec('npm', ['install', '-g', packageSpec], {
    silent: false,
  });

  // Verify installation
  const cdkInsightsPath = await io.which('cdk-insights', false);
  if (!cdkInsightsPath) {
    throw new Error('cdk-insights installation failed - command not found in PATH');
  }

  core.info('cdk-insights installed successfully');
}

async function runAnalysis(
  args: string[],
  workingDirectory: string,
  licenseKey: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    // Force CI mode
    CI: 'true',
  };

  // Only set license key if provided
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

async function uploadSarif(sarifPath: string): Promise<void> {
  if (!fs.existsSync(sarifPath)) {
    core.warning(`SARIF file not found at ${sarifPath}, skipping upload`);
    return;
  }

  core.info('Uploading SARIF results to GitHub Code Scanning...');

  // Read and validate SARIF file
  const sarifContent = fs.readFileSync(sarifPath, 'utf8');
  const sarif = JSON.parse(sarifContent);

  if (!sarif.runs || sarif.runs.length === 0) {
    core.info('SARIF file contains no runs, skipping upload');
    return;
  }

  // Use github/codeql-action/upload-sarif for SARIF upload
  // This requires the user to have code-scanning write permissions
  try {
    await exec.exec('npx', [
      '@github/codeql-action/upload-sarif@v3',
      '--sarif-file',
      sarifPath,
    ]);
    core.info('SARIF results uploaded successfully');
  } catch (error) {
    // SARIF upload might fail due to permissions - warn but don't fail the action
    core.warning(`Failed to upload SARIF results: ${error instanceof Error ? error.message : String(error)}`);
    core.warning('Ensure the workflow has "security-events: write" permission');
  }
}

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    core.startGroup('Setup');
    await installCdkInsights(inputs.cdkInsightsVersion);
    core.endGroup();

    // Build CLI arguments
    const args: string[] = ['scan'];

    // Stack name
    if (inputs.stackName) {
      args.push(inputs.stackName);
    }

    // AI analysis
    if (inputs.aiAnalysis && inputs.licenseKey) {
      args.push('--ai');
    } else if (inputs.aiAnalysis && !inputs.licenseKey) {
      core.warning('AI analysis requested but no license key provided - using static analysis only');
    }

    // PR comment
    if (inputs.prComment) {
      args.push('--prComment');
    }

    // Fail on critical
    if (inputs.failOn.includes('critical')) {
      args.push('--failOnCritical');
    }

    // Services filter
    if (inputs.services.length > 0) {
      args.push('--services', inputs.services.join(','));
    }

    // Rule filter
    if (inputs.ruleFilter.length > 0) {
      args.push('--ruleFilter', inputs.ruleFilter.join(','));
    }

    // Always generate JSON for parsing results
    const jsonPath = path.join(inputs.workingDirectory, JSON_FILE);
    args.push('--output', 'json');
    args.push('--outputFile', jsonPath);

    // Additional output format
    if (inputs.outputFormat && inputs.outputFile) {
      args.push('--format', inputs.outputFormat);
      args.push('--output', inputs.outputFile);
    }

    core.startGroup('Running CDK Insights Analysis');
    core.info(`Command: cdk-insights ${args.join(' ')}`);

    const { stdout, stderr } = await runAnalysis(
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

    // Parse results and set outputs
    core.startGroup('Processing Results');
    const results = parseResults(jsonPath);
    setOutputs(results, jsonPath, inputs.sarifUpload ? path.join(inputs.workingDirectory, SARIF_FILE) : undefined);
    core.endGroup();

    // Generate and upload SARIF if requested
    if (inputs.sarifUpload) {
      core.startGroup('SARIF Upload');

      // Run analysis again with SARIF output
      const sarifPath = path.join(inputs.workingDirectory, SARIF_FILE);
      const sarifArgs = ['scan'];
      if (inputs.stackName) sarifArgs.push(inputs.stackName);
      sarifArgs.push('--output', 'sarif');
      sarifArgs.push('--outputFile', sarifPath);

      await runAnalysis(sarifArgs, inputs.workingDirectory, inputs.licenseKey);
      await uploadSarif(sarifPath);

      core.endGroup();
    }

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
