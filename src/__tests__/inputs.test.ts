import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { parseInputs } from '../inputs';

vi.mock('@actions/core');

const mockedCore = vi.mocked(core);

function mockInputs(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    'license-key': '',
    'working-directory': '.',
    'stack-name': '',
    'ai-analysis': 'false',
    'pr-comment': 'true',
    'sarif-upload': 'false',
    'services': '',
    'rule-filter': '',
    'fail-on': '',
    'cdk-insights-version': 'latest',
  };

  const values = { ...defaults, ...overrides };

  mockedCore.getInput.mockImplementation((name: string) => values[name] || '');
  mockedCore.getBooleanInput.mockImplementation((name: string) => values[name] === 'true');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseInputs', () => {
  it('returns defaults when no inputs provided', () => {
    mockInputs();

    const result = parseInputs();

    expect(result.licenseKey).toBe('');
    expect(result.workingDirectory).toBe('.');
    expect(result.stackName).toBe('');
    expect(result.aiAnalysis).toBe(false);
    expect(result.prComment).toBe(true);
    expect(result.sarifUpload).toBe(false);
    expect(result.failOn).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.ruleFilter).toEqual([]);
    expect(result.cdkInsightsVersion).toBe('latest');
  });

  it('parses comma-separated fail-on values', () => {
    mockInputs({ 'fail-on': 'critical, high , medium' });

    const result = parseInputs();

    expect(result.failOn).toEqual(['critical', 'high', 'medium']);
  });

  it('lowercases fail-on values', () => {
    mockInputs({ 'fail-on': 'CRITICAL,High' });

    const result = parseInputs();

    expect(result.failOn).toEqual(['critical', 'high']);
  });

  it('warns on invalid severity values', () => {
    mockInputs({ 'fail-on': 'critical,invalid' });

    parseInputs();

    expect(mockedCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Invalid severity in fail-on: invalid')
    );
  });

  it('parses comma-separated services', () => {
    mockInputs({ 'services': 'S3, Lambda, DynamoDB' });

    const result = parseInputs();

    expect(result.services).toEqual(['S3', 'Lambda', 'DynamoDB']);
  });

  it('parses comma-separated rule filter', () => {
    mockInputs({ 'rule-filter': 'RULE-001, RULE-002' });

    const result = parseInputs();

    expect(result.ruleFilter).toEqual(['RULE-001', 'RULE-002']);
  });

  it('masks license key as secret when provided', () => {
    mockInputs({ 'license-key': 'my-secret-key' });

    parseInputs();

    expect(mockedCore.setSecret).toHaveBeenCalledWith('my-secret-key');
  });

  it('does not call setSecret when no license key', () => {
    mockInputs({ 'license-key': '' });

    parseInputs();

    expect(mockedCore.setSecret).not.toHaveBeenCalled();
  });

  it('uses custom working directory', () => {
    mockInputs({ 'working-directory': 'packages/api' });

    const result = parseInputs();

    expect(result.workingDirectory).toBe('packages/api');
  });

  it('defaults cdk-insights-version to latest when empty', () => {
    mockInputs({ 'cdk-insights-version': '' });

    const result = parseInputs();

    expect(result.cdkInsightsVersion).toBe('latest');
  });
});
