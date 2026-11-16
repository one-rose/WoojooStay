#!/usr/bin/env bash
# DB · 영수증 사진 백업 — 매일 새벽 cron 으로 실행, 14일치 보관
#   crontab -e →  30 4 * * * /home/ubuntu/uzuStay/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
DIR=${BACKUP_DIR:-$HOME/backups}
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U uzustay -Fc uzustay > "$DIR/db-$STAMP.dump"
docker compose run --rm --no-deps --user root -v "$DIR":/backup --entrypoint sh api \
  -c "tar czf /backup/uploads-$STAMP.tgz -C /app uploads"
find "$DIR" -name 'db-*.dump' -mtime +14 -delete
find "$DIR" -name 'uploads-*.tgz' -mtime +14 -delete
echo "$(date '+%F %T') 백업 완료 → $DIR"
