# deploy/ec2（EC2 で Spring Boot を動かす）

パソコンで作った jar を EC2 に送り、systemd で Spring Boot を動かす。EC2 と RDS は、先に [infra](../../infra/README.md) で作っておく。

| ファイル | 役目 |
| --- | --- |
| `start.sh` | RDS のパスワードを起動のたびに Secrets Manager から読み、接続先を RDS にして Spring Boot を起動する |
| `taskmanagement.service` | systemd の設定。EC2 を起動し直しても自動で動き出す。専用のユーザー `taskmanagement` で動かす |
| `install.sh` | EC2 に送ったファイルを `/opt/taskmanagement` に移し、Spring Boot を起動し直す |

アプリのコードと `application.properties` は変えない。パソコンでは `.env` から読んでいるデータベースの接続情報を、EC2 では `start.sh` が環境変数で渡す。

Spring Boot は、パソコンと同じく `127.0.0.1` の 8080 番だけで受け付ける。外からは直接つながらない。

## 送って起動する

コマンドは、リポジトリの一番上のフォルダで、PowerShell で実行する。

```powershell
# 1. jar を作る（backend/build/libs にできる）
.\backend\gradlew.bat -p backend bootJar

# 2. EC2 と RDS の情報を Terraform から取り出す
$ip = terraform -chdir=infra output -raw public_ip
$dbHost = terraform -chdir=infra output -raw db_endpoint
$dbSecret = terraform -chdir=infra output -raw db_secret_arn

# 3. EC2 に送る
scp -i ~/.ssh/taskmanagement-ec2 backend/build/libs/taskmanagement-0.0.1-SNAPSHOT.jar "ec2-user@${ip}:/tmp/app.jar"
scp -i ~/.ssh/taskmanagement-ec2 deploy/ec2/start.sh deploy/ec2/install.sh deploy/ec2/taskmanagement.service "ec2-user@${ip}:/tmp/"

# 4. EC2 で置き場所に移し、起動し直す
ssh -i ~/.ssh/taskmanagement-ec2 "ec2-user@$ip" "sudo bash /tmp/install.sh $dbHost $dbSecret"
```

## 動いているか確かめる

EC2 に SSH で入って確かめる。

```bash
# 動いているか（active なら動いている）
systemctl is-active taskmanagement

# 起動の記録の最後の 30 行
sudo journalctl -u taskmanagement -n 30 --no-pager

# 窓口（API）が答えるか
curl http://127.0.0.1:8080/api/board
```

起動には 10〜20 秒ほどかかる。起動したときに、Flyway が RDS にテーブルを作る。

## 気をつけること

- RDS のパスワードは、RDS が 7 日ごとに自動で変える。Spring Boot は起動したときにパスワードを読むので、変わったあとにデータベースにつながらなくなったら、`sudo systemctl restart taskmanagement` で起動し直す
- `.sh` と `.service` の改行は LF にしておく（`.gitattributes`）。CRLF になると EC2 で動かない
