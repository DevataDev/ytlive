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

# Check if middleware has sales mode implementation for route blocking
if grep -q "isSalesMode()" "./src/middleware.ts"; then
  echo "✅ Middleware implements sales mode route blocking"
else
  echo "❌ Middleware is missing sales mode route blocking"
fi

# Check if custom 404 page exists
if [ -f "./src/app/not-found.tsx" ]; then
  echo "✅ Custom 404 page exists for restricted routes"
else
  echo "❌ Custom 404 page is missing"
fi

# Check if Dockerfile has NEXT_PUBLIC_SALES_MODE
if grep -q "NEXT_PUBLIC_SALES_MODE" "./Dockerfile"; then
  echo "✅ Dockerfile correctly sets NEXT_PUBLIC_SALES_MODE"
else
  echo "❌ Dockerfile is missing NEXT_PUBLIC_SALES_MODE configuration"
fi

echo ""
echo "Sales Mode Implementation Summary:"
echo "--------------------------------"
echo "1. UI Elements: Mirror, TikTok, and Monitor menus are hidden in the navigation"
echo "2. User Management: Default admin user is filtered out from the user list"
echo "3. Route Protection: Direct access to restricted routes shows 404 page"
echo ""
echo "To build with sales mode enabled:"
echo "docker build --build-arg SALES_MODE=true -t yuklive-frontend:sales-mode ."
echo ""
echo "To build with sales mode disabled (default):"
echo "docker build -t yuklive-frontend:standard ."
echo ""
