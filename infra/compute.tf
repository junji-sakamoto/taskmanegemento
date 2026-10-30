# Amazon Linux 2023（Arm 用）の最新のイメージ
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

# パソコンで作った SSH の公開鍵を、AWS に登録する
resource "aws_key_pair" "ssh" {
  key_name   = "taskmanagement-ec2"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.al2023_arm64.insecure_value
  instance_type               = var.instance_type
  key_name                    = aws_key_pair.ssh.key_name
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = true
  # RDS のパスワードを読む権限（iam.tf）
  iam_instance_profile = aws_iam_instance_profile.app.name

  # 負荷が続いても、追加料金がかからないようにする
  credit_specification {
    cpu_credits = "standard"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  # インスタンスの情報を読むときに、トークンを必須にする（IMDSv2）
  metadata_options {
    http_tokens = "required"
  }

  # 初めて起動したときに Java 25 と nginx を入れる。
  # Windows で取り出すと改行が CRLF になることがあるので、LF にそろえて渡す
  user_data = replace(file("${path.module}/user_data.sh"), "\r\n", "\n")

  # user_data.sh は初めて起動したときにしか動かないので、中身を変えたら EC2 を作り直す。
  # EC2 の中のデータも消えるので、データを置くようになったら見直す
  user_data_replace_on_change = true

  lifecycle {
    ignore_changes = [
      # 新しいイメージが出るたびに、作り直されないようにする
      ami,
      # 止めている EC2 は公開 IP アドレスを持たず、AWS からは false に見える。
      # この項目は変わると作り直しになるので、止めているときに作り直されないようにする（#69）
      associate_public_ip_address,
    ]
  }

  tags = {
    Name = "taskmanagement-app"
  }
}
