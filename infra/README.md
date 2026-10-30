# infra（Terraform）

AWS の上に、このアプリを動かす EC2 を作る Terraform のコード。
考え方や全体の流れは [docs/aws-deployment-guide.md](../docs/aws-deployment-guide.md) に書いてある。

今の段で作るものは、次のとおり。アプリのデプロイは、あとの段で足す。

| ファイル | 作るもの |
| --- | --- |
| `network.tf` | セキュリティグループ。SSH（22 番）と HTTP（80 番）を、自分の IP アドレスからだけ通す |
| `compute.tf` | EC2（t4g.small、Amazon Linux 2023）と、SSH の公開鍵の登録 |
| `user_data.sh` | EC2 が初めて起動したときに、Java 25（Amazon Corretto 25）と nginx を入れ、nginx を起動する |

`user_data.sh` は初めて起動したときにしか動かないので、中身を変えて `apply` すると EC2 が作り直される。EC2 の中のデータは消え、公開 IP アドレスも変わる。

コマンドは、どれもリポジトリの一番上のフォルダで、PowerShell で実行する。

## はじめの1回だけ

1. SSH の鍵を作る（秘密鍵はパソコンにだけ置く）

    ```powershell
    New-Item -ItemType Directory -Force "$HOME\.ssh" | Out-Null
    ssh-keygen -t ed25519 -f "$HOME\.ssh\taskmanagement-ec2" -C "taskmanagement-ec2"
    ```

    パスフレーズを聞かれたら、何も入れずに Enter を2回押す。

2. state の置き場所（S3 バケット）を作る。手順は [docs/aws-deployment-guide.md](../docs/aws-deployment-guide.md) の 5-1

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

- ブラウザで `app_url` を開くと、nginx の初期画面が出る
- SSH で入ったら、Java が入っているかを確かめる

```powershell
ssh -i ~/.ssh/taskmanagement-ec2 ec2-user@<public_ip>
java -version
```

Java と nginx は、EC2 が起動してから数分かけて入る。画面が出ないときや `java -version` が見つからないときは、少し待つか、SSH で入って `sudo tail /var/log/cloud-init-output.log` で進み具合を見る。

## 自宅の IP アドレスが変わったとき

SSH や画面がつながらなくなったら、`terraform.tfvars` の `my_ip` を今の IP アドレスに直して、もう一度 `terraform -chdir=infra apply` する。

## 片付ける

```powershell
terraform -chdir=infra destroy
```
