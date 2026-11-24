# tools/inputlog.ps1 -- logs the user's GD inputs while recording (started/stopped by tools/record.sh).
# Only space, up arrow, W and the left mouse button, and only while Geometry Dash is the foreground window.
# No other keys, no text. One line per change: "<unix ms> <down|up> <key>". Polls every ~1 ms.
# The user asked for it (2026-11-24: "record, with inputs from now on"). Output: next to the videos.
param([string]$Out, [string]$Stop)
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class GdKeys {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint p);
}
"@
[GdKeys]::timeBeginPeriod(1) | Out-Null
$keys = @{ 0x20 = "space"; 0x26 = "up"; 0x57 = "w"; 0x01 = "mouse" }
$state = @{}; foreach ($k in $keys.Keys) { $state[$k] = $false }
$w = [System.IO.StreamWriter]::new($Out, $true); $w.AutoFlush = $true
$w.WriteLine("# GD inputs, unix ms, started " + [DateTimeOffset]::Now.ToString("o"))
$gdPid = 0; $lastPidCheck = 0
while (-not (Test-Path $Stop)) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ($now - $lastPidCheck -gt 2000) { $p = Get-Process GeometryDash -ErrorAction SilentlyContinue; $gdPid = if ($p) { $p[0].Id } else { 0 }; $lastPidCheck = $now }
  $fg = 0; [void][GdKeys]::GetWindowThreadProcessId([GdKeys]::GetForegroundWindow(), [ref]$fg)
  $inGd = ($gdPid -ne 0 -and $fg -eq $gdPid)
  foreach ($k in $keys.Keys) {
    $down = $inGd -and (([GdKeys]::GetAsyncKeyState($k) -band 0x8000) -ne 0)
    if ($down -ne $state[$k]) { $state[$k] = $down; $w.WriteLine("$now " + ($(if ($down) { "down" } else { "up" })) + " " + $keys[$k]) }
  }
  Start-Sleep -Milliseconds 1
}
$w.WriteLine("# stopped " + [DateTimeOffset]::Now.ToString("o")); $w.Close()
