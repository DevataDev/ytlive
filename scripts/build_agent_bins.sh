#!/usr/bin/env bash
# Build static agent binaries for various architectures and place them under
# ops/backend/agent_bins
#
# Usage: ./scripts/build_agent_bins.sh
#
# The script must be executed from anywhere inside the repository. It will:
#   • create the output directory if missing
#   • build for linux/amd64 and linux/arm64 (add more targets if desired)
#   • name the artefacts ops-agent-<os>-<arch>
#   • ensure CGO is disabled so the binary is fully static
#
# Requires: Go 1.20+ on PATH

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
OUT_DIR="$ROOT_DIR/ops/backend/agent_bins"
mkdir -p "$OUT_DIR"

build_target() {
  local os=$1
  local arch=$2
  local out_name="ops-agent-${os}-${arch}"
  echo "==> Building $out_name"
  (cd "$ROOT_DIR/ops/agent" && \
    env CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" \
    go build -trimpath -ldflags "-s -w" \
      -o "$OUT_DIR/$out_name" .)
}

build_target linux amd64
build_target linux arm64

echo "\nAgent binaries stored in $OUT_DIR:";
ls -lh "$OUT_DIR"
