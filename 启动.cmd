@echo off
chcp 65001 >nul
title 错笺 CuoJian · 开发服务器
setlocal
cd /d "%~dp0"

echo.
echo  错笺 CuoJian —— 本地错题本
echo  --------------------------------------
echo.

rem 1) 找 Node：优先系统 PATH，再找常见的安装目录（例如 D:\node.js）
set "NODE_EXE="
for %%P in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%~$PATH:P"
if not defined NODE_EXE if exist "D:\node.js\node.exe" set "NODE_EXE=D:\node.js\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo  [错笺] 没找到 Node.js。
  echo         请先安装 Node.js 18 或更高版本：https://nodejs.org/
  echo         装好后重新双击本文件。
  echo.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%NPM_CMD%" (
  echo  [错笺] 找到了 node，但同目录下没有 npm.cmd。
  echo         期望路径：%NPM_CMD%
  echo.
  pause
  exit /b 1
)

rem 2) 第一次运行：没有 node_modules 就装依赖（需要联网）
if not exist "node_modules\" (
  echo  [错笺] 第一次运行，正在安装依赖，需要联网，大约 1-3 分钟……
  echo.
  call "%NPM_CMD%" install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [错笺] 依赖安装失败，把上面的报错发给我就行。
    pause
    exit /b 1
  )
)

rem 3) 启动开发服务器，并自动打开浏览器
echo  [错笺] 正在启动…… 浏览器会自动打开 http://127.0.0.1:5173/
echo         用完直接关掉这个黑色窗口即可停止服务。
echo.
call "%NPM_CMD%" run dev -- --port 5173 --strictPort --open

if errorlevel 1 (
  echo.
  echo  [错笺] 启动失败。最常见的原因是 5173 端口被占用：
  echo         先关掉之前那个黑色窗口，再双击本文件。
  echo.
  pause
)

endlocal
