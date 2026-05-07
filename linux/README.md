# LinuxCodexBar Linux Tree

The `linux/` tree contains LinuxCodexBar-local surfaces that upstream CodexBar does not have.

## Boundary Rules

- The GNOME extension lives under `linux/gnome-extension/`.
- The extension does not fetch provider data directly.
- The extension shells out to the upstream `codexbar` CLI and renders its JSON output.
- Swift changes outside `linux/` must be intentionally upstreamable and Linux-gated where platform-specific.

## Current Surfaces

- `linux/gnome-extension/`: GNOME Shell extension for the top bar.
