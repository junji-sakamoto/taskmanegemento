#!/bin/bash
# EC2 が初めて起動したときに1回だけ動く。Java 25（Amazon Corretto 25）と nginx を入れる。
# 結果は EC2 の /var/log/cloud-init-output.log に残る。
set -euxo pipefail

if ! dnf install -y java-25-amazon-corretto-headless nginx; then
  # パッケージの一覧が古いと見つからないことがあるので、最新の一覧で入れ直す
  dnf --releasever=latest install -y java-25-amazon-corretto-headless nginx
fi

java -version

# nginx を起動し、EC2 を起動し直したときも自動で起動するようにする
systemctl enable --now nginx
