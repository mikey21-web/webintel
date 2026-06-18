#!/bin/bash
set -euo pipefail

echo "Tagging Go module..."
cd "$(dirname "$0")"
VERSION="${1:-v0.1.0}"
git tag "go-sdk/$VERSION"
git push origin "go-sdk/$VERSION"

echo "✅ Go SDK tagged as go-sdk/$VERSION"
echo "   Users: go get github.com/webintel/webintel-go@$VERSION"
