@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 iniciar_demo.py --open
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo Necesitas Python 3 para iniciar esta demo. Instala Python desde python.org.
    ) else (
        python iniciar_demo.py --open
    )
)
pause
