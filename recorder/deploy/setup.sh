#!/usr/bin/env bash
# One-time setup of the FlowState Betfair recorder on a fresh Ubuntu 24.04 server.
#
#   curl -fsSL https://raw.githubusercontent.com/hack0001/flowstate/main/recorder/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh
#
# Installs Node.js, downloads FlowState into /opt/flowstate, asks for your five
# settings (stored readable only by root and the recorder), runs the setup
# check, and starts the recorder as a service that restarts itself.
set -euo pipefail

REPO=https://github.com/hack0001/flowstate.git
DIR=/opt/flowstate
ENVF=/etc/flowstate-recorder.env

if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo: sudo bash setup.sh"; exit 1; fi

echo "== Updates and basics"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates unattended-upgrades
# keep security updates installing automatically
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "== Swap (helps small servers during installs)"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

echo "== A locked-down user for the recorder"
id recorder >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/recorder-home --shell /usr/sbin/nologin recorder

echo "== Download FlowState"
if [ -d "$DIR/.git" ]; then
  sudo -u recorder git -C "$DIR" pull --ff-only
else
  mkdir -p "$DIR" && chown recorder:recorder "$DIR"
  sudo -u recorder git clone --depth 50 "$REPO" "$DIR"
fi
cd "$DIR/recorder"
sudo -u recorder npm ci --omit=dev --no-audit --no-fund

echo "== Your settings"
if [ ! -f "$ENVF" ]; then
  echo "These are saved to $ENVF, readable only by root and the recorder."
  read -rp  "Betfair username: " BF_USERNAME
  read -rsp "Betfair password (hidden): " BF_PASSWORD; echo
  read -rp  "Betfair app key (the 1.0-DELAY one): " BF_APP_KEY
  read -rp  "Supabase project URL (https://xxxx.supabase.co): " SUPABASE_URL
  read -rsp "Supabase secret / service_role key (hidden): " SUPABASE_SERVICE_ROLE_KEY; echo
  for v in "$BF_USERNAME" "$BF_PASSWORD" "$BF_APP_KEY" "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY"; do
    if [ -z "$v" ]; then echo "A value was empty. Run the script again."; exit 1; fi
    case "$v" in *"'"*) echo "A value contains a ' (single quote), which the settings file can't hold. If it's your Betfair password, change it on betfair.com first."; exit 1;; esac
  done
  umask 077
  {
    printf "BF_USERNAME='%s'\n" "$BF_USERNAME"
    printf "BF_PASSWORD='%s'\n" "$BF_PASSWORD"
    printf "BF_APP_KEY='%s'\n" "$BF_APP_KEY"
    printf "SUPABASE_URL='%s'\n" "${SUPABASE_URL%/}"
    printf "SUPABASE_SERVICE_ROLE_KEY='%s'\n" "$SUPABASE_SERVICE_ROLE_KEY"
  } > "$ENVF"
  chown root:recorder "$ENVF"; chmod 640 "$ENVF"
else
  echo "Keeping the existing $ENVF (edit it with: sudo nano $ENVF)"
fi

echo "== Setup check"
set +e
# Runs with exactly the settings the service will use.
systemd-run --quiet --wait --pipe --collect --uid=recorder --gid=recorder \
  -p EnvironmentFile="$ENVF" -p WorkingDirectory="$DIR/recorder" \
  "$DIR/recorder/node_modules/.bin/tsx" src/check.ts
CHECK=$?
set -e

echo "== Service"
cp "$DIR/recorder/deploy/flowstate-recorder.service" /etc/systemd/system/flowstate-recorder.service
systemctl daemon-reload
if [ $CHECK -eq 0 ]; then
  systemctl enable --now flowstate-recorder
  sleep 3
  systemctl --no-pager --lines=10 status flowstate-recorder || true
  echo
  echo "Done. The recorder is running and will start again after any crash or reboot."
  echo "Watch it:  sudo journalctl -u flowstate-recorder -f"
else
  echo "The setup check found a problem (above). Fix it, then run: sudo bash $DIR/recorder/deploy/setup.sh"
fi
