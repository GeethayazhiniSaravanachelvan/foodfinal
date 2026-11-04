@echo off
title MongoDB Atlas Password Configuration
cd /d "%~dp0backend"
node setAtlasPassword.js
pause
