#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${MARKDOWN_READER_APP_DIR:-"$HOME/Applications/Markdown Reader.app"}"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
READER_RESOURCES="$RESOURCES_DIR/reader"
EXECUTABLE="$MACOS_DIR/Markdown Reader"
PLIST="$CONTENTS_DIR/Info.plist"
ICON_FILE="$RESOURCES_DIR/MarkdownReader.icns"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

if [[ -z "$APP_DIR" || "$(basename "$APP_DIR")" != "Markdown Reader.app" ]]; then
  echo "Refusing to remove unexpected app path: $APP_DIR" >&2
  exit 1
fi

/usr/bin/osascript -e 'tell application id "com.stevenxue.markdown-reader" to quit' >/dev/null 2>&1 || true
/bin/sleep 0.2

/bin/rm -rf "$APP_DIR"
/bin/mkdir -p "$(dirname "$APP_DIR")"
/bin/mkdir -p "$MACOS_DIR" "$READER_RESOURCES/src" "$READER_RESOURCES/vendor"

/usr/bin/swiftc \
  -O \
  -framework AppKit \
  -framework WebKit \
  -framework UniformTypeIdentifiers \
  "$ROOT_DIR/MarkdownReaderApp.swift" \
  -o "$EXECUTABLE"

/bin/chmod +x "$EXECUTABLE"
/bin/cp "$ROOT_DIR/index.html" "$READER_RESOURCES/index.html"
/bin/cp "$ROOT_DIR/src/main.js" "$READER_RESOURCES/src/main.js"
/bin/cp "$ROOT_DIR/src/styles.css" "$READER_RESOURCES/src/styles.css"
/bin/cp "$ROOT_DIR/vendor/xlsx.full.min.js" "$READER_RESOURCES/vendor/xlsx.full.min.js"
/bin/cp "$ROOT_DIR/vendor/xlsx.LICENSE" "$READER_RESOURCES/vendor/xlsx.LICENSE"
/usr/bin/swift "$ROOT_DIR/generate-app-icon.swift" "$ICON_FILE"
/bin/cp "$RESOURCES_DIR/MarkdownReader-1024.png" "$READER_RESOURCES/src/app-icon.png"

/bin/cat > "$PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>Markdown Reader</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>md</string>
        <string>markdown</string>
        <string>mdown</string>
        <string>mkdn</string>
        <string>txt</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>Markdown or Text Document</string>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>LSHandlerRank</key>
      <string>Owner</string>
      <key>LSItemContentTypes</key>
      <array>
        <string>net.daringfireball.markdown</string>
        <string>public.markdown</string>
        <string>public.plain-text</string>
      </array>
    </dict>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>csv</string>
        <string>tsv</string>
        <string>xls</string>
        <string>xlsx</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>Spreadsheet Document</string>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>LSHandlerRank</key>
      <string>Owner</string>
      <key>LSItemContentTypes</key>
      <array>
        <string>public.comma-separated-values-text</string>
        <string>public.tab-separated-values-text</string>
        <string>com.microsoft.excel.xls</string>
        <string>org.openxmlformats.spreadsheetml.sheet</string>
      </array>
    </dict>
  </array>
  <key>CFBundleExecutable</key>
  <string>Markdown Reader</string>
  <key>CFBundleIconFile</key>
  <string>MarkdownReader</string>
  <key>CFBundleIdentifier</key>
  <string>com.stevenxue.markdown-reader</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Markdown Reader</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSMultipleInstancesProhibited</key>
  <true/>
  <key>NSQuitAlwaysKeepsWindows</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticTermination</key>
  <false/>
</dict>
</plist>
PLIST

/usr/bin/plutil -lint "$PLIST" >/dev/null
/usr/bin/codesign --force --sign - "$APP_DIR" >/dev/null
/usr/bin/touch "$APP_DIR"
"$LSREGISTER" -f "$APP_DIR"

echo "$APP_DIR"
