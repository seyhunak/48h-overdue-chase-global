#!/usr/bin/env bash
# ClearDue VPS bootstrap — run ONCE on a FRESH Ubuntu 24.04 box (1 vCPU / 1 GB, ~$5/mo).
# It installs Docker + nginx + firewall and adds swap so builds don't OOM.
# DOES NOT deploy the app. Safe to re-run (steps skip when already done).
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo ./scripts/vps-setup.sh)" >&2
  exit 1
fi

echo "==> 1/5 swap (2 GB — mandatory on 1 GB RAM for builds)"
if ! swapon --show | grep -q "/swapfile"; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  sysctl vm.swappiness=10
  echo "vm.swappiness=10" >> /etc/sysctl.conf
else
  echo "swap already present, skipping"
fi

echo "==> 2/5 base packages + unattended security upgrades"
apt-get update
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades
systemctl enable --now fail2ban

echo "==> 3/5 Docker (official repo)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "docker already installed, skipping"
fi

echo "==> 4/5 firewall (22/80/443 only)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 5/5 nginx (reverse proxy shell; app config comes later)"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo ""
echo "DONE. Next (manual, when ready to host):"
echo "  1. Copy this repo to /opt/cleardue, create .env.production (see .env.example)"
echo "  2. docker compose --env-file .env.production up -d --build"
echo "  3. Install deploy/nginx-cleardue.conf (set YOUR_DOMAIN), then: certbot --nginx -d YOUR_DOMAIN"
