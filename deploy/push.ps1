# F903·F904: 로컬(Windows)에서 이미지 빌드 후 Docker Hub 에 push
# 사용법: .\deploy\push.ps1 -User <DockerHubID> -Tag v1.0.0
#   사전에 docker login 을 한 번 실행해 두어야 합니다.
param(
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Tag
)
# docker 는 진행 로그를 stderr 로 출력하므로 Stop 대신 종료 코드($LASTEXITCODE)로 실패를 판단
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

$images = @(
  @{ Name = 'drive-log-web'; File = 'Dockerfile' },
  @{ Name = 'drive-log-api'; File = 'Dockerfile.api' }
)

foreach ($image in $images) {
  $repo = "$User/$($image.Name)"
  Write-Host "==> build $repo`:$Tag" -ForegroundColor Cyan
  docker build -f $image.File -t "$repo`:$Tag" -t "$repo`:latest" .
  if ($LASTEXITCODE -ne 0) { throw "build 실패: $repo" }

  Write-Host "==> push $repo`:$Tag / latest" -ForegroundColor Cyan
  docker push "$repo`:$Tag"
  if ($LASTEXITCODE -ne 0) { throw "push 실패 (docker login 확인): $repo" }
  docker push "$repo`:latest"
}

Write-Host "완료: https://hub.docker.com/u/$User" -ForegroundColor Green
