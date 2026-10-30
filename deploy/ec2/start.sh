#!/bin/bash
# Spring Boot を起動する。systemd（taskmanagement.service）から呼ばれる。
# RDS のパスワードは、起動のたびに Secrets Manager から読む。ファイルには残さない。
set -euo pipefail

# 接続先（DB_HOST）とパスワードの置き場所（DB_SECRET_ARN）。install.sh が書く
source /opt/taskmanagement/app.env

secret=$(aws secretsmanager get-secret-value --region ap-northeast-1 --secret-id "$DB_SECRET_ARN" --output json)
read_secret() {
  python3 -c "import json,sys; print(json.loads(json.load(sys.stdin)['SecretString'])['$1'])" <<<"$secret"
}

# 使ったパスワードの版を記録する。変わったら secret-watch.sh が起動し直す
python3 -c "import json,sys; print(json.load(sys.stdin)['VersionId'])" <<<"$secret" >/opt/taskmanagement/secret-version

# application.properties が読む値。パソコンでは .env から読んでいるもの
export POSTGRES_DB=taskmanagement
export POSTGRES_USER=$(read_secret username)
export POSTGRES_PASSWORD=$(read_secret password)

# 接続先を、パソコンの localhost から RDS に差し替える。通信は暗号化する
export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:5432/${POSTGRES_DB}?sslmode=require"

exec java -jar /opt/taskmanagement/app.jar
