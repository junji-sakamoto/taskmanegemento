output "instance_id" {
  description = "EC2 の ID（止める・動かすときに使う）"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "EC2 の公開 IP アドレス。EC2 を止めて動かすと変わる"
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "ブラウザで開く URL。自分の IP アドレスからだけ開ける"
  value       = "http://${aws_instance.app.public_ip}/"
}

output "db_endpoint" {
  description = "RDS の接続先。EC2 の中からだけつながる"
  value       = aws_db_instance.db.address
}

output "db_secret_arn" {
  description = "RDS のパスワードを置いた Secrets Manager の場所"
  value       = aws_db_instance.db.master_user_secret[0].secret_arn
}

output "ssh_command" {
  description = "EC2 に SSH で入るコマンド"
  value       = "ssh -i ~/.ssh/taskmanagement-ec2 ec2-user@${aws_instance.app.public_ip}"
}
