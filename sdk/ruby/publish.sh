#!/bin/bash
set -euo pipefail

echo "Building Ruby SDK..."
cd "$(dirname "$0")"
gem build webintel.gemspec

echo "Publishing to RubyGems..."
gem push webintel-*.gem

echo "✅ Ruby SDK published successfully"
