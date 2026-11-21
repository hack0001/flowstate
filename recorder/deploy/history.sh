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
# re-import days that were done before.
#   Watch it:  sudo journalctl -u flowstate-history -f
#   Stop it:   sudo systemctl stop flowstate-history
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo"; exit 1; fi
FROM="${1:-$(date -u -d '-365 days' +%F)}"
TO="${2:-$(date -u -d '-4 days' +%F)}"
SPORTS="${3:-racing}"
FLAG="${4:-}"
if [ "$SPORTS" = "--force" ]; then SPORTS=racing; FLAG=--force; fi
if systemctl is-active --quiet flowstate-history; then
  echo "An import is already running. Watch it with: sudo journalctl -u flowstate-history -f"
  exit 0
fi
systemctl reset-failed flowstate-history 2>/dev/null || true
cd /opt/flowstate/recorder
systemd-run --unit flowstate-history --uid=recorder --gid=recorder \
  -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory="$PWD" \
  -E SPOOL_DIR=/var/lib/flowstate-recorder -p MemoryMax=400M -p Nice=10 \
  ./node_modules/.bin/tsx src/history.ts "$FROM" "$TO" "$SPORTS" $FLAG
echo
echo "Import started: $SPORTS, $FROM to $TO. It runs in the background."
echo "Watch it:  sudo journalctl -u flowstate-history -f    (Ctrl+C stops watching, not the import)"
