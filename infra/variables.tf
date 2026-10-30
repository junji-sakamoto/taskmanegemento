variable "region" {
  description = "使うリージョン（東京）"
  type        = string
  default     = "ap-northeast-1"
}

variable "my_ip" {
  description = "SSH を許可する、自分のパソコンの IP アドレス（例：203.0.113.10）。terraform.tfvars で渡す"
  type        = string

  validation {
    condition     = can(regex("^\\d{1,3}(\\.\\d{1,3}){3}$", var.my_ip))
    error_message = "my_ip には、203.0.113.10 のような IPv4 アドレスを1つだけ書く。"
  }
}

variable "instance_type" {
  description = "EC2 の大きさ。t4g.small は 2026-12-31 まで無料トライアルの対象"
  type        = string
  default     = "t4g.small"
}

variable "ssh_public_key_path" {
  description = "AWS に登録する SSH の公開鍵のファイル。秘密鍵はパソコンにだけ置く"
  type        = string
  default     = "~/.ssh/taskmanagement-ec2.pub"
}
