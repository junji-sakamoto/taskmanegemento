#!/bin/bash
# EC2 が初めて起動したときに1回だけ動く。Java 25（Amazon Corretto 25）を入れる。
# 結果は EC2 の /var/log/cloud-init-output.log に残る。
set -euxo pipefail

if ! dnf install -y java-25-amazon-corretto-headless; then
  # パッケージの一覧が古いと見つからないことがあるので、最新の一覧で入れ直す
  dnf --releasever=latest install -y java-25-amazon-corretto-headless
fi

java -version
