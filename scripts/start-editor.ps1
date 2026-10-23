$ErrorActionPreference = 'Stop'
$editorRoot = Split-Path -Parent $PSScriptRoot
$editorExe = Join-Path $editorRoot 'node_modules\electron\dist\electron.exe'
$editorEntry = Join-Path $editorRoot 'desktop\main.mjs'
if (!(Test-Path -LiteralPath $editorExe)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('최초 설치가 필요합니다. Node 22.12 이상에서 npm ci 후 npx install-electron --no를 실행하세요.', '페이저 화면 에디터') | Out-Null
    exit 1
}
# 사용자가 요청한 에디터 창만 표시하며 터미널은 별도로 열지 않습니다.
$env:ELECTRON_RUN_AS_NODE = $null
Start-Process -FilePath $editorExe -ArgumentList ('"' + $editorEntry + '"') -WorkingDirectory $editorRoot
