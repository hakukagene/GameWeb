#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo bash deploy/digitalocean/prepare.sh'; exit 1; fi
command -v docker >/dev/null || { echo 'Install Docker Engine and the Compose plugin first.'; exit 1; }
docker compose version >/dev/null
if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo 'Created .env. Set SITE_HOST and GAME_HOST, point DNS to this server, then run again.'
  exit 1
fi
if grep -Eq '^((SITE_HOST=example.com)|(GAME_HOST=games.example.com))$' .env; then
  echo 'Replace the example hostnames in deploy/digitalocean/.env before starting.'
  exit 1
fi
docker compose config --quiet
install -d -m 750 /srv/storyplay
install -d -m 750 -o 1000 -g 1000 /srv/storyplay/data /srv/storyplay/game-content
install -d -m 700 /srv/storyplay/backups /srv/storyplay/caddy-data /srv/storyplay/caddy-config
echo 'Directories ready. Start: cd deploy/digitalocean && sudo docker compose up -d --build'
