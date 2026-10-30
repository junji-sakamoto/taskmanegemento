# deploy/ec2（EC2 でアプリを動かす）

パソコンで作った画面のファイルと jar を EC2 に送り、nginx で画面を配って、systemd で Spring Boot を動かす。EC2 と RDS は、先に [infra](../../infra/README.md) で作っておく。

| ファイル | 役目 |
| --- | --- |
| `nginx.conf` | 画面のファイルを 80 番で配り、`/api` を Spring Boot へ取り次ぐ（パソコンでの Vite と同じ役目） |
| `start.sh` | RDS のパスワードを起動のたびに Secrets Manager から読み、接続先を RDS にして Spring Boot を起動する |
| `taskmanagement.service` | systemd の設定。EC2 を起動し直しても自動で動き出す。専用のユーザー `taskmanagement` で動かす |
| `install.sh` | EC2 に送ったファイルを置き場所に移し、入れ替えたもの（Spring Boot か nginx）を起動し直す。`deploy/deploy.ps1` から呼ばれる |

アプリのコードと `application.properties` は変えない。パソコンでは `.env` から読んでいるデータベースの接続情報を、EC2 では `start.sh` が環境変数で渡す。

パソコンと EC2 での違いは、次のとおり。

| | パソコン（開発） | EC2 |
| --- | --- | --- |
| 画面 | Vite が 5173 番で配る | `npm run build` で作ったファイルを、nginx が 80 番で配る |
| `/api` の取り次ぎ | Vite のプロキシ | nginx |
| Spring Boot | `127.0.0.1` の 8080 番 | 同じ（外からは直接つながらない） |
| データベース | Docker の PostgreSQL | RDS |

## デプロイする

機能を main に取り込んだあと、リポジトリの一番上のフォルダで、PowerShell 7 で実行する。

```powershell
git switch main
git pull

.\deploy\deploy.ps1            # 画面とサーバーの両方
.\deploy\deploy.ps1 -Frontend  # 画面だけ変えたとき（nginx を読み直す。アプリは止まらない）
.\deploy\deploy.ps1 -Backend   # サーバーだけ変えたとき（Spring Boot を起動し直す。10 秒ほど止まる）
```

`deploy.ps1` は、次の順に進める。どこかで失敗したら、そこで止まる。

1. **事前の確認**：main ブランチにいて、GitHub の main と同じで、`frontend`、`backend`、`deploy` にコミットしていない変更がないこと。サーバーを載せるときは、Docker Desktop が動いていること（テストで使う）
2. **点検とビルド**：画面は `npm run check` と `npm run build`、サーバーは `gradlew check bootJar`（テストを含む）。失敗したら、EC2 には何も送らない
3. **送る**：EC2 の接続先は `terraform output` から取り出す。EC2 の `/tmp/taskmanagement-deploy` に送る
4. **入れ替える**：EC2 で `install.sh` を動かす
5. **確かめる**：`/api/board` が答えるまで 60 秒待ち、画面も読めるか確かめる。答えなければ、Spring Boot の起動の記録を表示して止まる

載せたコミットは、EC2 に記録される。

```bash
cat /opt/taskmanagement/version-frontend /opt/taskmanagement/version-backend
```

## 動いているか確かめる

`deploy.ps1` の最後の確認に加えて、パソコンのブラウザで `http://<public_ip>/` を開き、画面が出て、カードを足して再読み込みしても残っているかを確かめる。開けるのは、`infra/terraform.tfvars` の `my_ip` の IP アドレスからだけ。

うまくいかないときは、EC2 に SSH で入って確かめる。

```bash
# 動いているか（active なら動いている）
systemctl is-active taskmanagement

# 起動の記録の最後の 30 行
sudo journalctl -u taskmanagement -n 30 --no-pager

# 窓口（API）が答えるか
curl http://127.0.0.1:8080/api/board

# nginx の状態と、エラーの記録
systemctl is-active nginx
sudo tail -n 30 /var/log/nginx/error.log
```

起動には 10〜20 秒ほどかかる。起動したときに、Flyway が RDS にテーブルを作る。

## 気をつけること

- RDS のパスワードは、RDS が 7 日ごとに自動で変える。Spring Boot は起動したときにパスワードを読むので、変わったあとにデータベースにつながらなくなったら、`sudo systemctl restart taskmanagement` で起動し直す
- `.sh` と `.service` の改行は LF にしておく（`.gitattributes`）。CRLF になると EC2 で動かない
