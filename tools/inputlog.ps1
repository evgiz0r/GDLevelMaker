# tools/inputlog.ps1 -Out <file.csv> -Stop <flagfile>
# Logs the user's Geometry Dash inputs while a recording runs (started and stopped by tools/record.sh; only on
# the user's "record"): Space, Up, W and the left mouse button, down and up, ONLY while GeometryDash.exe is the
# foreground window. No other key, no text, nothing while another window is in front. Each line:
#   ms since the logger started (high-resolution), the wall-clock time (UTC, ISO), down|up, space|up|w|mouse
# The first line is a header with the start time, so the log lines up with the video (its name holds its start
# time; frame times are pts). Stops when the flag file appears. Written to local/inputs/ (never committed).
# Use: USE_CASES 29 -- replay the user's real runs in the sim (tools/replay_run.js), PHYSICS.md "Fidelity".
param([Parameter(Mandatory = $true)][string]$Out, [Parameter(Mandatory = $true)][string]$Stop)
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System; using System.Diagnostics; using System.IO; using System.Runtime.InteropServices; using System.Windows.Forms;
public static class GdInputLog {
  delegate IntPtr Proc(int code, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, Proc fn, IntPtr mod, uint tid);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string n);
  static Proc kp = KeyHook, mp = MouseHook; static IntPtr kh, mh; static StreamWriter log; static Stopwatch sw;
  static bool[] down = new bool[4]; static uint lastPid; static bool lastGd; static long lastCheck = -1000;
  static bool GdInFront() {
    long now = sw.ElapsedMilliseconds; if (now - lastCheck < 200) return lastGd;   // checked at most 5x a second
    lastCheck = now; uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    if (pid != lastPid) { lastPid = pid; try { lastGd = Process.GetProcessById((int)pid).ProcessName.ToLower() == "geometrydash"; } catch { lastGd = false; } }
    return lastGd;
  }
  static void Put(int k, bool isDown, string name) {
    if (down[k] == isDown) return;   // key repeat
    down[k] = isDown; if (!GdInFront()) return;
    log.WriteLine(string.Format("{0:F3},{1:o},{2},{3}", sw.Elapsed.TotalMilliseconds, DateTime.UtcNow, isDown ? "down" : "up", name)); log.Flush();
  }
  static IntPtr KeyHook(int code, IntPtr w, IntPtr l) {
    if (code >= 0) { int vk = Marshal.ReadInt32(l), msg = (int)w; bool d = msg == 0x100 || msg == 0x104, u = msg == 0x101 || msg == 0x105;
      if (d || u) { if (vk == 0x20) Put(0, d, "space"); else if (vk == 0x26) Put(1, d, "up"); else if (vk == 0x57) Put(2, d, "w"); } }
    return CallNextHookEx(kh, code, w, l);
  }
  static IntPtr MouseHook(int code, IntPtr w, IntPtr l) {
    if (code >= 0) { int msg = (int)w; if (msg == 0x201) Put(3, true, "mouse"); else if (msg == 0x202) Put(3, false, "mouse"); }
    return CallNextHookEx(mh, code, w, l);
  }
  public static void Run(string outFile, string stopFile) {
    sw = Stopwatch.StartNew(); log = new StreamWriter(outFile, true);
    log.WriteLine("# GD input log, started " + DateTime.UtcNow.ToString("o") + " UTC; ms,utc,down|up,key; only while GeometryDash.exe is in front"); log.Flush();
    IntPtr mod = GetModuleHandle(null); kh = SetWindowsHookEx(13, kp, mod, 0); mh = SetWindowsHookEx(14, mp, mod, 0);
    var t = new Timer(); t.Interval = 500; t.Tick += (s, e) => { if (File.Exists(stopFile)) Application.Exit(); }; t.Start();
    Application.Run();
    UnhookWindowsHookEx(kh); UnhookWindowsHookEx(mh); log.WriteLine("# stopped " + DateTime.UtcNow.ToString("o")); log.Close();
  }
}
"@
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[GdInputLog]::Run($Out, $Stop)
