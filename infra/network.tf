# アカウントに最初からあるデフォルト VPC を使う
data "aws_vpc" "default" {
  default = true
}

# EC2 の門番。SSH（22 番）と HTTP（80 番）を、自分の IP アドレスからだけ通す
resource "aws_security_group" "app" {
  name        = "taskmanagement-app"
  description = "taskmanagement EC2"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "ssh_from_my_ip" {
  security_group_id = aws_security_group.app.id
  description       = "SSH from my PC"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = "${var.my_ip}/32"
}

resource "aws_vpc_security_group_ingress_rule" "http_from_my_ip" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP from my PC"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "${var.my_ip}/32"
}

# EC2 から外への通信（Java や nginx を入れるためのダウンロードなど）は許可する。
# 外から EC2 へ入る通信は、上の SSH と HTTP だけ
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "Outbound for package downloads"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
