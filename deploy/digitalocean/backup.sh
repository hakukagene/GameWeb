#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo bash deploy/digitalocean/backup.sh'; exit 1; fi
install -d -m 700 /srv/storyplay/backups
exec 9>/srv/storyplay/backups/.backup.lock
flock -n 9 || { echo 'A backup is already running.'; exit 1; }
docker compose config --quiet
[[ -n "$(docker compose ps --status running -q app)" ]] || { echo 'App is not running. No backup was made.'; exit 1; }
archive="/srv/storyplay/backups/storyplay-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
restart_app() { docker compose start app; }
trap restart_app EXIT
docker compose stop app
# Include DB/WAL/SHM and builds together while no writes are possible.
tar -C /srv/storyplay -czf "${archive}.partial" data game-content
mv "${archive}.partial" "$archive"
echo "Backup saved: $archive"
# The EXIT trap also restarts the app if tar fails, e.g. because the disk is full.
