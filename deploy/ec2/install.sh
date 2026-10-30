#!/bin/bash
# EC2 の上で、送ったファイルを置き場所に移し、入れ替えたものを起動し直す。deploy/deploy.ps1 から呼ばれる。
# 使い方: sudo bash install.sh <送ったフォルダ> <all|frontend|backend> <コミット> <RDS の接続先> <パスワードを置いた Secrets Manager の ARN>
set -euo pipefail

src=$1
mode=$2
version=$3
db_host=$4
db_secret_arn=$5
dir=/opt/taskmanagement

# アプリ専用のユーザー（ログインはできない）
id taskmanagement >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin taskmanagement
install -d -o taskmanagement -g taskmanagement "$dir" "$dir/logs"

if [[ $mode == all || $mode == backend ]]; then
  install -m 644 -o taskmanagement -g taskmanagement "$src/app.jar" "$dir/app.jar"
  install -m 755 "$src/start.sh" "$dir/start.sh"
  install -m 644 "$src/taskmanagement.service" /etc/systemd/system/taskmanagement.service

  # 接続先を書く。パスワードは書かない
  printf 'DB_HOST=%s\nDB_SECRET_ARN=%s\n' "$db_host" "$db_secret_arn" >"$dir/app.env"
  chmod 644 "$dir/app.env"

  systemctl daemon-reload
  systemctl enable taskmanagement
  systemctl restart taskmanagement
  echo "$version" >"$dir/version-backend"
fi

if [[ $mode == all || $mode == frontend ]]; then
  # 画面のファイルを入れ替える。前のファイルは残さない
  rm -rf "$dir/frontend"
  cp -r "$src/dist" "$dir/frontend"
  chmod -R a+rX "$dir/frontend"

  # nginx の設定を置き、書き方に誤りがないか確かめてから読み直す
  install -m 644 "$src/nginx.conf" /etc/nginx/conf.d/taskmanagement.conf
  nginx -t
  systemctl reload nginx
  echo "$version" >"$dir/version-frontend"
fi

# 送ってきたファイルを片付ける
rm -rf "$src"
