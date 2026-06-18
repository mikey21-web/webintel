#!/bin/bash
set -euo pipefail

echo "Building Python SDK..."
cd "$(dirname "$0")"
python -m pip install --upgrade build twine
python -m build

echo "Publishing to PyPI..."
python -m twine upload dist/*

echo "✅ Python SDK published successfully"
