# 错笺 CuoJian 启动器（Windows）
# 由 启动.cmd 调用。设计原则：任何一步失败都停下来、把原因留在窗口里，
# 绝不允许「闪一下就消失」——调用方会在退出码非 0 时 pause。
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Stop-WithMessage {
    param([string]$Message)
    Write-Host ''
    Write-Host ("  [错笺] " + $Message) -ForegroundColor Red
    Write-Host ''
    Read-Host '  按回车键关闭窗口' | Out-Null
    exit 1
}

Write-Host ''
Write-Host '  错笺 CuoJian —— 本地错题本' -ForegroundColor Cyan
Write-Host '  --------------------------------------' -ForegroundColor DarkGray
Write-Host ''

# 1) 找 Node：先 PATH，再常见安装位置
$nodeExe = $null
$fromPath = Get-Command node.exe -ErrorAction SilentlyContinue
if ($fromPath) { $nodeExe = $fromPath.Source }
if (-not $nodeExe) {
    $candidates = @(
        'D:\node.js\node.exe',
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { $nodeExe = $candidate; break }
    }
}

if (-not $nodeExe) {
    Write-Host '  这台电脑没找到 Node.js。' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  两个办法，选一个：'
    Write-Host ''
    Write-Host '    A. 不装环境，直接用在线版（推荐，点开就能用）：' -ForegroundColor Green
    Write-Host '       https://wei238982377.github.io/cuojian/'
    Write-Host ''
    Write-Host '    B. 想在本机跑，先装 Node.js 18 或更高版本：'
    Write-Host '       https://nodejs.org/zh-cn/download'
    Write-Host '       装完再双击 启动.cmd。'
    Write-Host ''
    Read-Host '  按回车键关闭窗口' | Out-Null
    exit 1
}

$nodeDir = Split-Path -Parent $nodeExe
$env:Path = "$nodeDir;$env:Path"
$npmCmd = Join-Path $nodeDir 'npm.cmd'
if (-not (Test-Path $npmCmd)) {
    Stop-WithMessage ("找到了 node，但同目录没有 npm.cmd：" + $npmCmd)
}

$nodeVersion = & $nodeExe --version
Write-Host ("  Node: " + $nodeVersion + "  (" + $nodeExe + ")") -ForegroundColor DarkGray
Write-Host ("  目录: " + $root) -ForegroundColor DarkGray

# 2) 第一次运行：没有 node_modules 就装依赖（需要联网）
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host ''
    Write-Host '  第一次运行，正在安装依赖，需要联网，大约 1-3 分钟……' -ForegroundColor Cyan
    Write-Host ''
    & $npmCmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '  依赖安装失败。常见原因：网络不稳、公司代理拦截 npm、磁盘空间不足。' -ForegroundColor Red
        Write-Host '  把窗口内容截图发我就能定位。'
        Read-Host '  按回车键关闭窗口' | Out-Null
        exit 1
    }
}

# 3) 启动开发服务器，并自动打开浏览器
Write-Host ''
Write-Host '  正在启动…… 浏览器会自动打开 http://127.0.0.1:5173/' -ForegroundColor Green
Write-Host '  用完直接关掉这个窗口即可停止服务。'
Write-Host ''
try {
    & $npmCmd run dev -- --port 5173 --strictPort --host 127.0.0.1 --open
} catch {
    Write-Host ''
    Write-Host ('  启动失败：' + $_.Exception.Message) -ForegroundColor Red
    Read-Host '  按回车键关闭窗口' | Out-Null
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '  启动失败。最常见的原因：' -ForegroundColor Red
    Write-Host '    1) 5173 端口被占用 —— 先关掉之前那个黑窗口，再双击本文件；'
    Write-Host '    2) 依赖没装好 —— 删掉 node_modules 文件夹，再双击一次。'
    Write-Host ''
    Read-Host '  按回车键关闭窗口' | Out-Null
    exit 1
}
