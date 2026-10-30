#!/bin/bash
# EC2 の上で、アプリを入れ替える・前の版に戻す。deploy/deploy.ps1 から呼ばれる。
# 使い方:
#   sudo bash install.sh install <送ったフォルダ> <all|frontend|backend> <コミット> <RDS の接続先> <パスワードを置いた Secrets Manager の ARN>
#   sudo bash install.sh rollback <all|frontend|backend>
# 終わり方: 0 = 成功、3 = 入れ替えたものが動かなかったので前の版に戻した、それ以外 = 失敗
set -euo pipefail

dir=/opt/taskmanagement
nginx_conf=/etc/nginx/conf.d/taskmanagement.conf

# Spring Boot が /api/board に答えるまで、60 秒まで待つ
wait_backend() {
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null http://127.0.0.1:8080/api/board && return 0
    sleep 2
  done
  return 1
}

# nginx が画面を返すか
check_frontend() {
  curl -sf -o /dev/null http://127.0.0.1/
}

# --- サーバー（jar と start.sh） ---

backup_backend() {
  [[ -f $dir/app.jar ]] || return 0
  cp -p "$dir/app.jar" "$dir/app.jar.prev"
  cp -p "$dir/start.sh" "$dir/start.sh.prev"
  cp -p "$dir/version-backend" "$dir/version-backend.prev" 2>/dev/null || true
}

# 前の版を今の版にする。swap なら今の版を .prev に残す（もう一度戻すと元に戻る）
restore_backend() {
  local how=$1
  [[ -f $dir/app.jar.prev ]] || { echo "サーバーの前の版がありません" >&2; return 1; }
  for f in app.jar start.sh version-backend; do
    [[ -f $dir/$f.prev && -f $dir/$f ]] || continue
    if [[ $how == swap ]]; then
      mv "$dir/$f" "$dir/$f.tmp"
      mv "$dir/$f.prev" "$dir/$f"
      mv "$dir/$f.tmp" "$dir/$f.prev"
    else
      cp -p "$dir/$f.prev" "$dir/$f"
    fi
  done
  systemctl restart taskmanagement
  wait_backend
}

install_backend() {
  local src=$1 version=$2 db_host=$3 db_secret_arn=$4
  backup_backend
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

  if ! wait_backend; then
    echo "Spring Boot が 60 秒たっても答えないので、前の版に戻します" >&2
    journalctl -u taskmanagement -n 20 --no-pager >&2 || true
    restore_backend copy && rolled_back=1 && return 0
    return 1
  fi
}

# --- 画面（画面のファイルと nginx の設定） ---

backup_frontend() {
  [[ -d $dir/frontend ]] || return 0
  rm -rf "$dir/frontend.prev"
  cp -rp "$dir/frontend" "$dir/frontend.prev"
  cp -p "$nginx_conf" "$dir/nginx.conf.prev"
  cp -p "$dir/version-frontend" "$dir/version-frontend.prev" 2>/dev/null || true
}

restore_frontend() {
  local how=$1
  [[ -d $dir/frontend.prev ]] || { echo "画面の前の版がありません" >&2; return 1; }
  if [[ $how == swap ]]; then
    mv "$dir/frontend" "$dir/frontend.tmp"
    mv "$dir/frontend.prev" "$dir/frontend"
    mv "$dir/frontend.tmp" "$dir/frontend.prev"
    cp -p "$nginx_conf" "$dir/nginx.conf.tmp"
    cp -p "$dir/nginx.conf.prev" "$nginx_conf"
    mv "$dir/nginx.conf.tmp" "$dir/nginx.conf.prev"
    if [[ -f $dir/version-frontend.prev && -f $dir/version-frontend ]]; then
      mv "$dir/version-frontend" "$dir/version-frontend.tmp"
      mv "$dir/version-frontend.prev" "$dir/version-frontend"
      mv "$dir/version-frontend.tmp" "$dir/version-frontend.prev"
    fi
  else
    rm -rf "$dir/frontend"
    cp -rp "$dir/frontend.prev" "$dir/frontend"
    cp -p "$dir/nginx.conf.prev" "$nginx_conf"
    cp -p "$dir/version-frontend.prev" "$dir/version-frontend" 2>/dev/null || true
  fi
  nginx -t && systemctl reload nginx && check_frontend
}

install_frontend() {
  local src=$1 version=$2
  backup_frontend
  rm -rf "$dir/frontend"
  cp -r "$src/dist" "$dir/frontend"
  chmod -R a+rX "$dir/frontend"
  install -m 644 "$src/nginx.conf" "$nginx_conf"
  echo "$version" >"$dir/version-frontend"

  # 設定に誤りがあれば読み直さずに、画面が読めなければ読み直したあとで、前の版に戻す
  if ! { nginx -t && systemctl reload nginx && check_frontend; }; then
    echo "nginx の設定か画面のファイルに問題があるので、前の版に戻します" >&2
    restore_frontend copy && rolled_back=1 && return 0
    return 1
  fi
}

# --- ここから ---

action=$1
rolled_back=0

case $action in
  install)
    src=$2 mode=$3 version=$4 db_host=$5 db_secret_arn=$6

    # アプリ専用のユーザー（ログインはできない）
    id taskmanagement >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin taskmanagement
    install -d -o taskmanagement -g taskmanagement "$dir" "$dir/logs"

    if [[ $mode == all || $mode == backend ]]; then
      install_backend "$src" "$version" "$db_host" "$db_secret_arn"
    fi
    if [[ $mode == all || $mode == frontend ]]; then
      if ((rolled_back)); then
        # 画面とサーバーの版がずれないように、画面も入れ替えない
        echo "サーバーを前の版に戻したので、画面は入れ替えません" >&2
      else
        install_frontend "$src" "$version"
      fi
    fi
    rm -rf "$src"
    ;;
  rollback)
    mode=$2
    if [[ $mode == all || $mode == backend ]]; then
      restore_backend swap
    fi
    if [[ $mode == all || $mode == frontend ]]; then
      restore_frontend swap
    fi
    ;;
  *)
    echo "使い方: install.sh install|rollback ..." >&2
    exit 2
    ;;
esac

if ((rolled_back)); then
  exit 3
fi
