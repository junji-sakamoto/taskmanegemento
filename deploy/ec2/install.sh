#!/bin/bash
# EC2 の上で、/tmp に送ったファイルを置き場所に移し、Spring Boot を起動し直す。
# 使い方: sudo bash /tmp/install.sh <RDS の接続先> <パスワードを置いた Secrets Manager の ARN>
set -euo pipefail

db_host=$1
db_secret_arn=$2
dir=/opt/taskmanagement

# アプリ専用のユーザー（ログインはできない）
id taskmanagement >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin taskmanagement

install -d -o taskmanagement -g taskmanagement "$dir" "$dir/logs"
install -m 644 -o taskmanagement -g taskmanagement /tmp/app.jar "$dir/app.jar"
install -m 755 /tmp/start.sh "$dir/start.sh"
install -m 644 /tmp/taskmanagement.service /etc/systemd/system/taskmanagement.service

# 接続先を書く。パスワードは書かない
printf 'DB_HOST=%s\nDB_SECRET_ARN=%s\n' "$db_host" "$db_secret_arn" >"$dir/app.env"
chmod 644 "$dir/app.env"

systemctl daemon-reload
systemctl enable taskmanagement
systemctl restart taskmanagement
