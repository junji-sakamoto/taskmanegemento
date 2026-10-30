# infra（Terraform）

AWS の上に、このアプリを動かす EC2 と RDS を作る Terraform のコード。
インフラ構成図と部品ごとの設定は [docs/技術スタック.md](../docs/技術スタック.md) 5章、準備と運用の全体は [README](../README.md) の「AWS で動かす」にある。アプリを載せる手順は [deploy/ec2/README.md](../deploy/ec2/README.md) にある。

作るものは、次のとおり。

| ファイル | 作るもの |
| --- | --- |
| `network.tf` | セキュリティグループ。SSH（22 番）と HTTP（80 番）を、自分の IP アドレスからだけ通す |
| `compute.tf` | EC2（t4g.small、Amazon Linux 2023）と、SSH の公開鍵の登録 |
| `user_data.sh` | EC2 が初めて起動したときに、Java 25（Amazon Corretto 25）と nginx を入れ、nginx を起動する |
| `database.tf` | RDS for PostgreSQL 18（db.t4g.micro）。インターネットからは入れず、5432 番を EC2 からだけ通す。パスワードは RDS が作って Secrets Manager に置く |
| `iam.tf` | EC2 に渡す権限。RDS のパスワードを読むことだけを許す |

RDS は、いちばん小さい大きさでも月およそ 21 ドル（ディスクとパスワードの置き場所を含む）かかる。使わない日は止める（下の「使わない日は止める」）。

`user_data.sh` は初めて起動したときにしか動かないので、中身を変えて `apply` すると EC2 が作り直される。EC2 の中のデータは消え、公開 IP アドレスも変わる。

コマンドは、どれもリポジトリの一番上のフォルダで、PowerShell で実行する。

## はじめの1回だけ

1. SSH の鍵を作る（秘密鍵はパソコンにだけ置く）

    ```powershell
    New-Item -ItemType Directory -Force "$HOME\.ssh" | Out-Null
    ssh-keygen -t ed25519 -f "$HOME\.ssh\taskmanagement-ec2" -C "taskmanagement-ec2"
    ```

    パスフレーズを聞かれたら、何も入れずに Enter を2回押す。

2. Terraform の記録（state）の置き場所（S3 バケット）を作る。Terraform 自身の記録を入れる場所なので、Terraform より先に AWS CLI で作る

    ```powershell
    $account = aws sts get-caller-identity --query Account --output text
    $bucket = "taskmanagement-tfstate-$account"
    aws s3api create-bucket --bucket $bucket --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
    # 上書きしても前の版に戻せるようにする
    aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
    # インターネットに公開されないようにする
    aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    ```

    このバケットは Terraform の外で作るので、`terraform destroy` では消えない

3. `infra/terraform.tfvars.example` を `infra/terraform.tfvars` にコピーし、`my_ip` を自分の IP アドレスに書き換える

    ```powershell
    (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
    ```

4. 準備する。バケット名は、リポジトリが公開なのでコードに書かず、ここで渡す

    ```powershell
    $account = aws sts get-caller-identity --query Account --output text
    terraform -chdir=infra init -backend-config="bucket=taskmanagement-tfstate-$account"
    ```

## 作る・確かめる

```powershell
terraform -chdir=infra plan
terraform -chdir=infra apply
```

`apply` が終わると、`app_url` にブラウザで開く URL、`ssh_command` に SSH で入るコマンドが表示される。

- アプリを載せる前に `app_url` を開くと、nginx の初期画面が出る。アプリは [deploy/ec2/README.md](../deploy/ec2/README.md) の `deploy.ps1` で載せる
- SSH で入ったら、Java が入っているかを確かめる

```powershell
ssh -i ~/.ssh/taskmanagement-ec2 ec2-user@<public_ip>
java -version
```

Java と nginx は、EC2 が起動してから数分かけて入る。画面が出ないときや `java -version` が見つからないときは、少し待つか、SSH で入って `sudo tail /var/log/cloud-init-output.log` で進み具合を見る。

## EC2 から RDS につながるか確かめる

RDS はインターネットから入れないので、EC2 に SSH で入ってから確かめる。`<db_endpoint>` と `<db_secret_arn>` には、`terraform -chdir=infra output` で表示された値を入れる。

```bash
# PostgreSQL につなぐ道具（psql）を入れる
sudo dnf install -y postgresql18

# パスワードを Secrets Manager から読み、RDS につないで版を表示する
export PGPASSWORD=$(aws secretsmanager get-secret-value --region ap-northeast-1 --secret-id '<db_secret_arn>' --query SecretString --output text | python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])')
psql "host=<db_endpoint> dbname=taskmanagement user=taskmanagement sslmode=require" -c 'select version();'
unset PGPASSWORD
```

## 使わない日は止める

```powershell
$id = terraform -chdir=infra output -raw instance_id

# 止める
aws ec2 stop-instances --instance-ids $id
aws rds stop-db-instance --db-instance-identifier taskmanagement-db

# また動かす（RDS が先）
aws rds start-db-instance --db-instance-identifier taskmanagement-db
aws ec2 start-instances --instance-ids $id

# 動かしたあと、Terraform の記録を新しくする
terraform -chdir=infra apply -refresh-only
```

EC2 は、止めて動かすと公開 IP アドレスが変わる。`deploy.ps1` や `terraform output` は Terraform の記録から IP アドレスを読むので、動かしたあとは `terraform apply -refresh-only` で記録を新しくする。これは記録を新しくするだけで、AWS の上のものは何も変えない。

RDS は止めても 7 日たつと自動で動き出すので、長く使わないときは片付ける。

## 自宅の IP アドレスが変わったとき

SSH や画面がつながらなくなったら、`terraform.tfvars` の `my_ip` を今の IP アドレスに直して、もう一度 `terraform -chdir=infra apply` する。

## 片付ける

```powershell
terraform -chdir=infra destroy
```

RDS の中身は消え、戻せない（消すときにバックアップを取らない設定）。残したいときは、先に [deploy/ec2/README.md](../deploy/ec2/README.md) の「データを残す・戻す」でバックアップを取る。
