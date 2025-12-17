#!/usr/bin/env bash
set -euo pipefail

echo "===================================="
echo " SAFE CHECK – BookFast Platform"
echo "===================================="

echo
echo "1️⃣ Environment"
node -v
npm -v
pwd

echo
echo "2️⃣ TypeScript check"
npm run typecheck

echo
echo "3️⃣ Lint"
npm run lint

echo
echo "4️⃣ Dev boot (quick check)"
npm run dev -- --port 3999 &

DEV_PID=$!
sleep 6

if ! kill -0 $DEV_PID 2>/dev/null; then
  echo "❌ Dev server failed to start"
  exit 1
fi

kill $DEV_PID
echo "✅ Dev server boot OK"

echo
echo "===================================="
echo " SAFE CHECK PASSED"
echo "===================================="
