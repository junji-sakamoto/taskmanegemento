output "instance_id" {
  description = "EC2 の ID（止める・動かすときに使う）"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "EC2 の公開 IP アドレス。EC2 を止めて動かすと変わる"
  value       = aws_instance.app.public_ip
}

output "ssh_command" {
  description = "EC2 に SSH で入るコマンド"
  value       = "ssh -i ~/.ssh/taskmanagement-ec2 ec2-user@${aws_instance.app.public_ip}"
}
