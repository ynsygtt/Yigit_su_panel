@echo off
REM MongoDB PATH'e Ekle (Windows)
REM Yönetici olarak çalıştırılması gerekir!

REM MongoDB'nin yolunu bul
for /f "tokens=*" %%A in ('where mongod 2^>nul') do set "MONGO_PATH=%%A"

if defined MONGO_PATH (
    REM Yolu bin klasöründen önceki bölüme trunka et
    for %%F in ("%MONGO_PATH%") do set "MONGO_BIN=%%~dpF"
    
    echo.
    echo ===================================
    echo MongoDB PATH Kurulumu
    echo ===================================
    echo.
    echo Bulunan MongoDB Yolu: %MONGO_BIN%
    echo.
    
    REM Mevcut PATH'i kontrol et
    setx PATH "%PATH%;%MONGO_BIN%"
    
    echo ✅ MongoDB PATH'e eklendi!
    echo.
    echo 💡 Not: Yeni PowerShell veya CMD penceresi açıp test etmek gerekir.
    echo.
    echo Testi yapılması gereken komut:
    echo   mongod --version
    echo.
    pause
) else (
    echo.
    echo ❌ MongoDB bulunamadı!
    echo.
    echo Lütfen MongoDB'yi ilk olarak kurun:
    echo https://www.mongodb.com/try/download/community
    echo.
    pause
)
