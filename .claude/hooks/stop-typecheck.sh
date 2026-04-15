#!/bin/bash
# Hook: stop-typecheck
# Runs once when Claude finishes a response.
# If any TS/TSX files were edited this session, runs `npm run typecheck`.
# Uses the temp file written by post-edit-track.sh.

TEMP_FILE="/tmp/.claude-ts-edited-$(basename "$PWD")"

# Nothing to check if no TS files were edited
if [ ! -f "$TEMP_FILE" ]; then
  exit 0
fi

# Get unique edited files
edited_files=$(sort -u "$TEMP_FILE")
file_count=$(echo "$edited_files" | wc -l | tr -d ' ')

echo "Running TypeScript check ($file_count file(s) edited this session)..."

# Run full typecheck (tsc --noEmit catches cross-file errors too)
output=$(npm run typecheck 2>&1)
exit_code=$?

# Clean up temp file for next session
rm -f "$TEMP_FILE"

if [ $exit_code -ne 0 ]; then
  echo "TypeScript errors found:"
  # Show only error lines, limit to 25
  echo "$output" | grep -E 'error TS|\.tsx?.*error' | head -25
  echo ""
  echo "Run 'npm run typecheck' for full output."
  exit 1
else
  echo "TypeScript OK"
fi

exit 0
