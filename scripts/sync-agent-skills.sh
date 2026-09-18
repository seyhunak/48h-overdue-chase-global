#!/usr/bin/env bash
# Keep every agent's skills dir linked to the canonical .agents/skills pack.
# Run after: npx skills add ... / npx skills update ...
# Speckit/.specify is retired — this script is the only skill wiring.
set -euo pipefail
cd "$(dirname "$0")/.."

declare -a DIRS=( ".claude/skills" ".opencode/skills" ".kilo-code/skills" ".cline/skills" ".cursor/skills" ".github/skills" ".roo-code/skills" )

for d in "${DIRS[@]}"; do
  mkdir -p "$d"
  for s in .agents/skills/*/; do
    n=$(basename "$s")
    if [ ! -e "$d/$n" ]; then
      ln -sfn "../../.agents/skills/$n" "$d/$n"
      echo "linked $d/$n"
    fi
  done
done

echo "--- counts ---"
for d in .agents/skills "${DIRS[@]}"; do
  echo "$d: $(ls "$d" | wc -l | tr -d ' ')"
done
