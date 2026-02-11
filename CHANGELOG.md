# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-11

### Added

- Tool caching for cdk-insights CLI — subsequent runs skip npm install entirely
- CLI crash detection — distinguishes between analysis findings and CLI failures
- Unit tests for inputs, outputs, and arg building (41 tests via vitest)
- `ai-analysis: false` now passes `--local` to force static-only analysis with a license key
- CI checks that `dist/` is up to date and validates action outputs
- `--all --yes` flags for CI-safe multi-stack analysis when no stack name is provided

### Fixed

- Removed `--ai` flag which does not exist in the cdk-insights CLI
- Removed `--outputFile` flag which does not exist in the CLI; action now discovers auto-generated report files
- Removed broken SARIF upload via `npx @github/codeql-action`; SARIF files are now generated for users to upload via `github/codeql-action/upload-sarif@v3`
- Fixed conflicting `--output` CLI flags when additional output format was requested
- Fixed `--services` and `--ruleFilter` arg passing to use yargs array format
- Fixed `exit-code` output to respect `fail-on` severity configuration
- Fixed `process.env` type safety (removed unsafe type assertion)
- Fixed org references from `cdkinsights` to `TheLeePriest` in release workflow and README
- Added `core.setSecret()` to mask license key in logs
- Disabled CLI's built-in `--failOnCritical` so the action controls failure thresholds consistently
- Passed `GITHUB_TOKEN` through environment for `gh` CLI PR comment authentication

### Changed

- Uses `--format` (preferred alias) instead of `--output` for CLI format flag
- Upgraded `softprops/action-gh-release` from v1 to v2 in release workflow
- Updated `sarif-upload` input description to reflect generation-only behavior
- Removed unused `output-format` and `output-file` inputs
- Replaced `@actions/io` with `@actions/tool-cache` for installation
- README fully updated to match current inputs, outputs, and usage patterns

## [1.0.0] - 2026-02-05

### Added

- Initial release of CDK Insights GitHub Action
- Static analysis of AWS CDK infrastructure
- AI-powered analysis with license key
- PR comment summaries with severity breakdown
- SARIF upload for GitHub Code Scanning integration
- Configurable failure thresholds by severity level
- Support for filtering by AWS services
- Support for filtering by rule IDs
- Outputs for issue counts and file paths
- Support for monorepo setups with `working-directory` input
- Configurable cdk-insights version

### Features

- **Security scanning** - Detect misconfigurations and vulnerabilities
- **Cost optimization** - Find opportunities to reduce AWS spend
- **Best practices** - Ensure CDK patterns follow AWS Well-Architected Framework
- **PR comments** - Automatic summary posted on pull requests
- **Code scanning** - SARIF integration with GitHub Security tab
