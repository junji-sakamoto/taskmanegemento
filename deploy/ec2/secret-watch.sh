#!/bin/bash
# RDS のパスワードが変わったら、Spring Boot を起動し直す。
# taskmanagement-secret-watch.timer から 5 分ごとに呼ばれる。
# RDS はパスワードを 7 日ごとに自動で変えるが、Spring Boot は起動したときに読んだパスワードを使い続けるため。
set -euo pipefail

dir=/opt/taskmanagement
source "$dir/app.env"

# Spring Boot が動いていないときは何もしない（起動の失敗は、systemd が起動し直す）
systemctl is-active --quiet taskmanagement || exit 0

# 起動したときに使った版（start.sh が書く）が分からなければ、比べられないので何もしない
used=$(cat "$dir/secret-version" 2>/dev/null || true)
[[ -n $used ]] || exit 0

# 今の版。表示するのは版の番号だけで、パスワードは表示しない
current=$(aws secretsmanager get-secret-value --region ap-northeast-1 --secret-id "$DB_SECRET_ARN" --query VersionId --output text)

if [[ $used != "$current" ]]; then
  echo "RDS のパスワードが変わったので、Spring Boot を起動し直します（$used → $current）"
  # 起動し直したあと start.sh も書くが、古い start.sh に戻したときに、起動し直しを繰り返さないよう先に書いておく
  echo "$current" >"$dir/secret-version"
  systemctl restart taskmanagement
fi
