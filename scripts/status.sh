#!/usr/bin/env bash
set -euo pipefail

echo "== SYSTEM =="
node -v
npm -v
pwd

echo
echo "== GIT =="
git status -sb || true
git rev-parse --abbrev-ref HEAD || true

echo
echo "== PROJECT =="
test -f package.json && cat package.json | head -n 40
test -f next.config.ts && echo "next.config.ts: OK" || echo "next.config.ts: MISSING"

echo
echo "== QUICK SEARCH (hotspots) =="
ls -la app 2>/dev/null | head -n 20 || true
ls -la src 2>/dev/null | head -n 20 || true
