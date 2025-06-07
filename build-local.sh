#!/bin/bash

# Get version information
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Export variables
export VERSION="$VERSION"
export COMMIT="$COMMIT"
export BUILD_DATE="$BUILD_DATE"

echo "Building with:"
echo "  Version: $VERSION"
echo "  Commit: $COMMIT"
echo "  Date: $BUILD_DATE"

# Build with docker-compose
docker compose build --no-cache backend