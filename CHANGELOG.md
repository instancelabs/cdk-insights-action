# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
