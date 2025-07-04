#!/bin/bash

# Exit on any error
set -e

# Configuration
DOCKER_REGISTRY="registry.ppn.net.id"  # Change this to your Docker registry
PROJECT_NAME="ytlive-sales"    # Based on your go.mod module name
IMAGE_NAME="ytlivesales"
TAG="sales"  # Fixed tag for sales mode deployment

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
# Force sales mode to be enabled
export SALES_MODE="true"
export NEXT_PUBLIC_SALES_MODE="true"

echo -e "${GREEN}Sales mode enabled${NC}"
echo -e "${GREEN}Tag: ${TAG}${NC}"

echo -e "${GREEN}Building with docker-compose...${NC}"
docker compose build --no-cache

# Tag images for registry
echo -e "${BLUE}Tagging images...${NC}"
docker tag "$(docker compose images -q backend)" "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-backend:${TAG}"
docker tag "$(docker compose images -q backend)" "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-backend:latest"
docker tag "$(docker compose images -q frontend)" "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-frontend:${TAG}"
docker tag "$(docker compose images -q frontend)" "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-frontend:latest"

# Push images
echo -e "${BLUE}Pushing images...${NC}"
docker push "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-backend:${TAG}"
docker push "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-backend:latest"
docker push "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-frontend:${TAG}"
docker push "${DOCKER_REGISTRY}/${PROJECT_NAME}/${IMAGE_NAME}-frontend:latest"

echo -e "${GREEN}✓ All images pushed successfully${NC}"