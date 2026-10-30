# deploy/ec2（EC2 でアプリを動かす）

パソコンで作った画面のファイルと jar を EC2 に送り、nginx で画面を配って、systemd で Spring Boot を動かす。EC2 と RDS は、先に [infra](../../infra/README.md) で作っておく。

| ファイル | 役目 |
| --- | --- |
| `nginx.conf` | 画面のファイルを 80 番で配り、`/api` を Spring Boot へ取り次ぐ（パソコンでの Vite と同じ役目） |
| `start.sh` | RDS のパスワードを起動のたびに Secrets Manager から読み、接続先を RDS にして Spring Boot を起動する |
| `taskmanagement.service` | systemd の設定。EC2 を起動し直しても自動で動き出す。専用のユーザー `taskmanagement` で動かす |
| `install.sh` | EC2 に送ったファイルを置き場所に移し、入れ替えたもの（Spring Boot か nginx）を起動し直す。動かなければ前の版に戻す。`deploy/deploy.ps1` から呼ばれる |

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
.\deploy\deploy.ps1 -Rollback  # 前の版に戻す（下の「前の版に戻す」）
```

`deploy.ps1` は、次の順に進める。どこかで失敗したら、そこで止まる。

1. **事前の確認**：main ブランチにいて、GitHub の main と同じで、`frontend`、`backend`、`deploy` にコミットしていない変更がないこと。サーバーを載せるときは、Docker Desktop が動いていること（テストで使う）
2. **点検とビルド**：画面は `npm run check` と `npm run build`、サーバーは `gradlew check bootJar`（テストを含む）。失敗したら、EC2 には何も送らない
3. **送る**：EC2 の接続先は `terraform output` から取り出す。EC2 の `/tmp/taskmanagement-deploy` に送る
4. **入れ替える**：EC2 で `install.sh` を動かす。入れ替える前に、今の版を `.prev` として残す。入れ替えたものが動かなければ、自動で前の版に戻す（下の「前の版に戻す」）
5. **確かめる**：`/api/board` が答えるまで 60 秒待ち、`deploy/smoke-test.ps1` で画面とカードの操作を確かめる（下の「動いているか確かめる」）。答えなければ、Spring Boot の起動の記録を表示して止まる

載せたコミットは、EC2 に記録される。

```bash
cat /opt/taskmanagement/version-frontend /opt/taskmanagement/version-backend
```

## 前の版に戻す

### 自動で戻るとき

`install.sh` は、入れ替えたあと EC2 の中で確かめ、だめなら `.prev` に戻す。戻したときは、`deploy.ps1` が「入れ替えたものが動かなかったので、前の版に戻しました」と表示して止まる。表示された記録で原因を確かめ、直してからもう一度デプロイする。

| 入れ替えたもの | 確かめること | だめなとき |
| --- | --- | --- |
| サーバー | Spring Boot が 60 秒以内に `/api/board` に答えるか | jar と `start.sh` を前の版に戻し、起動し直す。画面も載せる途中だったときは、版がずれないように画面は入れ替えない |
| 画面 | `nginx -t` が通り、画面が読めるか | 画面のファイルと nginx の設定を前の版に戻し、読み直す |

### 手で戻すとき

デプロイは通ったが、ブラウザで触ったら動きがおかしい、というときに使う。

```powershell
.\deploy\deploy.ps1 -Rollback            # 画面とサーバーの両方
.\deploy\deploy.ps1 -Rollback -Frontend  # 画面だけ
.\deploy\deploy.ps1 -Rollback -Backend   # サーバーだけ
```

今の版と `.prev` を入れ替えるので、もう一度 `-Rollback` すると、戻す前の版になる。戻せるのは 1 つ前の版までで、データベースの中身は戻らない。

EC2 の `/opt/taskmanagement` に残る前の版は、次のとおり。

| ファイル | 中身 |
| --- | --- |
| `app.jar.prev`、`start.sh.prev`、`version-backend.prev` | サーバーの前の版 |
| `frontend.prev`、`nginx.conf.prev`、`version-frontend.prev` | 画面の前の版 |

## 動いているか確かめる

### 自動の確認（smoke-test.ps1）

`deploy.ps1` の最後に動く。単独でも動かせる。

```powershell
.\deploy\smoke-test.ps1
```

ブラウザと同じ経路（nginx の 80 番）で、次を順に確かめ、結果を表で表示する。1 つでも NG なら止まる。

| 確かめること | 使う窓口 |
| --- | --- |
| 画面が返り、題名が「タスク管理」 | `GET /` |
| 画面が読む JavaScript が返る | `GET /assets/...` |
| ボードを読み込める | `GET /api/board` |
| 確認用のカードを追加し、日本語の題名のまま保存される | `POST /api/cards` |
| 題名・期限・優先度を編集できる | `PUT /api/cards/{id}` |
| 別のカラムへ移せる | `PUT /api/cards/{id}/position` |
| 削除できる | `DELETE /api/cards/{id}` |

確認用のカード（題名が「動作確認 日付-時刻」）は最後に消す。途中で失敗しても消す。消せなかったときは表示されるので、画面から消す。

### ブラウザで触って確かめる

自動の確認では見られない、画面の動きを確かめる。パソコンのブラウザで `http://<public_ip>/` を開く。開けるのは、`infra/terraform.tfvars` の `my_ip` の IP アドレスからだけ。

- [ ] ボードが表示され、「未着手」「作業中」「完了」の 3 つのカラムがある
- [ ] 「未着手」の「＋ カードを追加」から、カードを追加できる
- [ ] カードをクリックすると編集ダイアログが開き、作成日と更新日が表示される
- [ ] 題名・メモ・期限・優先度を変えて保存すると、カードに反映される
- [ ] 編集ダイアログの「削除」から、確認のダイアログを経てカードを削除できる
- [ ] ドラッグ＆ドロップで、別のカラムへ移したり、同じカラムの中で並べ替えたりできる
- [ ] 「優先度順」「期限順」のボタンで並びが変わり、もう一度押すと向きが逆になる
- [ ] ブラウザを再読み込みしても、変えた内容が残っている

確かめ終わったら、確かめるために作ったカードは消しておく。

### うまくいかないとき

EC2 に SSH で入って確かめる。

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
