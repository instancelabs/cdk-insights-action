import * as core from '@actions/core';
import * as path from 'path';

export interface ActionInputs {
  licenseKey: string;
  workingDirectory: string;
  stackName: string;
  aiAnalysis: boolean;
  failOn: string[];
  prComment: boolean;
  sarifUpload: boolean;
  uploadArtifact: boolean;
  artifactName: string;
  githubToken: string;
  services: string[];
  ruleFilter: string[];
  cdkInsightsVersion: string;
}

/** Safe pattern for stack names (alphanumeric, hyphens, underscores) */
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Safe pattern for service names (alphanumeric only, e.g. S3, Lambda, DynamoDB) */
const SAFE_SERVICE_PATTERN = /^[a-zA-Z0-9]+$/;

/** Safe pattern for rule IDs (alphanumeric, hyphens, underscores, dots) */
const SAFE_RULE_PATTERN = /^[a-zA-Z0-9_.-]+$/;

/** Semver pattern or 'latest' */
const SAFE_VERSION_PATTERN = /^(latest|\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)$/;

/**
 * Validate a value against a pattern, throwing if invalid.
 * Also rejects values starting with '-' to prevent argument injection.
 */
function validateInput(value: string, pattern: RegExp, label: string): void {
  if (!value) return;
  if (value.startsWith('-')) {
    throw new Error(`Invalid ${label}: "${value}" must not start with a hyphen`);
  }
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" contains disallowed characters`);
  }
}

/**
 * Validate that workingDirectory doesn't escape the workspace via traversal
 */
function validateWorkingDirectory(dir: string): void {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const resolved = path.resolve(workspace, dir);
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Invalid working-directory: "${dir}" resolves outside the workspace`);
  }
}

/**
 * Parse and validate action inputs
 */
export function parseInputs(): ActionInputs {
  const licenseKey = core.getInput('license-key');
  if (licenseKey) {
    core.setSecret(licenseKey);
  }
  const workingDirectory = core.getInput('working-directory') || '.';
  const stackName = core.getInput('stack-name');
  const aiAnalysis = core.getBooleanInput('ai-analysis');
  const prComment = core.getBooleanInput('pr-comment');
  const sarifUpload = core.getBooleanInput('sarif-upload');
  const uploadArtifact = core.getBooleanInput('upload-artifact');
  const artifactName = core.getInput('artifact-name') || 'cdk-insights-report';
  const githubToken = core.getInput('github-token');
  if (githubToken) {
    core.setSecret(githubToken);
  }
  const cdkInsightsVersion = core.getInput('cdk-insights-version') || 'latest';

  // Parse comma-separated lists
  const failOnInput = core.getInput('fail-on');
  const failOn = failOnInput
    ? failOnInput.split(',').map(s => s.trim().toLowerCase())
    : [];

  const servicesInput = core.getInput('services');
  const services = servicesInput
    ? servicesInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];

  const ruleFilterInput = core.getInput('rule-filter');
  const ruleFilter = ruleFilterInput
    ? ruleFilterInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];

  // --- Input validation ---

  // Validate stack name (prevents argument injection via --flag-like names)
  validateInput(stackName, SAFE_NAME_PATTERN, 'stack-name');

  // Validate services (prevents argument injection)
  for (const service of services) {
    validateInput(service, SAFE_SERVICE_PATTERN, 'services');
  }

  // Validate rule filter (prevents argument injection)
  for (const rule of ruleFilter) {
    validateInput(rule, SAFE_RULE_PATTERN, 'rule-filter');
  }

  // Validate version (prevents command injection via crafted version strings)
  validateInput(cdkInsightsVersion, SAFE_VERSION_PATTERN, 'cdk-insights-version');

  // Validate working directory (prevents path traversal)
  validateWorkingDirectory(workingDirectory);

  // Validate fail-on values
  const validSeverities = ['critical', 'high', 'medium', 'low'];
  for (const severity of failOn) {
    if (!validSeverities.includes(severity)) {
      core.warning(`Invalid severity in fail-on: ${severity}. Valid values: ${validSeverities.join(', ')}`);
    }
  }

  // Log configuration (without exposing license key)
  core.info('Configuration:');
  core.info(`  Working Directory: ${workingDirectory}`);
  core.info(`  Stack Name: ${stackName || '(all stacks)'}`);
  core.info(`  AI Analysis: ${aiAnalysis}`);
  core.info(`  License Key: ${licenseKey ? '(provided)' : '(not provided)'}`);
  core.info(`  PR Comment: ${prComment}`);
  core.info(`  SARIF Upload: ${sarifUpload}`);
  core.info(`  Upload Artifact: ${uploadArtifact}`);
  if (uploadArtifact) {
    core.info(`  Artifact Name: ${artifactName}`);
  }
  core.info(`  Fail On: ${failOn.length > 0 ? failOn.join(', ') : '(none)'}`);
  if (services.length > 0) {
    core.info(`  Services: ${services.join(', ')}`);
  }
  if (ruleFilter.length > 0) {
    core.info(`  Rule Filter: ${ruleFilter.join(', ')}`);
  }
  core.info(`  CDK Insights Version: ${cdkInsightsVersion}`);

  return {
    licenseKey,
    workingDirectory,
    stackName,
    aiAnalysis,
    failOn,
    prComment,
    sarifUpload,
    uploadArtifact,
    artifactName,
    githubToken,
    services,
    ruleFilter,
    cdkInsightsVersion,
  };
}
