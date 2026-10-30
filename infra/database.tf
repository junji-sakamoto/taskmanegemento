# デフォルト VPC のサブネット。RDS は、2 つ以上の場所（アベイラビリティーゾーン）にまたがるサブネットの指定が必要
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "db" {
  name       = "taskmanagement-db"
  subnet_ids = data.aws_subnets.default.ids
}

# RDS の門番。PostgreSQL（5432 番）を、EC2 からだけ通す
resource "aws_security_group" "db" {
  name        = "taskmanagement-db"
  description = "taskmanagement RDS"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "postgres_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from EC2"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}

resource "aws_db_instance" "db" {
  identifier     = "taskmanagement-db"
  engine         = "postgres"
  engine_version = "18.6"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "taskmanagement"
  username = "taskmanagement"
  # パスワードは RDS に作らせ、Secrets Manager に置く。Terraform の state には残らない
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  # インターネットからは入れない
  publicly_accessible = false
  multi_az            = false

  backup_retention_period = 1
  # 学習用なので、消すときにバックアップを取らず、すぐ消せるようにする。データも消える
  skip_final_snapshot = true
  deletion_protection = false
}
