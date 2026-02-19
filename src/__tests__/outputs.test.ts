import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as core from '@actions/core';
import { parseResults, aggregateResults, setOutputs, AnalysisResults } from '../outputs';

vi.mock('@actions/core');
vi.mock('fs');

const mockedFs = vi.mocked(fs);
const mockedCore = vi.mocked(core);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseResults', () => {
  it('returns defaults when file does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = parseResults('/missing.json');

    expect(result).toEqual({
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      resourceCount: 0,
    });
    expect(mockedCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
  });

  it('parses summary-based JSON', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        summary: {
          totalIssues: 10,
          severityCounts: { CRITICAL: 1, HIGH: 3, MEDIUM: 4, LOW: 2 },
          totalResources: 20,
        },
      })
    );

    const result = parseResults('/results.json');

    expect(result).toEqual({
      totalIssues: 10,
      criticalCount: 1,
      highCount: 3,
      mediumCount: 4,
      lowCount: 2,
      resourceCount: 20,
    });
  });

  it('parses summary with missing severity counts', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        summary: {
          totalIssues: 5,
          severityCounts: { HIGH: 5 },
        },
      })
    );

    const result = parseResults('/results.json');

    expect(result).toEqual({
      totalIssues: 5,
      criticalCount: 0,
      highCount: 5,
      mediumCount: 0,
      lowCount: 0,
      resourceCount: 0,
    });
  });

  it('parses recommendations array with direct issues', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        recommendations: [
          {
            resourceId: 'Bucket',
            issues: [
              { severity: 'CRITICAL', resourceId: 'Bucket', issue: 'No encryption' },
              { severity: 'HIGH', resourceId: 'Bucket', issue: 'Public access' },
            ],
          },
          {
            resourceId: 'Lambda',
            issues: [
              { severity: 'LOW', resourceId: 'Lambda', issue: 'No DLQ' },
            ],
          },
        ],
      })
    );

    const result = parseResults('/results.json');

    expect(result).toEqual({
      totalIssues: 3,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 1,
      resourceCount: 2,
    });
  });

  it('returns defaults for invalid JSON', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('not json');

    const result = parseResults('/bad.json');

    expect(result).toEqual({
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      resourceCount: 0,
    });
    expect(mockedCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse')
    );
  });

  it('returns defaults for empty report', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({}));

    const result = parseResults('/empty.json');

    expect(result).toEqual({
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      resourceCount: 0,
    });
  });
});

describe('aggregateResults', () => {
  it('returns zeros for empty file list', () => {
    const result = aggregateResults([]);

    expect(result).toEqual({
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      resourceCount: 0,
    });
  });

  it('aggregates results from multiple files', () => {
    mockedFs.existsSync.mockReturnValue(true);

    // First file
    mockedFs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        summary: {
          totalIssues: 5,
          severityCounts: { CRITICAL: 1, HIGH: 2, MEDIUM: 1, LOW: 1 },
          totalResources: 10,
        },
      })
    );

    // Second file
    mockedFs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        summary: {
          totalIssues: 3,
          severityCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 0 },
          totalResources: 5,
        },
      })
    );

    const result = aggregateResults(['/stack1.json', '/stack2.json']);

    expect(result).toEqual({
      totalIssues: 8,
      criticalCount: 1,
      highCount: 3,
      mediumCount: 3,
      lowCount: 1,
      resourceCount: 15,
    });
  });
});

describe('setOutputs', () => {
  const baseResults: AnalysisResults = {
    totalIssues: 10,
    criticalCount: 1,
    highCount: 3,
    mediumCount: 4,
    lowCount: 2,
    resourceCount: 20,
  };

  it('sets all outputs correctly', () => {
    setOutputs(baseResults, ['/results.json'], [], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('total-issues', '10');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('critical-count', '1');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('high-count', '3');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('medium-count', '4');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('low-count', '2');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('json-file', '/results.json');
  });

  it('joins multiple json file paths', () => {
    setOutputs(baseResults, ['/stack1.json', '/stack2.json'], [], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('json-file', '/stack1.json,/stack2.json');
  });

  it('sets sarif-file output when paths provided', () => {
    setOutputs(baseResults, ['/results.json'], [], ['/results.sarif'], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('sarif-file', '/results.sarif');
  });

  it('does not set sarif-file when no paths', () => {
    setOutputs(baseResults, ['/results.json'], [], [], null);

    const sarifCall = (mockedCore.setOutput as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === 'sarif-file'
    );
    expect(sarifCall).toBeUndefined();
  });

  it('sets exit-code 1 when issues exist and no fail-on', () => {
    setOutputs(baseResults, ['/results.json'], [], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('exit-code', '1');
  });

  it('sets exit-code 0 when no issues', () => {
    const noIssues: AnalysisResults = {
      totalIssues: 0, criticalCount: 0, highCount: 0,
      mediumCount: 0, lowCount: 0, resourceCount: 5,
    };
    setOutputs(noIssues, ['/results.json'], [], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('exit-code', '0');
  });

  it('respects fail-on: exit-code 0 when issues exist but not at configured severity', () => {
    const lowOnly: AnalysisResults = {
      totalIssues: 3, criticalCount: 0, highCount: 0,
      mediumCount: 0, lowCount: 3, resourceCount: 2,
    };
    setOutputs(lowOnly, ['/results.json'], ['critical', 'high'], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('exit-code', '0');
  });

  it('respects fail-on: exit-code 1 when issues exist at configured severity', () => {
    const withCritical: AnalysisResults = {
      totalIssues: 5, criticalCount: 2, highCount: 0,
      mediumCount: 0, lowCount: 3, resourceCount: 3,
    };
    setOutputs(withCritical, ['/results.json'], ['critical'], [], null);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('exit-code', '1');
  });

  it('sets artifact-id output when provided', () => {
    setOutputs(baseResults, ['/results.json'], [], [], 42);

    expect(mockedCore.setOutput).toHaveBeenCalledWith('artifact-id', '42');
  });

  it('does not set artifact-id when null', () => {
    setOutputs(baseResults, ['/results.json'], [], [], null);

    const artifactCall = (mockedCore.setOutput as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === 'artifact-id'
    );
    expect(artifactCall).toBeUndefined();
  });
});
