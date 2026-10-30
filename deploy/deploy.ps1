#Requires -Version 7.3
<#
.SYNOPSIS
  EC2 にアプリを載せる・前の版に戻す（くわしくは deploy/ec2/README.md）。

.EXAMPLE
  .\deploy\deploy.ps1            # 画面とサーバーの両方
  .\deploy\deploy.ps1 -Frontend  # 画面だけ（nginx を読み直す。止まらない）
  .\deploy\deploy.ps1 -Backend   # サーバーだけ（Spring Boot を起動し直す。10 秒ほど止まる）
  .\deploy\deploy.ps1 -Rollback  # 前の版に戻す（-Frontend、-Backend で片方だけ）
#>
param(
    [switch]$Frontend,
    [switch]$Backend,
    # 前の版に戻す。もう一度実行すると、戻す前の版に戻る
    [switch]$Rollback,
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
# install.sh が「入れ替えたものが動かなかったので、前の版に戻した」ときの終わり方
$exitRolledBack = 3

function Write-Step([string]$message) {
    Write-Host ""
    Write-Host "== $message" -ForegroundColor Cyan
}

# EC2 で install.sh を動かし、終わり方（0、3 など）を返す。送ったファイルは片付ける
function Invoke-Install([string]$arguments) {
    & {
        $PSNativeCommandUseErrorActionPreference = $false
        # 表示は画面へ出し、この関数の返す値（終わり方）に混ぜない
        ssh @sshOptions "ec2-user@$ip" "sudo bash $staging/install.sh $arguments; rc=`$?; rm -rf $staging; exit `$rc" | Out-Host
    }
    return $LASTEXITCODE
}

Push-Location $root
try {
    $ip = terraform -chdir=infra output -raw public_ip

    if ($Rollback) {
        Write-Step "前の版に戻す（戻すもの: $mode）"
        ssh @sshOptions "ec2-user@$ip" "rm -rf $staging && mkdir -p $staging"
        scp @sshOptions deploy/ec2/install.sh "ec2-user@${ip}:$staging/"
        $rc = Invoke-Install "rollback $mode"
        if ($rc -ne 0) {
            throw "前の版に戻せませんでした（終わり方 $rc）。"
        }
    }
    else {
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

        Write-Step "EC2 で入れ替える（動かなければ、自動で前の版に戻す）"
        $rc = Invoke-Install "install $staging $mode $version $dbHost $dbSecret"
        if ($rc -eq $exitRolledBack) {
            throw "入れ替えたものが動かなかったので、前の版に戻しました。上の記録で原因を確かめてください。"
        }
        if ($rc -ne 0) {
            throw "EC2 での入れ替えに失敗しました（終わり方 $rc）。"
        }
    }

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
    $versions = ssh @sshOptions "ec2-user@$ip" "cat /opt/taskmanagement/version-frontend /opt/taskmanagement/version-backend"
    Write-Host "EC2 の版: 画面 $($versions[0])、サーバー $($versions[1])"

    Write-Host ""
    $done = if ($Rollback) { "前の版に戻しました（$mode）" } else { "デプロイが終わりました（コミット $version、$mode）" }
    Write-Host "$done。ブラウザで $baseUrl/ を開いて確かめてください。" -ForegroundColor Green
}
finally {
    Pop-Location
}
