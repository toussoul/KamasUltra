@echo off
rem Lance KamasUltra en local (Windows) : ouvre http://127.0.0.1:8765/
cd /d "%~dp0"
where py >nul 2>nul && (py serveur.py %*) || (python serveur.py %*)
pause
