---
name: quality-check
description: このアプリの品質をチェック（レビュー）する。フロントエンドは Lint・ビルド・React のアンチパターン、バックエンドは Checkstyle・ビルド・Spring Boot のアンチパターン、インフラは Terraform（fmt・validate・plan）とデプロイのスクリプトと AWS の設定の安全さ、さらに設計書と実装のずれを点検する。品質チェック、品質管理、コードレビュー、「標準から外れていないか見て」「設計書と実装が合っているか見て」「Terraform を点検して」と言われたときに必ず使う。
---

# 品質をチェックする

このアプリの品質を、次の4つの区分で点検する。

| 区分 | 点検すること |
| --- | --- |
| (1) フロントエンド | Lint の実行、ビルドの確認、React のアンチパターンのチェック |
| (2) バックエンド | Checkstyle の実行、ビルドの確認、Spring Boot のアンチパターンのチェック |
| (3) ドキュメントの整合性 | 設計書と実装のずれのチェック |
| (4) インフラ | Terraform の書き方・文法・実際の AWS との差、デプロイのスクリプトの文法、AWS の設定の安全さのチェック |

どの区分も、**コマンドで自動で点検できるもの**を先に実行し、そのあとで**チェックリストを目で確かめる**。

## 必ず守ること

- 点検だけを頼まれたときは、ファイルを変えない。結果を報告し、直すかどうかをユーザーに確かめる。
- 直すときは、CLAUDE.md の流れ（イシュー → ブランチ → コミット → プルリクエスト）で行う。
- コマンドが失敗したときは、失敗したことと、その出力をそのまま報告する。「たぶん大丈夫」とまとめない。
- 指摘には、必ず理由を付ける。「どの文書の何章と違うか」「どの標準（React の公式の説明、Spring Boot の公式の説明など）から外れているか」を書く。
- インフラの点検では、AWS の上のものを変えない。`terraform apply`、`terraform destroy`、デプロイ（`deploy.ps1`）は実行しない。`terraform plan` までにする。

## (1) フロントエンド

`frontend` フォルダで実行する。

### 1-1 Lint の実行

```powershell
npm run lint
```

- 道具は Oxlint（設定は `frontend/.oxlintrc.json`）。警告が1つでもあれば失敗する設定にしてある。
- ルールを外している行（`oxlint-disable-next-line`）には、外した理由のコメントがあるかを確かめる。理由のないものは指摘する。

### 1-2 ビルドの確認

```powershell
npm run typecheck
npm run build
```

`npm run check` を実行すると、Lint と型のチェックをまとめて行える。

### 1-3 React のアンチパターンのチェック（目で確かめる）

| 観点 | 良くない例 | 正しい形 |
| --- | --- | --- |
| hooks のルール | 条件分岐やループの中で hooks を呼ぶ | 部品の一番上で、毎回同じ順番で呼ぶ |
| effect の依存配列 | 使っていない値を、再実行のきっかけとして依存配列に入れる。依存配列から値をわざと抜く | effect の中で使う値をすべて入れる。ボタンを押したときの処理は、effect ではなくイベントハンドラーに書く |
| effect の後始末 | 読み込みの途中で部品が消えても、古い返事で state を書き換える | 後始末（cleanup）で、古い返事を捨てる |
| 要らない effect | props や state から計算できる値を、effect で別の state に写す | 描画の中で計算する |
| state の持ち方 | props から作れる値を state に持つ。同じ情報を2か所に持つ | 1か所だけに持ち、ほかは計算で求める |
| state の書き換え | 配列やオブジェクトを直接書き換える（`push`、`splice`、代入） | 新しい配列やオブジェクトを作って渡す（`boardOperations.ts` のように） |
| リストの key | 配列の番号（index）を key にする | カードの id など、変わらない値を key にする |
| 部品の大きさ | 1つの部品に、状態、保存、表示がまとめて入っている | 状態と保存はカスタムフック（`useBoard.ts` のように）へ、表示は部品へ分ける |
| 保存の失敗 | 画面を先に書き換えたのに、保存に失敗しても元に戻さない | 失敗したら画面を操作の前に戻し、お知らせ欄に出す（docs/基本設計書.md 2.3） |
| 文字の表示 | `dangerouslySetInnerHTML` で、入力した文字を HTML として出す | 文字として出す（docs/非機能要件.md 6章） |
| アクセシビリティ | ラベルのない入力欄。キーボードで届かない操作。色だけで意味を伝える | `label`、フォーカスの枠、`role`、`<dialog>`、文字でも示す（docs/画面設計.md 4章） |
| 通信 | 部品の中に `fetch` を直接書く | 保存係（`src/repository/`）を通す（docs/基本設計書.md 1.3） |

## (2) バックエンド

`backend` フォルダで実行する。テストのために、Docker Desktop を起動しておく。

### 2-1 Checkstyle の実行

```powershell
.\gradlew.bat checkstyleMain checkstyleTest
```

- ルールは `backend/config/checkstyle/checkstyle.xml`。指摘が1つでもあれば失敗する設定にしてある。
- 結果のくわしい表は `backend/build/reports/checkstyle/main.html` と `test.html` にできる。

### 2-2 ビルドの確認

```powershell
.\gradlew.bat build
```

- コンパイラの警告（`-Xlint:all`）も失敗として扱う。
- テストも動く。テストは Testcontainers がテスト専用のデータベースを立ち上げて行うので、ふだん使うデータベースには触らない。
- `.\gradlew.bat check` を実行すると、Checkstyle とテストをまとめて行える。

### 2-3 Spring Boot のアンチパターンのチェック（目で確かめる）

| 観点 | 良くない例 | 正しい形 |
| --- | --- | --- |
| 部品のつなぎ方 | フィールドに `@Autowired` を付ける | コンストラクタで受け取り、`final` にする |
| 返すデータ | エンティティ（`@Entity`）をそのまま画面へ返す | 返す用の record（`CardResponse` のように）に詰め替える |
| 入力のチェック | 受け取ったデータを、チェックせずに使う | record に Bean Validation（`@NotBlank`、`@Size` など）を付け、`@Valid` で受け取る（docs/画面設計.md 10章と同じルール） |
| トランザクション | 複数の行を変える処理に `@Transactional` がない。読むだけの処理に `readOnly` がない | サービスのメソッドに `@Transactional` を付ける（docs/非機能要件.md 3章） |
| HTTP の使い方 | PATCH なのに全部の項目を必須にする。作ったのに 200 を返す | 丸ごと置き換えるなら PUT。作ったら 201、返すものがなければ 204、ないものは 404、ぶつかったら 409 |
| エラーの返し方 | 窓口ごとに、エラーの本文の形がばらばら | ProblemDetail（RFC 9457）にそろえる（`spring.mvc.problemdetails.enabled=true`） |
| データベースの接続 | `spring.jpa.open-in-view` が有効のまま | `false` にする |
| テーブルの変更 | JPA にテーブルを作らせる（`ddl-auto=update` など） | Flyway の SQL ファイル（`db/migration/V*.sql`）で変える（docs/非機能要件.md 7章） |
| 新しい行の保存 | id を画面で作るのに、そのまま `save()` して、INSERT の前に余分な SELECT が走る | エンティティに `Persistable` を実装する（`Card.java` のように） |
| ログ | エラーがターミナルにしか出ない | `logging.file.name` でファイルにも残す（docs/非機能要件.md 4章） |
| テスト | 開発用のデータベースでテストする | Testcontainers の `@ServiceConnection` で、テスト専用のデータベースを使う |
| 受け付ける範囲 | `127.0.0.1` 以外からの接続も受け付ける | `server.address=127.0.0.1`（docs/非機能要件.md 6章） |
| 秘密の情報 | パスワードをコードや GitHub に置く | `.env` に書き、`.gitignore` に入れる |

## (3) ドキュメントの整合性

設計書と実装を照らし合わせ、ずれを探す。

| 文書 | 照らし合わせる実装 | 見るところ |
| --- | --- | --- |
| `docs/機能要件.md` | 画面の動き | 操作の流れ（3章）、キー操作（4.6）、並べ替えのルール（4.9） |
| `docs/画面設計.md` | `frontend/src/components/` | ボタンやメッセージの文言、カードの表示のルール（5章）、ダイアログ（7〜9章）、入力のチェックの文字数とメッセージ（10章） |
| `docs/基本設計書.md` | `frontend/src/repository/`、`backend/.../*Controller.java` | 保存係の仕事（1.3）、窓口の方法・パス・送るデータ・状態コード（3章） |
| `docs/データ設計.md` | `backend/src/main/resources/db/migration/`、`*.java` のエンティティ、`frontend/src/types.ts` | テーブルの列・型・決まり（3.3）、並び順の振り直し（3.4）、データの形（2.2） |
| `docs/技術スタック.md` | `frontend/package.json`、`backend/build.gradle`、`compose.yaml` | 使っている道具と、そのバージョン（4章） |
| `docs/非機能要件.md` | 設定ファイル、`infra/*.tf` | ログ（4章）、受け付ける範囲（6章。AWS では、セキュリティグループと RDS の公開の設定）、点検の道具（7章） |
| `docs/技術スタック.md` | `infra/*.tf`、`infra/.terraform.lock.hcl`、EC2 の上 | AWS で使っているサービスと構成（5章）、その版（4.6） |
| `docs/基本設計書.md` | `infra/*.tf`、`deploy/ec2/nginx.conf` | AWS で動かすときのシステム構成（1章） |
| `README.md` | 全体 | 「今できていること」の表、起動のしかた、コマンド、AWS で動かすときの説明、フォルダの構成 |
| `infra/README.md` | `infra/*.tf`、`terraform output` | 作るものの表、コマンド、output の名前 |
| `deploy/ec2/README.md` | `deploy/*.ps1`、`deploy/ec2/*` | ファイルの表、`deploy.ps1` の指定（`-Frontend` など）と進む順、自動の確認の中身 |

- ずれを見つけたら、**実装を正として文書を直すか、文書を正として実装を直すか**を、ユーザーに確かめる。
- まだ作っていない機能（例：バックアップ）は、ずれではなく「未実装」として分けて報告する。
- 文書を直したときは、Mermaid の図が壊れていないかも確かめる。
- 文書の中のリンク（`[文書](ファイル)` や `#見出し`）の先が、あるかも確かめる。

## (4) インフラ

リポジトリの一番上のフォルダで、PowerShell で実行する。`terraform plan` は AWS に読みに行くので、AWS CLI でログインしておく（`aws sts get-caller-identity` で確かめる）。

### 4-1 Terraform の書き方と文法

```powershell
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra validate
```

- `fmt -check` は、書き方がそろっていないファイルの名前を表示して失敗する。直すときは `terraform -chdir=infra fmt`。
- `validate` の前に `terraform init` が要る（`infra/.terraform` がないとき）。init の手順は `infra/README.md`。

### 4-2 実際の AWS との差（ドリフト）

```powershell
terraform -chdir=infra plan -detailed-exitcode
```

- 終わり方が 0 なら差がない。2 なら差がある。差があれば、どの部品の何が違うかを報告する。
- `-/+`（消して作り直す）や `-`（消す）が出たときは、特に重く扱う。RDS が作り直されるとデータが消える。
- 差は、コードを変えたのにまだ apply していないときにも出る。main のコードと比べているかを確かめる。

### 4-3 デプロイのスクリプトの文法

```powershell
# シェルスクリプト（EC2 で動くもの）。Git に付いてくる bash で文法だけを確かめる
$bash = Join-Path (Split-Path (Split-Path (Get-Command git).Source)) 'bin\bash.exe'
Get-ChildItem deploy/ec2/*.sh, infra/*.sh | ForEach-Object { & $bash -n $_.FullName; "$($_.Name): $LASTEXITCODE" }

# PowerShell のスクリプト（パソコンで動くもの）
Get-ChildItem deploy/*.ps1 | ForEach-Object { $errs = $null; $null = [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$null, [ref]$errs); "$($_.Name): 誤り $($errs.Count) 件" }
```

- tflint、shellcheck、PSScriptAnalyzer は入れていない。入れたときは、これらも使う。
- 動かしてみる確かめ（デプロイ、`smoke-test.ps1`）は、ユーザーに頼まれたときだけ行う。

### 4-4 Terraform と AWS の設定のチェック（目で確かめる）

| 観点 | 良くない例 | 正しい形 |
| --- | --- | --- |
| 公開してはいけない値 | アクセスキー、パスワード、秘密鍵、AWS のアカウント番号、自分の IP アドレスを、`.tf` や文書やコミットに書く | リポジトリは公開なので書かない。IP アドレスは `terraform.tfvars`（Git に入れない）、state のバケット名は `terraform init -backend-config` で渡す |
| パスワード | `password = "..."` を書く。Terraform の state にパスワードが残る | RDS に作らせて Secrets Manager に置く（`manage_master_user_password = true`） |
| 外からの入り口 | セキュリティグループの入る側に `0.0.0.0/0` がある。使わない番地を開ける | 入る側は `my_ip` の `/32` だけ。8080（Spring Boot）と 5432（PostgreSQL）は外に開けない（docs/非機能要件.md 6章） |
| データベースへの入り口 | RDS の 5432 番を IP アドレスで許可する。`publicly_accessible = true` | EC2 のセキュリティグループからだけ許可する（`referenced_security_group_id`）。`publicly_accessible = false` |
| 暗号化 | ディスクや RDS が暗号化されていない | `encrypted = true`、`storage_encrypted = true` |
| EC2 の情報の読み方 | インスタンスの情報を、トークンなしで読める（IMDSv1） | `http_tokens = "required"`（IMDSv2） |
| 権限 | IAM ロールに `*`（何でもできる）を付ける | 要る操作と相手だけを書く（`iam.tf` のように、パスワードを読むことだけ） |
| 費用 | t4g などの CPU クレジットを `unlimited` のままにする。大きすぎる型を使う | `cpu_credits = "standard"`。無料の対象の型を使う（docs/技術スタック.md 5章） |
| 版の固定 | provider の版を書かない。`.terraform.lock.hcl` を Git に入れない | `required_providers` に版の範囲を書き、`.terraform.lock.hcl` を Git に入れる |
| イメージ | AMI の ID を直接書く | SSM のパラメーターで最新を読む。作り直しを避けるため `ignore_changes = [ami]` |
| 作り直しになる項目 | 変わると作り直しになる項目（`user_data` など）を、そうと知らずに変える | 作り直しになることを、コメントと plan で確かめる。止めている EC2 で差が出る項目にも気をつける |
| state と秘密のファイル | `*.tfstate`、`*.tfvars`、保存した plan（`tfplan`）を Git に入れる | `.gitignore` に入っているかを確かめる |
| 改行 | EC2 で動く `.sh`、`.service`、`.timer` が CRLF になる | `.gitattributes` で LF に固定する |
| スクリプトの止まり方 | シェルスクリプトで失敗しても先へ進む | `set -euo pipefail`。PowerShell は `$ErrorActionPreference = 'Stop'` と `$PSNativeCommandUseErrorActionPreference = $true` |
| デプロイの安全さ | main 以外や、コミットしていない変更を載せる。失敗したら戻せない | `deploy.ps1` の事前の確認と、前の版への戻し（docs: `deploy/ec2/README.md`） |

## 報告のしかた

区分ごとに、次の形でユーザーに伝える。

1. コマンドの結果：実行したコマンドと、通ったか失敗したか（失敗したときは出力）
2. 指摘の表

| 区分 | 問題 | 理由（どの文書か、どの標準か） | 直し方 | 重さ |
| --- | --- | --- | --- | --- |
| フロントエンド | （例）effect の依存配列に使わない値がある | React の公式の説明では、依存配列には effect の中で使う値をすべて入れる | ボタンの処理をイベントハンドラーへ移す | 中 |
| インフラ | （例）セキュリティグループで 8080 番を外に開けている | docs/非機能要件.md 6章では、Spring Boot は EC2 の中からだけつながる | ルールを消し、nginx を通す | 高 |

3. 良くできている点も、短く添える
