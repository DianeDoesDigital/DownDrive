@echo off
title DownDrive Server
color 0D

echo ==============================================
echo           Starting DownDrive by DRGM.DEV
echo ==============================================
echo.
echo Checking and installing background requirements...
pip install Flask yt-dlp --upgrade -q

echo.
echo Launching the server Engine...
echo ==============================================
echo [SUCCESS] DownDrive is fully operational!
echo.
echo PLEASE LEAVE THIS BLACK WINDOW OPEN.
echo.
echo Open your web browser and type: http://localhost:5000
echo ==============================================
echo.

python app.py
pause
