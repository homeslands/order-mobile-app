#!/bin/bash
# Hook: post-edit-track
# Runs after every Edit or Write tool call.
# 1. Tracks edited TS/TSX file paths to a temp file (for stop-typecheck).
# 2. Warns if the file contains console.log statements.

TEMP_FILE="/tmp/.claude-ts-edited-$(basename "$PWD")"

input=$(cat)
file=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# Skip if no file path extracted
if [ -z "$file" ]; then
  exit 0
fi

# Only track TS/TSX files
if ! echo "$file" | grep -qE '\.(ts|tsx)$'; then
  exit 0
fi

# Skip if file doesn't exist
if [ ! -f "$file" ]; then
  exit 0
fi

# Accumulate file path for stop-typecheck hook
echo "$file" >> "$TEMP_FILE"

# Warn about console.log
count=$(grep -c 'console\.log' "$file" 2>/dev/null || echo 0)
if [ "$count" -gt 0 ]; then
  echo "Warning: $count console.log statement(s) in $(basename "$file") — remove before committing."
fi

exit 0
