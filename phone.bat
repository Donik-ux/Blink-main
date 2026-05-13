@echo off
chcp 65001 >nul
title Blink - Phone Mode
setlocal enabledelayedexpansion

echo.
echo ===========================================
echo    BLINK - ЗАПУСК ДЛЯ ТЕЛЕФОНА
echo ===========================================
echo.

:: 1. Очистка
echo [1/3] Закрываю старые процессы node...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

:: 2. Определяем LAN IP
echo [2/3] Определяю IP в локальной сети...
for /f "delims=" %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\get-lan-ip.ps1"') do set LAN_IP=%%i

if "!LAN_IP!"=="" set LAN_IP=localhost

:: 3. Проверяем firewall (без UAC — просто скажем что делать)
netsh advfirewall firewall show rule name="Blink Vite 5173" >nul 2>&1
set FW_OK=1
if %ERRORLEVEL% neq 0 set FW_OK=0

echo.
echo ===========================================
echo    ОТКРОЙ НА ТЕЛЕФОНЕ (тот же Wi-Fi):
echo.
echo      https://!LAN_IP!:5173
echo.
echo    1) Браузер покажет "сайт не защищён" —
echo       нажми "Дополнительно" / "Перейти".
echo    2) Разреши геолокацию + камеру + микро.
echo ===========================================
if !FW_OK!==0 (
    echo.
    echo [!] FIREWALL: правила для портов 5173/5000 не найдены.
    echo     Если телефон не открывает страницу — открой PowerShell
    echo     ОТ ИМЕНИ АДМИНИСТРАТОРА и выполни одной строкой:
    echo.
    echo     netsh advfirewall firewall add rule name="Blink Vite 5173" dir=in action=allow protocol=TCP localport=5173 ^&^& netsh advfirewall firewall add rule name="Blink Server 5000" dir=in action=allow protocol=TCP localport=5000
    echo.
)
echo.

echo [3/3] Запускаю сервер + клиент...
echo.
call npm run dev

echo.
echo Сервер остановлен. Нажми любую клавишу чтоб закрыть.
pause >nul
