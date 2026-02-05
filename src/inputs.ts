import * as core from '@actions/core';

export interface ActionInputs {
  licenseKey: string;
  workingDirectory: string;
  stackName: string;
  aiAnalysis: boolean;
  failOn: string[];
  prComment: boolean;
  sarifUpload: boolean;
  outputFormat: string;
  outputFile: string;
  services: string[];
  ruleFilter: string[];
  cdkInsightsVersion: string;
}

/**
 * Parse and validate action inputs
 */
export function parseInputs(): ActionInputs {
  const licenseKey = core.getInput('license-key');
  const workingDirectory = core.getInput('working-directory') || '.';
  const stackName = core.getInput('stack-name');
  const aiAnalysis = core.getBooleanInput('ai-analysis');
  const prComment = core.getBooleanInput('pr-comment');
  const sarifUpload = core.getBooleanInput('sarif-upload');
  const outputFormat = core.getInput('output-format');
  const outputFile = core.getInput('output-file');
  const cdkInsightsVersion = core.getInput('cdk-insights-version') || 'latest';

  // Parse comma-separated lists
  const failOnInput = core.getInput('fail-on');
  const failOn = failOnInput
    ? failOnInput.split(',').map(s => s.trim().toLowerCase())
    : [];

  const servicesInput = core.getInput('services');
  const services = servicesInput
    ? servicesInput.split(',').map(s => s.trim())
    : [];

  const ruleFilterInput = core.getInput('rule-filter');
  const ruleFilter = ruleFilterInput
    ? ruleFilterInput.split(',').map(s => s.trim())
    : [];

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
    outputFormat,
    outputFile,
    services,
    ruleFilter,
    cdkInsightsVersion,
  };
}
