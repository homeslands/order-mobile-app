#!/bin/bash
# Hook: pre-bash-commit-quality
# Before any `git commit`, checks that staged TS/TSX/JS/JSX files
# do not contain console.log statements.

input=$(cat)
command=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# Only apply to git commit commands
if ! echo "$command" | grep -qE 'git\s+commit'; then
  exit 0
fi

# Get staged TS/JS files
staged_files=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$')

if [ -z "$staged_files" ]; then
  exit 0
fi

# Check for console.log in staged files
found=$(echo "$staged_files" | xargs grep -l 'console\.log' 2>/dev/null)

if [ -n "$found" ]; then
  echo "Blocked: console.log found in staged files:"
  echo "$found" | sed 's/^/  - /'
  echo ""
  echo "Remove all console.log statements before committing."
  exit 2
fi

exit 0
