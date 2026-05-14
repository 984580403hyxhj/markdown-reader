# Markdown Reader

A local macOS reader for Markdown, text, CSV, TSV, XLS, and XLSX files. It opens documents in a single native window and renders Markdown with a GitHub-style reading layout.

## Features

- Markdown and TXT preview with outline navigation.
- CSV, TSV, XLS, and XLSX preview with worksheet tabs.
- Open-history sidebar with removable entries.
- Restores the open-history sidebar across app restarts.
- Drag-resizable sidebar and outline panels.
- Preview-style zoom with percentage display and reset.
- One-click full-text copy for Markdown and TXT files.
- Local-only reading: no server, telemetry, or network upload.

## Build The macOS App

```sh
./build-macos-app.sh
```

By default, the app is installed to:

```text
~/Applications/Markdown Reader.app
```

To install somewhere else:

```sh
MARKDOWN_READER_APP_DIR="/Applications/Markdown Reader.app" ./build-macos-app.sh
```

## Set As Default Reader

After building the app, run:

```sh
swift set-default-markdown-app.swift
```

You can also use Finder's "Get Info" panel to set `Markdown Reader.app` as the default app for `.md`, `.txt`, `.csv`, `.xls`, or `.xlsx` files.

## Browser Version

The static reader can also run directly in a browser:

```sh
open index.html
```

The native macOS app is recommended when you want double-click file opening and single-window behavior.

## Dependencies

The spreadsheet parser is vendored in `vendor/xlsx.full.min.js` with its license in `vendor/xlsx.LICENSE`, so the app can run offline.
