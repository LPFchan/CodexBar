# Known Local Overrides

This register records intentional downstream divergences so they do not have to be rediscovered during upstream intake.

## Current Entries

- Area: Linux browser cookie reading
- Local surface: `Sources/CodexBarCore/`
- Upstream surface: `Sources/CodexBarCore/`
- Why the fork diverged: Linux needs browser cookie-reading additions for `codexbar usage --source web`.
- Collision rule to apply during intake: Accept upstream changes to the same files first, then re-apply the Linux gate behind `#if os(Linux)`.
- Revisit trigger: Upstream adds native Linux web-source support or changes the browser cookie access contract.
- Related decision record: none

- Area: GNOME Shell extension
- Local surface: `linux/gnome-extension/`
- Upstream surface: none
- Why the fork diverged: Upstream CodexBar is a macOS menu bar app and has no GNOME Shell extension equivalent.
- Collision rule to apply during intake: The `linux/` tree never conflicts with upstream Swift source. Preserve it independently during upstream rebases.
- Revisit trigger: Upstream adds an official Linux desktop integration.
- Related decision record: none
