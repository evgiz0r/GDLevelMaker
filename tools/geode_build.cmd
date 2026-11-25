@echo off
rem Usage: tools\geode_build.cmd [mod dir, default mods\gdlm-probe] [--install]
rem Builds a Geode mod on this PC without the Geode CLI (Smart App Control blocks geode.exe): VS 2022 Build Tools
rem env + clang-cl + Ninja, GEODE_SDK=C:\Users\evgbo\geode-sdk (v6.0.0 + bin\6.0.0), build dir outside OneDrive,
rem then tools\geode_pack.js makes the .geode (and installs it with --install, only while GD is closed). GEODE.md.
setlocal
set ROOT=%~dp0..
set MOD=%~1
if "%MOD%"=="" set MOD=%ROOT%\mods\gdlm-probe
if "%MOD%"=="--install" set MOD=%ROOT%\mods\gdlm-probe
for %%I in ("%MOD%") do set NAME=%%~nxI
set BUILD=%USERPROFILE%\geode-build\%NAME%
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
if not defined GEODE_SDK set GEODE_SDK=%USERPROFILE%\geode-sdk
set PATH=C:\Program Files\CMake\bin;%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%
cmake -S "%MOD%" -B "%BUILD%" -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo ^
  -DCMAKE_C_COMPILER="C:/Program Files/LLVM/bin/clang-cl.exe" -DCMAKE_CXX_COMPILER="C:/Program Files/LLVM/bin/clang-cl.exe" ^
  -DCMAKE_LINKER="C:/Program Files/LLVM/bin/lld-link.exe" -DGEODE_DISABLE_CLI_CALLS=ON || exit /b 1
cmake --build "%BUILD%" --config RelWithDebInfo || exit /b 1
set INST=
echo %* | findstr /c:"--install" >nul && set INST=--install
for %%D in ("%BUILD%\*.dll") do node "%ROOT%\tools\geode_pack.js" "%MOD%" "%%D" %INST%
