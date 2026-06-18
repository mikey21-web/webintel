#!/bin/bash
set -euo pipefail

echo "Building TypeScript SDK..."
cd "$(dirname "$0")"
npm install
npm run build

echo "Publishing to npm..."
npm publish --access public

echo "✅ TypeScript SDK published successfully"
