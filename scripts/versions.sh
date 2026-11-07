#!/usr/bin/env bash
# What is behind: packages, runtimes and pinned versions in this repo. Reports only; upgrading is a separate,
# deliberate change (a major version on its own branch, after reading its changelog).
#   scripts/versions.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

step() { printf '\n== %s\n' "$1"; }

step "Python packages (direct dependencies with a newer release)"
uv tree --outdated --depth 1 2>/dev/null | grep -E 'latest: ' || echo "all current"

step "npm packages"
(cd frontend && npm outdated) && echo "all current"

# latest_cycle PRODUCT [lts]: the newest release line on endoflife.date (python, nodejs); with lts, the
# newest line whose LTS has started
latest_cycle() {
  curl -fsS "https://endoflife.date/api/$1.json" 2>/dev/null | python3 -c '
import datetime, json, sys
lts = len(sys.argv) > 1
today = datetime.date.today().isoformat()
for c in json.load(sys.stdin):
    if not lts or (isinstance(c.get("lts"), str) and c["lts"] <= today):
        print(c["cycle"])
        break' ${2:+lts} 2>/dev/null || echo "?"
}

step "Runtimes (pinned here vs newest release line)"
printf '%-12s %-28s %s\n' "python" "$(cat .python-version)" "$(latest_cycle python)"
printf '%-12s %-28s %s\n' "node" "$(node --version 2>/dev/null || echo '?') (installed)" "$(latest_cycle nodejs lts) (newest LTS)"
