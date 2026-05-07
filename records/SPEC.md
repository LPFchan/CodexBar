# LinuxCodexBar Spec

## Project

- Project: LinuxCodexBar
- Canonical repo: `LPFchan/LinuxCodexBar`
- Upstream repo: `steipete/CodexBar`
- Last updated: 2026-05-08

## Project Thesis

LinuxCodexBar is a GNOME Shell extension fork of CodexBar. It brings CodexBar-style AI-provider usage visibility to the GNOME top bar while keeping provider data acquisition delegated to the upstream `codexbar` CLI binary.

## Upstream Boundary

Upstream CodexBar is a macOS menu bar app written in Swift. It supports roughly 36 AI providers and includes a CLI product named `CodexBarCLI`, exposed as `codexbar`.

LinuxCodexBar does not implement a custom usage backend. The GNOME extension shells out to the upstream `codexbar` CLI and renders the JSON it returns.

## Invariants

- The `linux/` tree contains all LinuxCodexBar-local additions.
- The GNOME Shell extension uses `codexbar` as its sole data backend.
- No upstream Swift source is modified unless the change is intentionally upstreamable.
- Linux-only Swift behavior must be gated behind `#if os(Linux)` unless a broader change is explicitly upstreamable.

## Main Surfaces

- `Sources/`: upstream Swift sources, modified only for upstreamable Linux support.
- `linux/gnome-extension/`: GNOME Shell extension UI, settings, schemas, and styling.
- `records/`: project truth, plans, status, research, and upstream-intake notes.
