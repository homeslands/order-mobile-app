#!/bin/bash
# Hook: pre-bash-block-no-verify
# Blocks any Bash command containing --no-verify.
# Reason: CLAUDE.md explicitly forbids skipping pre-commit hooks.

input=$(cat)
command=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

if echo "$command" | grep -q -- '--no-verify'; then
  echo "Blocked: --no-verify is forbidden in this project."
  echo "Fix the underlying pre-commit hook issue instead of bypassing it."
  exit 2
fi

exit 0
