#!/bin/bash

# Test script for sales mode functionality
echo "Testing Sales Mode Functionality"
echo "================================"

# Check if salesMode.ts exists
if [ -f "./src/config/salesMode.ts" ]; then
  echo "✅ salesMode.ts configuration file exists"
else
  echo "❌ salesMode.ts configuration file is missing"
fi

# Check if Header.tsx has sales mode implementation
if grep -q "isSalesMode()" "./src/components/layout/Header.tsx"; then
  echo "✅ Header.tsx implements sales mode checks"
else
  echo "❌ Header.tsx is missing sales mode implementation"
fi

# Check if users page has sales mode implementation
if grep -q "isSalesMode()" "./src/app/users/page.tsx"; then
  echo "✅ Users page implements sales mode checks"
else
  echo "❌ Users page is missing sales mode implementation"
fi

# Check if Dockerfile has NEXT_PUBLIC_SALES_MODE
if grep -q "NEXT_PUBLIC_SALES_MODE" "./Dockerfile"; then
  echo "✅ Dockerfile correctly sets NEXT_PUBLIC_SALES_MODE"
else
  echo "❌ Dockerfile is missing NEXT_PUBLIC_SALES_MODE configuration"
fi

echo ""
echo "To build with sales mode enabled:"
echo "docker build --build-arg SALES_MODE=true -t yuklive-frontend:sales-mode ."
echo ""
echo "To build with sales mode disabled (default):"
echo "docker build -t yuklive-frontend:standard ."
echo ""
