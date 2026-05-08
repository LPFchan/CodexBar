# CodexBar GNOME Extension

This directory is a GNOME Shell port of the upstream CodexBar macOS menu bar UI.

The extension does not implement a data backend. It runs:

```bash
codexbar usage --format json --source auto --provider all
```

The returned provider array is translated into the same menu-card model used by upstream
`MenuCardView.swift`: header, metric rows, credits, extra usage, cost, facts, switcher,
panel display text, and menu actions.

## Install for Local Testing

```bash
cd ~/Documents/LinuxCodexBar
swift build --product CodexBarCLI

EXT="$HOME/.local/share/gnome-shell/extensions/codexbar-gnome"
rm -rf "$EXT"
mkdir -p "$EXT"
cp -a linux/gnome-extension/. "$EXT"/
glib-compile-schemas "$EXT/schemas"

gsettings --schemadir "$EXT/schemas" set \
  org.gnome.shell.extensions.codexbar-gnome backend-path \
  "$HOME/Documents/LinuxCodexBar/.build/debug/CodexBarCLI"

gnome-extensions enable codexbar-gnome
```

On Wayland, log out and back in after first install so GNOME Shell discovers the new UUID.

## Boundary Rules

All provider authentication, cookie reading, OAuth fallback, CLI fallback, and API fetching
belong to `codexbar`. The GNOME extension only renders CLI JSON and stores display preferences.
