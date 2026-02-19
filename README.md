# CDK Insights GitHub Action

Analyze your AWS CDK infrastructure for security vulnerabilities, cost optimization opportunities, and best practice violations - directly in your CI/CD pipeline.

## Features

- **Security scanning** - Detect misconfigurations and vulnerabilities before deployment
- **Cost optimization** - Find opportunities to reduce AWS spend
- **Best practices** - Ensure CDK patterns follow AWS Well-Architected Framework
- **AI-powered analysis** - Get intelligent recommendations (Pro/Team license)
- **PR comments** - Automatic summary posted on pull requests
- **Code scanning** - Auto-upload SARIF to GitHub Security tab
- **Report artifacts** - JSON, SARIF, and markdown reports persisted as downloadable artifacts

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
| `sarif-upload` | Generate SARIF file and auto-upload to GitHub Code Scanning | No | `false` |
| `upload-artifact` | Upload report files (JSON, SARIF, markdown) as a GitHub artifact | No | `true` |
| `artifact-name` | Name for the uploaded artifact | No | `cdk-insights-report` |
| `github-token` | GitHub token for SARIF upload to Code Scanning | No | `${{ github.token }}` |
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
| `artifact-id` | ID of the uploaded artifact (if `upload-artifact` is enabled) |
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

### GitHub Code Scanning (SARIF)

When `sarif-upload: true`, the action automatically generates SARIF files and uploads them to GitHub's Security tab — no extra steps needed:

```yaml
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write  # Required for SARIF upload

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      - uses: TheLeePriest/cdk-insights-action@v1
        with:
          license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
          sarif-upload: true
          fail-on: critical,high
```

> **Note:** SARIF upload to the Security tab requires Code Scanning to be enabled on the repository. This is free for public repos. Private repos require GitHub Advanced Security.

### Report Artifacts

By default (`upload-artifact: true`), all report files are uploaded as a downloadable GitHub artifact. This includes JSON, SARIF, and markdown reports. You can find them in the workflow run summary under "Artifacts".

To customize the artifact name:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    artifact-name: security-report
```

To disable artifact upload:

```yaml
- uses: TheLeePriest/cdk-insights-action@v1
  with:
    upload-artifact: false
```

### Full Example

A complete workflow with all features enabled:

```yaml
name: CDK Insights Analysis
on:
  pull_request:
    branches: [main]
    paths:
      - 'lib/**'
      - 'bin/**'
      - 'cdk.json'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: CDK Insights Analysis
        id: analysis
        uses: TheLeePriest/cdk-insights-action@v1
        with:
          license-key: ${{ secrets.CDK_INSIGHTS_LICENSE_KEY }}
          ai-analysis: true
          fail-on: critical,high
          pr-comment: true
          sarif-upload: true
          upload-artifact: true
          artifact-name: cdk-insights-report
```

This will:
1. Analyze all CDK stacks with AI-powered recommendations
2. Post a detailed summary as a PR comment
3. Upload SARIF results to the GitHub Security tab
4. Persist JSON, SARIF, and markdown reports as downloadable artifacts
5. Fail the workflow if critical or high severity issues are found

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
          artifact-name: cdk-insights-${{ matrix.project }}
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
    echo "Artifact ID: ${{ steps.analysis.outputs.artifact-id }}"

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

| Permission | Required For | When to Add |
|------------|-------------|-------------|
| `contents: read` | Checking out code | Always |
| `pull-requests: write` | PR comments | When `pr-comment: true` (default) |
| `security-events: write` | SARIF upload to Security tab | When `sarif-upload: true` |

> **Note:** Artifact upload uses the default `GITHUB_TOKEN` permissions and does not require additional permissions.

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
