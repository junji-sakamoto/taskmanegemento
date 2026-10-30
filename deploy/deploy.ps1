#Requires -Version 7.3
<#
.SYNOPSIS
  EC2 にアプリを載せる（くわしくは deploy/ec2/README.md）。

.EXAMPLE
  .\deploy\deploy.ps1            # 画面とサーバーの両方
  .\deploy\deploy.ps1 -Frontend  # 画面だけ（nginx を読み直す。止まらない）
  .\deploy\deploy.ps1 -Backend   # サーバーだけ（Spring Boot を起動し直す。10 秒ほど止まる）
#>
param(
    [switch]$Frontend,
    [switch]$Backend,
    # 動作確認用。main 以外のブランチや、コミットしていない変更があっても載せる。ふだんは使わない
    [switch]$SkipGitCheck
)

$ErrorActionPreference = 'Stop'
# git、npm、scp などが失敗したら、そこで止める
$PSNativeCommandUseErrorActionPreference = $true

# どちらも指定がなければ両方
if (-not $Frontend -and -not $Backend) {
    $Frontend = $true
    $Backend = $true
}
$mode = if ($Frontend -and $Backend) { 'all' } elseif ($Frontend) { 'frontend' } else { 'backend' }

$root = Split-Path -Parent $PSScriptRoot
$key = Join-Path $HOME '.ssh\taskmanagement-ec2'
$sshOptions = @('-i', $key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
# EC2 の上で、送ったファイルを置いておく一時フォルダ
$staging = '/tmp/taskmanagement-deploy'

function Write-Step([string]$message) {
    Write-Host ""
    Write-Host "== $message" -ForegroundColor Cyan
}

Push-Location $root
try {
    Write-Step "事前の確認（載せるもの: $mode）"
    # 載せるコミット。載せるフォルダにコミットしていない変更があれば、後ろに -dirty をつける
    $changes = git status --porcelain -- frontend backend deploy
    $version = git rev-parse --short HEAD
    if ($changes) {
        $version = "$version-dirty"
    }
    if ($SkipGitCheck) {
        Write-Host "ブランチと変更の確認を飛ばします（-SkipGitCheck）" -ForegroundColor Yellow
    }
    else {
        $branch = git branch --show-current
        if ($branch -ne 'main') {
            throw "main ブランチで実行してください（今は $branch）。"
        }
        git fetch origin main --quiet
        if ((git rev-parse HEAD) -ne (git rev-parse origin/main)) {
            throw "パソコンの main が GitHub の main と違います。git pull してから実行してください。"
        }
        if ($changes) {
            throw "frontend、backend、deploy に、コミットしていない変更があります。`n$($changes -join "`n")"
        }
    }
    if ($Backend) {
        # サーバーのテスト（Testcontainers）が Docker を使う
        & {
            $PSNativeCommandUseErrorActionPreference = $false
            docker info --format '{{.ServerVersion}}' *> $null
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Desktop が動いていません。起動してから実行してください（サーバーのテストで使う）。"
        }
    }
    $ip = terraform -chdir=infra output -raw public_ip
    $dbHost = terraform -chdir=infra output -raw db_endpoint
    $dbSecret = terraform -chdir=infra output -raw db_secret_arn
    Write-Host "コミット $version を、EC2（$ip）に載せます"

    if ($Frontend) {
        Write-Step "画面を点検してビルドする"
        npm --prefix frontend run check
        npm --prefix frontend run build
    }
    if ($Backend) {
        Write-Step "サーバーを点検（テストを含む）してビルドする"
        .\backend\gradlew.bat -p backend check bootJar
    }

    Write-Step "EC2 に送る"
    ssh @sshOptions "ec2-user@$ip" "rm -rf $staging && mkdir -p $staging"
    scp @sshOptions deploy/ec2/install.sh deploy/ec2/start.sh deploy/ec2/taskmanagement.service deploy/ec2/nginx.conf "ec2-user@${ip}:$staging/"
    if ($Frontend) {
        scp @sshOptions -r frontend/dist "ec2-user@${ip}:$staging/"
    }
    if ($Backend) {
        scp @sshOptions backend/build/libs/taskmanagement-0.0.1-SNAPSHOT.jar "ec2-user@${ip}:$staging/app.jar"
    }

    Write-Step "EC2 で入れ替える"
    ssh @sshOptions "ec2-user@$ip" "sudo bash $staging/install.sh $staging $mode $version $dbHost $dbSecret"

    Write-Step "動いているか確かめる"
    $baseUrl = "http://$ip"
    # Spring Boot は起動に 10〜20 秒かかるので、60 秒まで待つ
    $deadline = (Get-Date).AddSeconds(60)
    while ($true) {
        try {
            $null = Invoke-WebRequest "$baseUrl/api/board" -UseBasicParsing -TimeoutSec 5
            break
        }
        catch {
            if ((Get-Date) -gt $deadline) {
                Write-Host "Spring Boot の起動の記録（最後の 30 行）:" -ForegroundColor Yellow
                ssh @sshOptions "ec2-user@$ip" "sudo journalctl -u taskmanagement -n 30 --no-pager"
                throw "/api/board が 60 秒たっても答えません。"
            }
            Start-Sleep -Seconds 3
        }
    }
    $page = Invoke-WebRequest "$baseUrl/" -UseBasicParsing -TimeoutSec 5
    Write-Host "画面: HTTP $($page.StatusCode)、API: 答えた"

    Write-Host ""
    Write-Host "デプロイが終わりました（コミット $version、$mode）。ブラウザで $baseUrl/ を開いて確かめてください。" -ForegroundColor Green
}
finally {
    Pop-Location
}
