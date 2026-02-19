import * as core from '@actions/core';
import * as fs from 'fs';

export interface AnalysisResults {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  resourceCount: number;
}

interface Issue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  resourceId: string;
  issue: string;
  recommendation?: string;
  wafPillar?: string;
  foundBy?: string;
}

interface RecommendationItem {
  resourceId: string;
  logicalId?: string;
  issues?: Issue[];
}

interface JsonReport {
  summary?: {
    totalIssues?: number;
    severityCounts?: {
      CRITICAL?: number;
      HIGH?: number;
      MEDIUM?: number;
      LOW?: number;
    };
    totalResources?: number;
  };
  recommendations?: RecommendationItem[];
}

/**
 * Parse analysis results from a single JSON report file
 */
export function parseResults(jsonPath: string): AnalysisResults {
  const defaultResults: AnalysisResults = {
    totalIssues: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    resourceCount: 0,
  };

  if (!fs.existsSync(jsonPath)) {
    core.warning(`Results file not found at ${jsonPath}`);
    return defaultResults;
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const report: JsonReport = JSON.parse(content);

    // If summary is present, use it directly
    if (report.summary) {
      return {
        totalIssues: report.summary.totalIssues || 0,
        criticalCount: report.summary.severityCounts?.CRITICAL || 0,
        highCount: report.summary.severityCounts?.HIGH || 0,
        mediumCount: report.summary.severityCounts?.MEDIUM || 0,
        lowCount: report.summary.severityCounts?.LOW || 0,
        resourceCount: report.summary.totalResources || 0,
      };
    }

    // Fallback: count from recommendations array
    if (report.recommendations && Array.isArray(report.recommendations)) {
      const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      let totalIssues = 0;
      const resourceCount = report.recommendations.length;

      for (const resource of report.recommendations) {
        if (resource.issues) {
          for (const issue of resource.issues) {
            totalIssues++;
            if (issue.severity && severityCounts[issue.severity] !== undefined) {
              severityCounts[issue.severity]++;
            }
          }
        }
      }

      return {
        totalIssues,
        criticalCount: severityCounts.CRITICAL,
        highCount: severityCounts.HIGH,
        mediumCount: severityCounts.MEDIUM,
        lowCount: severityCounts.LOW,
        resourceCount,
      };
    }

    return defaultResults;
  } catch (error) {
    core.warning(`Failed to parse results file: ${error instanceof Error ? error.message : String(error)}`);
    return defaultResults;
  }
}

/**
 * Aggregate results from multiple report files (one per stack)
 */
export function aggregateResults(jsonPaths: string[]): AnalysisResults {
  const combined: AnalysisResults = {
    totalIssues: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    resourceCount: 0,
  };

  for (const jsonPath of jsonPaths) {
    const result = parseResults(jsonPath);
    combined.totalIssues += result.totalIssues;
    combined.criticalCount += result.criticalCount;
    combined.highCount += result.highCount;
    combined.mediumCount += result.mediumCount;
    combined.lowCount += result.lowCount;
    combined.resourceCount += result.resourceCount;
  }

  return combined;
}

/**
 * Set action outputs based on analysis results
 */
export function setOutputs(
  results: AnalysisResults,
  jsonPaths: string[],
  failOn: string[],
  sarifPaths: string[],
  artifactId?: number | null
): void {
  core.setOutput('total-issues', results.totalIssues.toString());
  core.setOutput('critical-count', results.criticalCount.toString());
  core.setOutput('high-count', results.highCount.toString());
  core.setOutput('medium-count', results.mediumCount.toString());
  core.setOutput('low-count', results.lowCount.toString());
  core.setOutput('json-file', jsonPaths.join(','));

  if (sarifPaths.length > 0) {
    core.setOutput('sarif-file', sarifPaths.join(','));
  }

  if (artifactId != null) {
    core.setOutput('artifact-id', artifactId.toString());
  }

  // Determine exit code: if fail-on is configured, only count matching severities
  let exitCode = 0;
  if (failOn.length > 0) {
    const matchingIssues =
      (failOn.includes('critical') ? results.criticalCount : 0) +
      (failOn.includes('high') ? results.highCount : 0) +
      (failOn.includes('medium') ? results.mediumCount : 0) +
      (failOn.includes('low') ? results.lowCount : 0);
    exitCode = matchingIssues > 0 ? 1 : 0;
  } else {
    exitCode = results.totalIssues > 0 ? 1 : 0;
  }
  core.setOutput('exit-code', exitCode.toString());
}
