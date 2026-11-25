#!/usr/bin/env bash
# Import Betfair's free historical prices (racing, football, tennis, golf) into FlowState.
#
#   sudo bash /opt/flowstate/recorder/deploy/history.sh 2025-11-01 2026-11-17 racing,football,tennis,golf
#
# The sports default to racing. First add the dates for each sport to your Betfair account (free):
#   historicdata.betfair.com → the sport (Soccer for football) → Basic plan → the dates → Buy now (£0)
#
# Runs in the background (you can close the terminal). Days already imported
# are skipped, so it is safe to run again. Add --force at the end to
# re-import days that were done before, or --only=CORRECT_SCORE to add just that
# market to football days already imported.
#   Watch it:  sudo journalctl -u flowstate-history -f
#   Stop it:   sudo systemctl stop flowstate-history
#   See what's on your account:  sudo bash /opt/flowstate/recorder/deploy/history.sh check
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo"; exit 1; fi
if [ "${1:-}" = "check" ]; then
  cd /opt/flowstate/recorder
  exec systemd-run --quiet --wait --pipe --collect --uid=recorder --gid=recorder \
    -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory="$PWD" \
    -E SPOOL_DIR=/var/lib/flowstate-recorder ./node_modules/.bin/tsx src/history.ts check
fi
FROM="${1:-$(date -u -d '-365 days' +%F)}"
TO="${2:-$(date -u -d '-4 days' +%F)}"
SPORTS="${3:-racing}"
shift $(( $# < 3 ? $# : 3 ))
FLAGS="$*"            # e.g. --force, or --only=CORRECT_SCORE
if [[ "$SPORTS" == --* ]]; then FLAGS="$SPORTS $FLAGS"; SPORTS=racing; fi
if systemctl is-active --quiet flowstate-history; then
  echo "An import is already running. Watch it with: sudo journalctl -u flowstate-history -f"
  exit 0
fi
systemctl reset-failed flowstate-history 2>/dev/null || true
cd /opt/flowstate/recorder
systemd-run --unit flowstate-history --uid=recorder --gid=recorder \
  -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory="$PWD" \
  -E SPOOL_DIR=/var/lib/flowstate-recorder -p MemoryMax=400M -p Nice=10 \
  ./node_modules/.bin/tsx src/history.ts "$FROM" "$TO" "$SPORTS" $FLAGS
echo
echo "Import started: $SPORTS, $FROM to $TO. It runs in the background."
echo "Watch it:  sudo journalctl -u flowstate-history -f    (Ctrl+C stops watching, not the import)"
