# Terraform と AWS provider の版、state の置き場所。
# state のバケット名は、リポジトリが公開なのでここには書かない。
# terraform init -backend-config="bucket=taskmanagement-tfstate-<アカウント番号>" で渡す（infra/README.md）。
terraform {
  required_version = ">= 1.16"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    key          = "taskmanagement/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  # 作ったものすべてに、このアプリのものだと分かる札をつける
  default_tags {
    tags = {
      Project   = "taskmanagement"
      ManagedBy = "terraform"
    }
  }
}
