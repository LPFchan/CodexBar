# CodexBar GNOME Extension

This extension shows AI-provider usage in the GNOME top bar.

## Dependency

Install the upstream `codexbar` CLI first, either from the project Homebrew package or a release tarball. The extension defaults to resolving `codexbar` from `$PATH`.

## Install

```bash
glib-compile-schemas linux/gnome-extension/schemas/
mkdir -p ~/.local/share/gnome-shell/extensions/codexbar-gnome
cp -R linux/gnome-extension/* ~/.local/share/gnome-shell/extensions/codexbar-gnome/
gnome-extensions enable codexbar-gnome
```

Restart GNOME Shell or log out and back in if the extension is not picked up immediately.

## Backend Command

The extension runs:

```bash
codexbar usage --format json --source auto --provider all
```

Provider data, authentication, cookies, OAuth, and CLI fallback behavior all belong to `codexbar`; the extension only translates and renders the CLI JSON.
