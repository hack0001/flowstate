#!/usr/bin/env bash
# Run the scout: tests betting ideas on the imported Betfair history and saves a
# report you can read in FlowState (Betfair → Insights) and in this terminal.
#
#   sudo bash /opt/flowstate/recorder/deploy/study.sh            run it now (a few minutes)
#   sudo bash /opt/flowstate/recorder/deploy/study.sh weekly     also run it every Monday at 6am
#   sudo bash /opt/flowstate/recorder/deploy/study.sh off        stop the weekly run
#   sudo SCOUT_ALPHA=0.01 bash /opt/flowstate/recorder/deploy/study.sh   use a different p-value threshold (default 0.05)
#
# Reads only; places no bets.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo"; exit 1; fi
cd /opt/flowstate/recorder
case "${1:-}" in
  weekly)
    systemctl stop flowstate-scout.timer 2>/dev/null || true
    systemctl reset-failed flowstate-scout.timer flowstate-scout.service 2>/dev/null || true
    systemd-run --unit flowstate-scout --on-calendar 'Mon *-*-* 06:00:00' --timer-property=Persistent=true \
      --uid=recorder --gid=recorder -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory="$PWD" \
      -p MemoryMax=900M -p Nice=10 -E NODE_OPTIONS=--max-old-space-size=700 -E SCOUT_ALPHA="${SCOUT_ALPHA:-0.05}" ./node_modules/.bin/tsx src/study.ts
    echo "The scout will run every Monday at 6am (UTC). Stop it with: sudo bash $0 off"
    echo "Note: this lasts until the server restarts; run this command again after a reboot."
    exit 0 ;;
  off)
    systemctl stop flowstate-scout.timer 2>/dev/null || true
    echo "Weekly scout stopped."
    exit 0 ;;
esac
exec systemd-run --quiet --wait --pipe --collect --uid=recorder --gid=recorder \
  -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory="$PWD" -p MemoryMax=900M -E NODE_OPTIONS=--max-old-space-size=700 -E SCOUT_ALPHA="${SCOUT_ALPHA:-0.05}" \
  ./node_modules/.bin/tsx src/study.ts
