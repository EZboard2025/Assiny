#!/bin/bash
# ============================================================
# Fetch BlackHole 2ch virtual audio driver for macOS
# Downloads the official PKG from GitHub and extracts the .driver bundle
# This runs automatically before build:mac
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
DRIVERS_DIR="$DESKTOP_DIR/drivers"
DRIVER_OUTPUT="$DRIVERS_DIR/BlackHole2ch.driver"
TMP_DIR=$(mktemp -d)

# BlackHole 2ch release info (official download from existential.audio)
BLACKHOLE_VERSION="0.6.1"
BLACKHOLE_PKG_URL="https://existential.audio/downloads/BlackHole2ch-${BLACKHOLE_VERSION}.pkg"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Skip if driver already exists
if [ -d "$DRIVER_OUTPUT" ]; then
  echo "[fetch-blackhole] Driver already exists at $DRIVER_OUTPUT — skipping download."
  exit 0
fi

echo "[fetch-blackhole] Downloading BlackHole 2ch v${BLACKHOLE_VERSION}..."
curl -L -o "$TMP_DIR/BlackHole2ch.pkg" "$BLACKHOLE_PKG_URL"

if [ ! -f "$TMP_DIR/BlackHole2ch.pkg" ]; then
  echo "[fetch-blackhole] ERROR: Failed to download BlackHole PKG."
  exit 1
fi

echo "[fetch-blackhole] Extracting driver from PKG..."
pkgutil --expand "$TMP_DIR/BlackHole2ch.pkg" "$TMP_DIR/expanded"

# Find and extract the Payload
PAYLOAD_DIR="$TMP_DIR/expanded"
# The PKG may have nested structure — find the Payload file
PAYLOAD_FILE=$(find "$PAYLOAD_DIR" -name "Payload" -type f | head -1)

if [ -z "$PAYLOAD_FILE" ]; then
  echo "[fetch-blackhole] ERROR: Payload not found in PKG."
  ls -la "$PAYLOAD_DIR"
  exit 1
fi

echo "[fetch-blackhole] Extracting Payload..."
mkdir -p "$TMP_DIR/payload"
cd "$TMP_DIR/payload"
cat "$PAYLOAD_FILE" | gunzip -c | cpio -id 2>/dev/null || true

# Find the .driver bundle — it could be in Library/Audio/Plug-Ins/HAL/
DRIVER_BUNDLE=$(find "$TMP_DIR/payload" -name "BlackHole2ch.driver" -type d | head -1)

if [ -z "$DRIVER_BUNDLE" ]; then
  # Try alternative name patterns
  DRIVER_BUNDLE=$(find "$TMP_DIR/payload" -name "*.driver" -type d | head -1)
fi

if [ -z "$DRIVER_BUNDLE" ]; then
  echo "[fetch-blackhole] ERROR: .driver bundle not found in extracted payload."
  echo "[fetch-blackhole] Contents of payload:"
  find "$TMP_DIR/payload" -type d | head -20
  exit 1
fi

echo "[fetch-blackhole] Found driver at: $DRIVER_BUNDLE"

# Copy to desktop/drivers/
mkdir -p "$DRIVERS_DIR"
cp -R "$DRIVER_BUNDLE" "$DRIVER_OUTPUT"

echo "[fetch-blackhole] Driver extracted to $DRIVER_OUTPUT"
echo "[fetch-blackhole] Done!"
