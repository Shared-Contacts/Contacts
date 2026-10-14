#!/usr/bin/env bash
# Every check, in one go. Run it from anywhere:  bash tests/run.sh
#
# Builds the test pages from the real app, checks the syntax of both
# inline scripts, then runs every suite plus the two sweeps.
set -u
cd "$(dirname "$0")"

python3 build.py || exit 1

echo
for f in app.js jotapp.js; do
  if node --check "$f"; then echo "  syntax ok   $f"
  else echo "  SYNTAX ERROR in $f"; exit 1; fi
done

echo
bad=0
for f in *.test.js; do
  name="${f%.test.js}"
  out=$(node "$f" 2>&1)
  line=$(echo "$out" | grep -E "passed, " | tail -1)
  if [ -z "$line" ]; then
    printf '%-10s CRASHED\n' "$name"
    echo "$out" | tail -5
    bad=1
  else
    printf '%-10s %s\n' "$name" "$line"
    echo "$line" | grep -q " 0 failed" || bad=1
  fi
done

echo
node regress.js 2>&1 | tail -2
node fit.js 2>&1 | tail -2

echo
if [ "$bad" = 0 ]; then echo "All green."; else echo "SOMETHING FAILED - look above."; fi
exit $bad
