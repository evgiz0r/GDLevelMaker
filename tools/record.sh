#!/usr/bin/env bash
# tools/record.sh start|stop  -- records the whole screen to Videos/Captures/GD claude-rec <time>.mkv,
# and the user's GD inputs to GD claude-inputs <time>.log (tools/inputlog.ps1: unix ms, down/up, key)
# Uses Desktop Duplication (ddagrab): the whole screen, so it keeps recording whatever is shown.
# Windows drops the duplication ("AcquireNextFrame failed: 887a0026", access lost) whenever a game
# goes fullscreen or the display mode changes, so "start" restarts the capture in a loop, a new
# file each time, until "stop". Run "start" in the background.
# Never delete a recording without asking; check frames all through it, not only first and last.
# mkv, so a hard stop (taskkill) still leaves a playable file.
FF="${FFMPEG:-$(command -v ffmpeg || echo /c/Users/$USERNAME/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin/ffmpeg.exe)}"
OUT="${CAPTURES:-$HOME/Videos/Captures}"
FLAG="$OUT/.gd-record-stop"
case "$1" in
  start)
    rm -f "$FLAG" "$OUT/.gd-input-stop"
    # the user's GD inputs (space/up/W/left click, only while GD is in front), for replaying real runs (USE_CASES 29)
    powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$(cygpath -w "$(dirname "$0")/inputlog.ps1")"       -Out "$(cygpath -w "$OUT")\GD claude-inputs $(date +%Y-%m-%d_%H-%M-%S).log" -Stop "$(cygpath -w "$OUT/.gd-input-stop")" &
    while [ ! -f "$FLAG" ]; do
      "$FF" -y -hide_banner -loglevel error -f lavfi -i ddagrab=output_idx=0:framerate=60 \
        -vf hwdownload,format=bgra -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p \
        "$OUT/GD claude-rec $(date +%Y-%m-%d_%H-%M-%S).mkv"
      [ -f "$FLAG" ] || sleep 1
    done
    rm -f "$FLAG" ;;
  stop) touch "$FLAG" "$OUT/.gd-input-stop"; taskkill //IM ffmpeg.exe //F ;;
  *) echo "usage: tools/record.sh start|stop" ;;
esac
