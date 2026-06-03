#!/bin/bash
source venv/bin/activate
playwright install chromium
uvicorn main:app --host 0.0.0.0 --port 8765 --workers 2
