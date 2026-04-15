#!/bin/bash

# Production build flow — chuẩn nhất
# Usage: bash scripts/build-production.sh android|ios

set -e

PLATFORM=${1:-android}

if [ "$PLATFORM" != "android" ] && [ "$PLATFORM" != "ios" ]; then
  echo "❌ Usage: bash scripts/build-production.sh android|ios"
  exit 1
fi

echo "🚀 Production Build Flow for $PLATFORM"
echo ""

# Step 1: Verify .env file
echo "1️⃣  Checking .env file..."
if [ ! -f .env ]; then
  echo "❌ .env not found. Please create .env with EXPO_PUBLIC_* variables"
  exit 1
fi

# Check critical env vars
if ! grep -q "EXPO_PUBLIC_BASE_API_URL" .env; then
  echo "❌ EXPO_PUBLIC_BASE_API_URL not found in .env"
  exit 1
fi

API_URL=$(grep "EXPO_PUBLIC_BASE_API_URL" .env | cut -d'=' -f2)
echo "✅ Using API: $API_URL"
echo ""

# Step 2: Clean build caches
echo "2️⃣  Cleaning build caches..."
npm run prebuild:clean
echo ""

# Step 3: Verify dependencies
echo "3️⃣  Verifying dependencies..."
npm ci --legacy-peer-deps > /dev/null 2>&1 || npm install --legacy-peer-deps > /dev/null 2>&1
echo "✅ Dependencies ready"
echo ""

# Step 4: Type check
echo "4️⃣  Running type check..."
npm run typecheck
echo "✅ Type check passed"
echo ""

# Step 5: Build with EAS
echo "5️⃣  Building $PLATFORM with EAS..."
echo "ℹ️  This will use env vars from .env file"
echo ""

# Suppress Expo Go warning for production builds
export EAS_BUILD_NO_EXPO_GO_WARNING=true

if [ "$PLATFORM" = "android" ]; then
  npm run build:android
else
  npm run build:ios
fi

echo ""
echo "✅ Build complete!"
echo "📱 Check EAS dashboard: https://expo.dev/accounts/trendcoffee/projects"
