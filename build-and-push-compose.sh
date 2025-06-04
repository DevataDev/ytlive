#!/bin/bash

# Exit on any error
set -e

# Configuration
DOCKER_REGISTRY="your-registry.com"  # Change this to your Docker registry
IMAGE_NAME="windsorf-youtube-live"
TAG="${1:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Docker Compose Build and Push ===${NC}"

# Get version information
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Export variables
export VERSION="$VERSION"
export COMMIT="$COMMIT"
export BUILD_DATE="$BUILD_DATE"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-}"

echo -e "${GREEN}Building with docker-compose...${NC}"
docker compose build --no-cache

# Tag images for registry
echo -e "${BLUE}Tagging images...${NC}"
docker tag "$(docker compose images -q backend)" "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}"
docker tag "$(docker compose images -q backend)" "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest"
docker tag "$(docker compose images -q frontend)" "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}"
docker tag "$(docker compose images -q frontend)" "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest"

# Push images
echo -e "${BLUE}Pushing images...${NC}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest"

echo -e "${GREEN}✓ All images pushed successfully${NC}"