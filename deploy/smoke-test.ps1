#Requires -Version 7.3
<#
.SYNOPSIS
  EC2 のアプリが、ブラウザと同じ経路（nginx の 80 番）で動いているか確かめる（くわしくは deploy/ec2/README.md）。
  確認用のカードを追加・編集・移動・削除する。確認用のカードは、途中で失敗しても必ず消す。

.EXAMPLE
  .\deploy\smoke-test.ps1
#>
param(
    # 確かめる URL。指定がなければ terraform output の app_url
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'

if (-not $BaseUrl) {
    $infra = Join-Path (Split-Path -Parent $PSScriptRoot) 'infra'
    $BaseUrl = terraform "-chdir=$infra" output -raw app_url
}
$BaseUrl = $BaseUrl.TrimEnd('/')
$results = [System.Collections.Generic.List[object]]::new()

# 1 つの確認を動かし、結果を表に足す。失敗したら、そこで止める
function Test-Step([string]$name, [scriptblock]$check) {
    try {
        $detail = & $check
        $results.Add([pscustomobject]@{ 結果 = 'OK'; 確かめたこと = $name; 内容 = $detail })
    }
    catch {
        $results.Add([pscustomobject]@{ 結果 = 'NG'; 確かめたこと = $name; 内容 = $_.Exception.Message })
        throw
    }
}

function Invoke-Http([string]$method, [string]$path, $body) {
    $params = @{ Uri = "$BaseUrl$path"; Method = $method; UseBasicParsing = $true; TimeoutSec = 10 }
    if ($null -ne $body) {
        $params.ContentType = 'application/json; charset=utf-8'
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json))
    }
    Invoke-WebRequest @params
}

# 返事の本文を UTF-8 として読む（日本語が化けないように）
function Get-Text($response) {
    [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
}

function Get-Board {
    # 期限（2026-10-15 など）を日付の型に変えず、文字のまま読む
    Get-Text (Invoke-Http GET /api/board) | ConvertFrom-Json -AsHashtable -DateKind String
}

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) {
        throw $message
    }
}

$cardId = [guid]::NewGuid().ToString()
$title = "動作確認 $(Get-Date -Format 'yyyyMMdd-HHmmss')"
$created = $false
$failed = $false

Write-Host "確かめる先: $BaseUrl"
try {
    Test-Step '画面（/）が返る' {
        $res = Invoke-Http GET /
        $script:html = Get-Text $res
        $pageTitle = [regex]::Match($html, '<title>(.*?)</title>').Groups[1].Value
        Assert-True ($pageTitle -eq 'タスク管理') "題名が「$pageTitle」でした"
        "HTTP $($res.StatusCode)、題名「$pageTitle」"
    }

    Test-Step '画面が読む JavaScript が返る' {
        $src = [regex]::Match($html, '<script[^>]+src="([^"]+)"').Groups[1].Value
        Assert-True ([bool]$src) 'index.html に JavaScript が見つかりません'
        $res = Invoke-Http GET $src
        "HTTP $($res.StatusCode)、$src"
    }

    Test-Step 'ボードを読み込める（GET /api/board）' {
        $board = Get-Board
        foreach ($key in 'todo', 'doing', 'done') {
            Assert-True $board.columns.ContainsKey($key) "カラム $key がありません"
        }
        "カードは $($board.cards.Count) 枚"
    }

    Test-Step 'カードを追加できる（POST /api/cards）' {
        $res = Invoke-Http POST /api/cards @{
            id        = $cardId
            columnKey = 'todo'
            title     = $title
            memo      = 'smoke-test.ps1 が作った確認用のカード'
            dueDate   = $null
            priority  = 'medium'
        }
        $script:created = $true
        Assert-True ($res.StatusCode -eq 201) "HTTP $($res.StatusCode) でした"
        "HTTP 201、「$title」"
    }

    Test-Step '追加したカードが保存されている' {
        $board = Get-Board
        Assert-True ($board.columns.todo -contains $cardId) '未着手のカラムにありません'
        Assert-True ($board.cards[$cardId].title -eq $title) "題名が「$($board.cards[$cardId].title)」でした"
        '未着手に入り、日本語の題名もそのまま'
    }

    Test-Step 'カードを編集できる（PUT /api/cards/{id}）' {
        $dueDate = (Get-Date).AddDays(7).ToString('yyyy-MM-dd')
        $null = Invoke-Http PUT "/api/cards/$cardId" @{
            title     = "$title（編集）"
            memo      = '編集した'
            dueDate   = $dueDate
            priority  = 'high'
            columnKey = 'todo'
        }
        $card = (Get-Board).cards[$cardId]
        Assert-True ($card.title -eq "$title（編集）") "題名が「$($card.title)」でした"
        Assert-True ($card.dueDate -eq $dueDate -and $card.priority -eq 'high') '期限か優先度が変わっていません'
        "題名、期限（$dueDate）、優先度が変わった"
    }

    Test-Step 'カードを別のカラムへ移せる（PUT /api/cards/{id}/position）' {
        $res = Invoke-Http PUT "/api/cards/$cardId/position" @{ columnKey = 'doing'; position = 0 }
        $board = Get-Board
        Assert-True ($board.columns.doing -contains $cardId) '作業中のカラムにありません'
        Assert-True ($board.columns.todo -notcontains $cardId) '未着手のカラムに残っています'
        "HTTP $($res.StatusCode)、未着手 → 作業中"
    }

    Test-Step 'カードを削除できる（DELETE /api/cards/{id}）' {
        $res = Invoke-Http DELETE "/api/cards/$cardId"
        $script:created = $false
        $board = Get-Board
        Assert-True (-not $board.cards.ContainsKey($cardId)) '削除したカードが残っています'
        "HTTP $($res.StatusCode)、ボードから消えた"
    }
}
catch {
    $failed = $true
}
finally {
    # 途中で失敗しても、確認用のカードを残さない
    if ($created) {
        try {
            $null = Invoke-Http DELETE "/api/cards/$cardId"
            Write-Host "確認用のカードを消しました" -ForegroundColor Yellow
        }
        catch {
            Write-Host "確認用のカード（$cardId）を消せませんでした。画面から消してください" -ForegroundColor Red
        }
    }
}

$results | Format-Table -AutoSize -Wrap | Out-Host
if ($failed) {
    throw "動作確認に失敗しました（NG の行を見てください）。"
}
Write-Host "動作確認がすべて通りました。" -ForegroundColor Green
