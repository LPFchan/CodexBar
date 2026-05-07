# LinuxCodexBar Status

## Snapshot

- Last updated: 2026-05-08
- Overall posture: `in development`
- Current focus: Phase 1 Linux web-source support, then Phase 2 GNOME Shell extension
- Highest-priority blocker: Linux browser cookie access for upstream web-source fetchers
- Next operator decision needed: none

## Current State Summary

LinuxCodexBar is being converted from an upstream Swift-only CodexBar fork into a Linux-focused repo with a GNOME Shell extension. The extension will not fetch provider data directly. It will invoke the upstream `codexbar` CLI and translate the CLI JSON output into the GNOME UI payload shape.

## Active Phases

### Phase 1: Linux Web Source

- Goal: Add Linux `--source web` support to the upstream CLI.
- Status: `in progress`
- Why this matters now: The GNOME extension will use `codexbar usage --source auto`, which needs Linux web-source fallback to be viable.
- Current work: Implement Linux cookie reading and hook it into Claude and Codex web fetchers.
- Exit criteria: `swift build --product CodexBarCLI`, targeted Linux cookie-reader tests, and web-source CLI commands complete with JSON output or clear no-cookie errors.

### Phase 2: GNOME Shell Extension

- Goal: Add a GNOME Shell extension under `linux/gnome-extension/`.
- Status: `not started`
- Why this matters now: This is the user-facing LinuxCodexBar surface.
- Current work: Starts after Phase 1 branch is complete.
- Exit criteria: JavaScript, JSON, XML, schema, and CSS verification pass.

## Active Risks

- Linux browser cookie encryption differs by browser, profile, and password-store mode.
- Web-source provider endpoints may change upstream and should remain centralized in upstream fetcher logic where possible.
