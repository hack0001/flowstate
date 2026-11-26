#!/usr/bin/env bash
# Update the recorder to the latest FlowState from GitHub and restart it.
#   sudo bash /opt/flowstate/recorder/deploy/update.sh
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo"; exit 1; fi
cd /opt/flowstate
sudo -u recorder git pull --ff-only
cd recorder
sudo -u recorder npm ci --omit=dev --no-audit --no-fund
cp deploy/flowstate-recorder.service /etc/systemd/system/flowstate-recorder.service
systemctl daemon-reload
systemctl restart flowstate-recorder
sleep 3
systemctl --no-pager --lines=10 status flowstate-recorder || true
