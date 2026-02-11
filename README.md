# CDK Insights GitHub Action

Analyze your AWS CDK infrastructure for security vulnerabilities, cost optimization opportunities, and best practice violations - directly in your CI/CD pipeline.

## Features

- **Security scanning** - Detect misconfigurations and vulnerabilities before deployment
- **Cost optimization** - Find opportunities to reduce AWS spend
- **Best practices** - Ensure CDK patterns follow AWS Well-Architected Framework
- **AI-powered analysis** - Get intelligent recommendations (Pro/Team license)
- **PR comments** - Automatic summary posted on pull requests
- **Code scanning** - SARIF integration with GitHub Security tab

## Quick Start

```yaml
name: CDK Insights
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # Required for PR comments

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: CDK Insights Analysis
        uses: TheLeePriest/cdk-insights-action@v1
        with:
          license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
          ai-analysis: true
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `license-key` | CDK Insights license key (required for AI analysis) | No | - |
| `working-directory` | Directory containing CDK project | No | `.` |
| `stack-name` | Specific stack to analyze (analyzes all by default) | No | (all stacks) |
| `ai-analysis` | Enable AI-powered recommendations (requires `license-key`). Set to `false` with a license key to force static-only analysis. | No | `false` |
| `fail-on` | Fail workflow on severity levels (comma-separated: `critical,high,medium,low`) | No | - |
| `pr-comment` | Post analysis summary as PR comment | No | `true` |
| `sarif-upload` | Generate SARIF results file for GitHub Code Scanning | No | `false` |
| `services` | Filter analysis to specific AWS services (comma-separated) | No | (all services) |
| `rule-filter` | Filter to specific rules (comma-separated rule IDs) | No | - |
| `cdk-insights-version` | Specific version of cdk-insights to use | No | `latest` |

## Outputs

| Output | Description |
|--------|-------------|
| `total-issues` | Total number of issues found |
| `critical-count` | Number of critical issues |
| `high-count` | Number of high severity issues |
| `medium-count` | Number of medium severity issues |
| `low-count` | Number of low severity issues |
| `sarif-file` | Path to SARIF file(s) (if generated) |
| `json-file` | Path to JSON results file(s) |
| `exit-code` | Exit code (0 = no issues at `fail-on` severity, 1 = issues found) |

## Examples

### Basic Analysis (Free Tier)

Static analysis with PR comments - no license required:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
```

### AI-Powered Analysis

Enable AI recommendations with a Pro or Team license:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
    ai-analysis: true
```

### Static-Only with License Key

Force static analysis even with a license key (skips AI):

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
    ai-analysis: false
```

### Fail on Critical/High Issues

Block merges if critical or high severity issues are found:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
    ai-analysis: true
    fail-on: critical,high
```

### Specific Stack

Analyze only a specific CDK stack:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    stack-name: ProductionStack
```

### GitHub Code Scanning Integration

Generate SARIF results and upload to GitHub's Security tab:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  id: cdk-insights
  with:
    sarif-upload: true

- name: Upload SARIF to GitHub Code Scanning
  if: steps.cdk-insights.outputs.sarif-file != ''
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: ${{ steps.cdk-insights.outputs.sarif-file }}
```

### Monorepo with Multiple CDK Projects

```yaml
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: [backend, frontend-api, data-pipeline]

    steps:
      - uses: actions/checkout@v4

      - uses: TheLeePriest/cdk-insights-action@v1
        with:
          working-directory: packages/${{ matrix.project }}
          license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
```

### Using Outputs in Subsequent Steps

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  id: analysis
  with:
    license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}

- name: Check results
  run: |
    echo "Total issues: ${{ steps.analysis.outputs.total-issues }}"
    echo "Critical: ${{ steps.analysis.outputs.critical-count }}"

    if [ "${{ steps.analysis.outputs.critical-count }}" -gt "0" ]; then
      echo "::warning::Critical issues found!"
    fi
```

### Filter by AWS Services

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    services: S3,Lambda,DynamoDB,IAM
```

## Permissions

The action requires different permissions depending on features used:

```yaml
permissions:
  contents: read        # Always required
  pull-requests: write  # Required for PR comments
  security-events: write  # Required for SARIF upload to Code Scanning
```

## PR Comment Example

When `pr-comment: true` (default), the action posts a summary like:

> ## CDK Insights Analysis
>
> **Stack:** MyStack | **Resources:** 47 | **Issues:** 19 | **Analysis:** AI-powered
>
> ### Summary by Severity
>
> | Severity | Count |
> |----------|-------|
> | Critical | 2 |
> | High | 5 |
> | Medium | 12 |
>
> ### Top Issues
>
> 1. **S3 bucket without encryption** (Critical)
>    `MyStack/DataBucket` - Enable server-side encryption
>
> 2. **Lambda without DLQ** (High)
>    `MyStack/ProcessorFunction` - Add dead-letter queue
>
> <details>
> <summary>View all 19 issues</summary>
> ...
> </details>

## Pricing

| Tier | Resources/month | AI Analysis | Price |
|------|-----------------|-------------|-------|
| Free | 2,500 | No | $0 |
| Pro | 10,000 | Yes | $29/mo |
| Team | 15,000/member | Yes | $49/member/mo |

[Get a license at cdkinsights.dev](https://cdkinsights.dev/pricing)

## Support

- Documentation: [cdkinsights.dev/docs](https://cdkinsights.dev/docs)
- Issues: [github.com/TheLeePriest/cdk-insights-action/issues](https://github.com/TheLeePriest/cdk-insights-action/issues)
- Email: support@cdkinsights.dev

## License

MIT
