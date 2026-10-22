# 이 PC 를 서버로: 프로덕션 서버와 Cloudflare 임시 터널을 한 번에 띄우고 공개 주소를 출력한다.
#
#   npm run serve            빌드가 없으면 빌드하고, 서버(3000) + 터널을 띄운다
#   npm run serve -- -Build  빌드를 다시 하고 띄운다 (코드를 고친 뒤)
#   npm run serve -- -Port 3100
#
# Ctrl+C 를 누르면 둘 다 같이 끕니다. 주소는 터널을 켤 때마다 바뀝니다.
# cloudflared 가 없으면:  winget install --id Cloudflare.cloudflared -e

param(
  [int]$Port = 3000,
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# cloudflared 찾기 (PATH → winget 기본 설치 위치)
$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) {
  foreach ($p in @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")) {
    if (Test-Path $p) { $cloudflared = $p; break }
  }
}
if (-not $cloudflared) {
  Write-Host "cloudflared 가 없습니다. 먼저 설치하세요:  winget install --id Cloudflare.cloudflared -e" -ForegroundColor Red
  exit 1
}

if ($Build -or -not (Test-Path ".next\BUILD_ID")) {
  Write-Host "빌드 중…" -ForegroundColor DarkGray
  npx next build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

New-Item -ItemType Directory -Force "data\logs" | Out-Null
$serverLog = Join-Path $root "data\logs\server.log"
$tunnelLog = Join-Path $root "data\logs\tunnel.log"
Remove-Item $tunnelLog -ErrorAction SilentlyContinue

$server = Start-Process -FilePath "npx.cmd" -ArgumentList "next", "start", "-p", "$Port" `
  -RedirectStandardOutput $serverLog -RedirectStandardError (Join-Path $root "data\logs\server.err.log") `
  -NoNewWindow -PassThru
$tunnel = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://localhost:$Port" `
  -RedirectStandardOutput (Join-Path $root "data\logs\tunnel.out.log") -RedirectStandardError $tunnelLog `
  -NoNewWindow -PassThru

try {
  # 서버가 뜰 때까지
  $up = $false
  for ($i = 0; $i -lt 30 -and -not $up; $i++) {
    Start-Sleep -Seconds 1
    try { $up = (Invoke-WebRequest "http://localhost:$Port/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
    if ($server.HasExited) { Write-Host "서버가 바로 종료됐습니다. data\logs\server.err.log 를 보세요." -ForegroundColor Red; exit 1 }
  }

  # 터널 주소가 로그에 찍힐 때까지
  $url = $null
  for ($i = 0; $i -lt 30 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
    if ($tunnel.HasExited) { Write-Host "터널이 바로 종료됐습니다. data\logs\tunnel.log 를 보세요." -ForegroundColor Red; exit 1 }
  }

  Write-Host ""
  Write-Host "  로컬 주소:  http://localhost:$Port" -ForegroundColor DarkGray
  if ($url) {
    Write-Host "  공개 주소:  $url" -ForegroundColor Green
    try { Set-Clipboard -Value $url; Write-Host "  (클립보드에 복사했습니다)" -ForegroundColor DarkGray } catch {}
    Write-Host ""
    Write-Host "  처음 1분은 DNS 가 퍼지기 전이라 '주소를 찾을 수 없음' 이 날 수 있습니다. 잠시 뒤 다시 여세요." -ForegroundColor DarkGray
  } else {
    Write-Host "  터널 주소를 아직 못 찾았습니다. data\logs\tunnel.log 를 확인하세요." -ForegroundColor Yellow
  }
  Write-Host "  끄려면 Ctrl+C" -ForegroundColor DarkGray
  Write-Host ""

  # 둘 중 하나가 죽을 때까지 대기
  while (-not $server.HasExited -and -not $tunnel.HasExited) { Start-Sleep -Seconds 2 }
  if ($server.HasExited) { Write-Host "서버가 종료됐습니다." -ForegroundColor Yellow }
  if ($tunnel.HasExited) { Write-Host "터널이 종료됐습니다." -ForegroundColor Yellow }
} finally {
  foreach ($p in @($server, $tunnel)) {
    if ($p -and -not $p.HasExited) {
      # npx.cmd 는 자식 node 를 남기므로 트리째 끝낸다
      & taskkill /PID $p.Id /T /F 2>$null | Out-Null
    }
  }
}
