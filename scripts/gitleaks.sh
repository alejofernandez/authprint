#!/usr/bin/env bash
set -euo pipefail

GITLEAKS_VERSION="8.30.1"

# Resolve directories relative to the script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools/gitleaks"
BINARY="$TOOLS_DIR/gitleaks"

if [ ! -f "$BINARY" ]; then
  echo "Gitleaks binary not found. Bootstrapping v${GITLEAKS_VERSION}..." >&2

  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  if [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
      EXPECTED_SHA="b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"
      PLATFORM="darwin_arm64"
    elif [ "$ARCH" = "x86_64" ]; then
      EXPECTED_SHA="dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"
      PLATFORM="darwin_x64"
    else
      echo "Error: Unsupported architecture $ARCH on Darwin." >&2
      exit 1
    fi
  elif [ "$OS" = "linux" ]; then
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
      EXPECTED_SHA="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"
      PLATFORM="linux_arm64"
    elif [ "$ARCH" = "x86_64" ]; then
      EXPECTED_SHA="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
      PLATFORM="linux_x64"
    else
      echo "Error: Unsupported architecture $ARCH on Linux." >&2
      exit 1
    fi
  else
    echo "Error: Unsupported OS $OS." >&2
    exit 1
  fi

  FILENAME="gitleaks_${GITLEAKS_VERSION}_${PLATFORM}.tar.gz"
  URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${FILENAME}"

  # Ensure the tools directory exists
  mkdir -p "$TOOLS_DIR"
  TEMP_FILE="$TOOLS_DIR/gitleaks.tar.gz"

  echo "Downloading Gitleaks from $URL..." >&2
  if ! curl -sSL -o "$TEMP_FILE" "$URL"; then
    echo "Error: Failed to download Gitleaks binary." >&2
    rm -f "$TEMP_FILE"
    exit 1
  fi

  # Determine SHA command
  if command -v sha256sum >/dev/null 2>&1; then
    SHA_CMD="sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    SHA_CMD="shasum -a 256"
  else
    echo "Error: Neither sha256sum nor shasum is available to verify the binary." >&2
    rm -f "$TEMP_FILE"
    exit 1
  fi

  # Verify checksum
  CALC_SHA=$($SHA_CMD "$TEMP_FILE" | awk '{print $1}')
  if [ "$CALC_SHA" != "$EXPECTED_SHA" ]; then
    echo "Error: SHA-256 checksum verification failed for $FILENAME." >&2
    echo "Expected: $EXPECTED_SHA" >&2
    echo "Got:      $CALC_SHA" >&2
    rm -f "$TEMP_FILE"
    exit 1
  fi

  echo "Checksum verified. Unpacking binary..." >&2
  if ! tar -xzf "$TEMP_FILE" -C "$TOOLS_DIR" gitleaks; then
    echo "Error: Failed to extract Gitleaks binary." >&2
    rm -f "$TEMP_FILE"
    exit 1
  fi

  chmod +x "$BINARY"
  rm -f "$TEMP_FILE"
  echo "Gitleaks v${GITLEAKS_VERSION} bootstrapped successfully." >&2
fi

exec "$BINARY" "$@"
