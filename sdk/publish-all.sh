#!/bin/bash
set -euo pipefail

echo "📦 Publishing all WebIntel SDKs..."
echo ""

echo "--- TypeScript SDK ---"
bash "$(dirname "$0")/typescript/publish.sh"
echo ""

echo "--- Python SDK ---"
bash "$(dirname "$0")/python/publish.sh"
echo ""

echo "--- Ruby SDK ---"
bash "$(dirname "$0")/ruby/publish.sh"
echo ""

echo "--- Go SDK ---"
bash "$(dirname "$0")/go/publish.sh"
echo ""

echo "✅ All SDKs published!"
