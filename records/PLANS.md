# LinuxCodexBar Plans

## Planning Rules

- Only accepted future direction belongs here.
- Current operational truth belongs in `records/STATUS.md`.
- Durable product and boundary truth belongs in `records/SPEC.md`.

## Sequencing

### Near Term

- Initiative: Complete the two-branch implementation from the 2026-05-08 prompt.
- Outcome: `linux/web-source` adds upstreamable Linux web-source support, and `linux/gnome-extension` adds the GNOME Shell extension that renders `codexbar` CLI output.
- Dependencies: Linux browser cookie reader, Claude and Codex web fetcher integration, pengstem GNOME extension adaptation.

### Mid Term

- Initiative: Install script.
- Outcome: Provide a repeatable Linux install path for the GNOME extension and CLI dependency.
- Dependencies: Stable extension layout and confirmed CLI packaging path.

- Initiative: Source-mode preferences in the extension.
- Outcome: Allow users to choose CLI source mode without editing extension code.
- Dependencies: Stable upstream CLI source options.

- Initiative: Waybar and i3blocks output mode.
- Outcome: Reuse the same `codexbar` CLI backend for non-GNOME Linux status bars.
- Dependencies: Stable translation layer and provider metadata model.
