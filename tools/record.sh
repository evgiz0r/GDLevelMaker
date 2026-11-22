#!/usr/bin/env bash
# tools/record.sh start|stop  -- records the whole screen to Videos/Captures/GD claude-rec <time>.mkv
# Uses Desktop Duplication (ddagrab): the whole screen, so it keeps recording whatever is shown.
# Never delete a recording without asking; check frames all through it, not only first and last.
# mkv, so a hard stop (taskkill) still leaves a playable file. Run "start" in the background.
FF="${FFMPEG:-$(command -v ffmpeg || echo /c/Users/$USERNAME/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin/ffmpeg.exe)}"
OUT="${CAPTURES:-$HOME/Videos/Captures}"
case "$1" in
  start) exec "$FF" -y -hide_banner -loglevel error -f lavfi -i ddagrab=output_idx=0:framerate=60 \
           -vf hwdownload,format=bgra -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p \
           "$OUT/GD claude-rec $(date +%Y-%m-%d_%H-%M-%S).mkv" ;;
  stop) taskkill //IM ffmpeg.exe //F ;;
  *) echo "usage: tools/record.sh start|stop" ;;
esac
