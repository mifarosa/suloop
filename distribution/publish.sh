#!/usr/bin/env bash
# Fetches the latest finished builds from EAS and writes the install page into ./site.
# Needs: jq, curl, node (for eas-cli through npx), and .env with DOMAIN and EXPO_TOKEN.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${DOMAIN:?DOMAIN is not set (see .env.example)}"
: "${EXPO_TOKEN:?EXPO_TOKEN is not set (see .env.example)}"
export EXPO_TOKEN
PROFILE="${PROFILE:-preview}"
BUNDLE_ID="${BUNDLE_ID:-com.mifarosa.wasorty}"
# The command that runs eas-cli; a test can put another one here.
EAS_CMD="${EAS_CMD:-npx --yes eas-cli}"

mkdir -p site
# eas build:list needs to run inside the app, which knows its project.
latest() {
  (cd ../app && $EAS_CMD build:list --platform "$1" --status finished \
    --build-profile "$PROFILE" --limit 1 --json --non-interactive) | jq -c '.[0] // empty'
}

fetch() { # platform, output file -> prints the build json, or nothing when there is none
  local build url
  build="$(latest "$1")"
  [ -n "$build" ] || return 0
  url="$(jq -r '.artifacts.buildUrl // empty' <<<"$build")"
  [ -n "$url" ] || return 0
  curl -fsSL "$url" -o "site/$2.tmp"
  mv "site/$2.tmp" "site/$2"
  printf '%s' "$build"
}

android="$(fetch android wasorty.apk)"
ios="$(fetch ios wasorty.ipa)"
[ -n "$android$ios" ] || { echo "No finished '$PROFILE' build found." >&2; exit 1; }

version="$(jq -r '"\(.appVersion // "?") (\(.appBuildVersion // "?"))"' <<<"${ios:-$android}")"
date="$(date -u +%Y-%m-%d)"

if [ -n "$ios" ]; then
  cat > site/manifest.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key><string>software-package</string>
          <key>url</key><string>https://${DOMAIN}/wasorty.ipa</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key><string>${BUNDLE_ID}</string>
        <key>bundle-version</key><string>$(jq -r '.appVersion // "1.0.0"' <<<"$ios")</string>
        <key>kind</key><string>software</string>
        <key>title</key><string>Wasorty</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
PLIST
fi

hide() { [ -n "$1" ] && echo "" || echo "hidden"; }
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__VERSION__|${version}|g" -e "s|__DATE__|${date}|g" \
  -e "s|__IOS_HIDDEN__|$(hide "$ios")|" -e "s|__ANDROID_HIDDEN__|$(hide "$android")|" \
  index.template.html > site/index.html
echo "Published ${version}: android=$([ -n "$android" ] && echo yes || echo no) ios=$([ -n "$ios" ] && echo yes || echo no)"
