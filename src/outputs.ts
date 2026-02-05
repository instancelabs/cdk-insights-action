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
  recommendations?: Record<string, {
    issues?: Issue[];
    sources?: {
      cdkInsights?: { issues: Issue[] };
      cdkNag?: { issues: Issue[] };
    };
  }>;
}

/**
 * Parse analysis results from JSON output file
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

    // Otherwise, count from recommendations
    if (report.recommendations) {
      const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      let totalIssues = 0;
      const resourceCount = Object.keys(report.recommendations).length;

      for (const resource of Object.values(report.recommendations)) {
        // Check direct issues array
        if (resource.issues) {
          for (const issue of resource.issues) {
            totalIssues++;
            if (issue.severity && severityCounts[issue.severity] !== undefined) {
              severityCounts[issue.severity]++;
            }
          }
        }

        // Check sources
        if (resource.sources) {
          const cdkInsightsIssues = resource.sources.cdkInsights?.issues || [];
          const cdkNagIssues = resource.sources.cdkNag?.issues || [];
          const allIssues = [...cdkInsightsIssues, ...cdkNagIssues];

          for (const issue of allIssues) {
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
 * Set action outputs based on analysis results
 */
export function setOutputs(
  results: AnalysisResults,
  jsonPath: string,
  sarifPath?: string
): void {
  core.setOutput('total-issues', results.totalIssues.toString());
  core.setOutput('critical-count', results.criticalCount.toString());
  core.setOutput('high-count', results.highCount.toString());
  core.setOutput('medium-count', results.mediumCount.toString());
  core.setOutput('low-count', results.lowCount.toString());
  core.setOutput('json-file', jsonPath);

  if (sarifPath && fs.existsSync(sarifPath)) {
    core.setOutput('sarif-file', sarifPath);
  }

  // Determine exit code based on findings
  const exitCode = results.totalIssues > 0 ? 1 : 0;
  core.setOutput('exit-code', exitCode.toString());
}
