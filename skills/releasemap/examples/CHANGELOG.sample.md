# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.2.1] - 2024-06-10

### Fixed
- Correct edge case in token budget trimming when releases array is empty
- Handle null published_at from GitHub Releases API gracefully

## [3.2.0] - 2024-05-22

### Added
- `--limit N` flag to cap the number of releases returned
- Support for `@scope/package` npm names with slashes in the target

### Changed
- Improved source-detection heuristic to prefer local file check before slug match

## [3.1.0] - 2024-04-11

### Added
- `--max-tokens N` flag to trim digest to a token budget
- Changelog parser now handles `## v1.2.3 (2024-01-01)` date format

### Fixed
- Off-by-one in semver comparison when patch segment is missing

## [3.0.0] - 2024-03-01

BREAKING CHANGE: `getReleaseMap()` now returns a `ReleaseMapDigest` object; the previous flat array return is removed.

### Added
- Structured `ReleaseMapDigest` top-level type with `stats` and `generatedAt`
- `formatJson`, `formatMarkdown`, `formatText` formatter exports

### Removed
- Legacy `getReleases()` flat-array export (use `getReleaseMap().releases` instead)

## [2.4.2] - 2024-01-28

### Fixed
- npm loader: skip prerelease versions (`-alpha`, `-rc`) from timeline by default

## [2.4.0] - 2023-12-14

### Added
- GitHub Releases loader with automatic pagination (up to 1000 releases)
- `--token` flag to pass GitHub PAT for higher rate limits

### Changed
- Token estimate now uses `length / 4` heuristic consistently across all sources

## [2.0.0] - 2023-09-01

BREAKING CHANGE: CLI positional changed from `--file` flag to bare positional argument.

### Added
- npm registry loader
- `--since` semver filter

### Removed
- `--file` flag (pass target as positional argument now)

## [1.0.0] - 2023-06-15

### Added
- Initial release: CHANGELOG.md parser, text and JSON formatters
- `--stats` flag for token-savings summary
