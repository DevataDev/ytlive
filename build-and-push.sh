#!/bin/bash

# Exit on any error
set -e

# Configuration
DOCKER_REGISTRY="registry.ppn.net.id"  # Change this to your Docker registry
IMAGE_NAME="ytlive"    # Based on your go.mod module name
TAG="${1:-latest}"                    # Use first argument as tag, default to 'latest'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Docker Build and Push Script ===${NC}"
echo -e "${YELLOW}Registry: ${DOCKER_REGISTRY}${NC}"
echo -e "${YELLOW}Image: ${IMAGE_NAME}${NC}"
echo -e "${YELLOW}Tag: ${TAG}${NC}"
echo ""

# Get version information
echo -e "${BLUE}Getting version information...${NC}"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo -e "${GREEN}Version: ${VERSION}${NC}"
echo -e "${GREEN}Commit: ${COMMIT}${NC}"
echo -e "${GREEN}Build Date: ${BUILD_DATE}${NC}"
echo ""

# Export variables for docker-compose
export VERSION="$VERSION"
export COMMIT="$COMMIT"
export BUILD_DATE="$BUILD_DATE"

# Build backend image
echo -e "${BLUE}Building backend image...${NC}"
docker build \
  --file Dockerfile.backend \
  --build-arg VERSION="$VERSION" \
  --build-arg COMMIT="$COMMIT" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --tag "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}" \
  --tag "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest" \
  .

echo -e "${GREEN}✓ Backend image built successfully${NC}"

# Build frontend image
echo -e "${BLUE}Building frontend image...${NC}"
docker build \
  --file frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-}" \
  --tag "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}" \
  --tag "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest" \
  frontend/

echo -e "${GREEN}✓ Frontend image built successfully${NC}"

# Login to Docker registry (if not already logged in)
echo -e "${BLUE}Checking Docker registry login...${NC}"
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}Please login to Docker registry:${NC}"
    docker login "$DOCKER_REGISTRY"
fi

# Push backend image
echo -e "${BLUE}Pushing backend image...${NC}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest"
echo -e "${GREEN}✓ Backend image pushed successfully${NC}"

# Push frontend image
echo -e "${BLUE}Pushing frontend image...${NC}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}"
docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest"
echo -e "${GREEN}✓ Frontend image pushed successfully${NC}"

# Summary
echo ""
echo -e "${GREEN}=== Build and Push Complete ===${NC}"
echo -e "${GREEN}Backend Image: ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}${NC}"
echo -e "${GREEN}Frontend Image: ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}${NC}"
echo ""
echo -e "${YELLOW}To pull and run these images:${NC}"
echo "docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${TAG}"
echo "docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${TAG}"