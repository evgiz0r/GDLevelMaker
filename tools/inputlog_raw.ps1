# tools/inputlog_raw.ps1 -Out <file.csv> -Stop <flagfile>
# The user's Geometry Dash inputs by Windows RAW INPUT, beside tools/inputlog.ps1's low-level hooks (both started and
# stopped by tools/record.sh, only on the user's "record"). Why a second logger (2026-11-24): the hook logger, even
# fixed, MISSED a real click in the user's Electroman run (02:33:44 recording, video 44.25 s: the cube jumps the second
# half-buried saw, gdsolver's plan presses there too, the log has nothing between 44.733 and 45.573): Windows skips a
# low-level hook whose thread does not answer in time (LowLevelHooksTimeout) -- the PC was running solver jobs. Raw
# input is never skipped: each event is queued to this process as a WM_INPUT message and read when the thread gets to
# it, and GetMessageTime() gives the time the event happened, not when it was read.
# Same lines and rules as inputlog.ps1: Space, Up, W and the left mouse button, down and up, ONLY while
# GeometryDash.exe is the foreground window; nothing else. Each line:
#   ms since the logger started, the wall-clock time (UTC, ISO), down|up, space|up|w|mouse
# (ms from GetMessageTime: 1 ms steps, ~10-16 ms granularity of the system tick on some PCs -- measured on the first
# recording with both loggers; tools/replay_run.js can take either file). Written to local/inputs/ (never committed).
param([Parameter(Mandatory = $true)][string]$Out, [Parameter(Mandatory = $true)][string]$Stop)
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System; using System.Diagnostics; using System.IO; using System.Threading; using System.Collections.Generic;
using System.Runtime.InteropServices; using System.Windows.Forms;
public class GdRawLog : NativeWindow {
  [StructLayout(LayoutKind.Sequential)] struct RAWINPUTDEVICE { public ushort usUsagePage, usUsage; public uint dwFlags; public IntPtr hwndTarget; }
  [StructLayout(LayoutKind.Sequential)] struct RAWINPUTHEADER { public uint dwType, dwSize; public IntPtr hDevice, wParam; }
  [DllImport("user32.dll")] static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] d, uint n, uint size);
  [DllImport("user32.dll")] static extern uint GetRawInputData(IntPtr h, uint cmd, IntPtr data, ref uint size, uint hsize);
  [DllImport("user32.dll")] static extern int GetMessageTime();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  const int WM_INPUT = 0x00FF; const uint RIDEV_INPUTSINK = 0x100, RID_INPUT = 0x10000003;
  StreamWriter log; Stopwatch sw; DateTime t0; int tick0; readonly bool[] isDown = new bool[4];
  static readonly string[] names = { "space", "up", "w", "mouse" }; readonly Dictionary<uint, bool> gd = new Dictionary<uint, bool>();
  string stop; System.Windows.Forms.Timer timer;
  public GdRawLog(string outFile, string stopFile) {
    stop = stopFile; log = new StreamWriter(outFile, true); sw = Stopwatch.StartNew(); t0 = DateTime.UtcNow; tick0 = Environment.TickCount;
    log.WriteLine("# GD input log (raw input), started " + t0.ToString("o") + " UTC; ms,utc,down|up,key; only while GeometryDash.exe is in front"); log.Flush();
    var cp = new CreateParams(); cp.Parent = new IntPtr(-3); CreateHandle(cp);   // a message-only window
    var devs = new RAWINPUTDEVICE[2];
    devs[0].usUsagePage = 1; devs[0].usUsage = 2; devs[0].dwFlags = RIDEV_INPUTSINK; devs[0].hwndTarget = Handle;   // mouse
    devs[1].usUsagePage = 1; devs[1].usUsage = 6; devs[1].dwFlags = RIDEV_INPUTSINK; devs[1].hwndTarget = Handle;   // keyboard
    if (!RegisterRawInputDevices(devs, 2, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)))) throw new Exception("RegisterRawInputDevices failed");
    timer = new System.Windows.Forms.Timer(); timer.Interval = 200; timer.Tick += (s, e) => { log.Flush(); if (File.Exists(stop)) { timer.Stop(); Application.Exit(); } }; timer.Start();
  }
  bool InGd() { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); bool v;
    if (!gd.TryGetValue(pid, out v)) { try { v = Process.GetProcessById((int)pid).ProcessName.ToLower() == "geometrydash"; } catch { v = false; } gd[pid] = v; } return v; }
  void Put(int k, bool d) {
    if (isDown[k] == d) return; isDown[k] = d;
    if (!InGd()) return;
    double ms = unchecked(GetMessageTime() - tick0);   // when the event happened (system tick ms), not when it was read
    log.WriteLine(string.Format("{0:F3},{1:o},{2},{3}", ms, t0.AddMilliseconds(ms), d ? "down" : "up", names[k]));
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == WM_INPUT) {
      uint size = 0, hs = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
      GetRawInputData(m.LParam, RID_INPUT, IntPtr.Zero, ref size, hs);
      IntPtr buf = Marshal.AllocHGlobal((int)size);
      try {
        if (GetRawInputData(m.LParam, RID_INPUT, buf, ref size, hs) == size) {
          uint type = (uint)Marshal.ReadInt32(buf, 0); int off = (int)hs;
          if (type == 0) {   // mouse: RAWMOUSE.usButtonFlags at +4 (after usFlags + padding)
            ushort bf = (ushort)Marshal.ReadInt16(buf, off + 4);
            if ((bf & 0x1) != 0) Put(3, true); if ((bf & 0x2) != 0) Put(3, false);
          } else if (type == 1) {   // keyboard: RAWKEYBOARD MakeCode +0, Flags +2, Reserved +4, VKey +6
            ushort fl = (ushort)Marshal.ReadInt16(buf, off + 2), vk = (ushort)Marshal.ReadInt16(buf, off + 6); bool d = (fl & 1) == 0;
            if (vk == 0x20) Put(0, d); else if (vk == 0x26) Put(1, d); else if (vk == 0x57) Put(2, d);
          }
        }
      } finally { Marshal.FreeHGlobal(buf); }
    }
    base.WndProc(ref m);
  }
  public void Close() { log.WriteLine("# stopped " + DateTime.UtcNow.ToString("o")); log.Close(); DestroyHandle(); }
  public static void Run(string outFile, string stopFile) { var g = new GdRawLog(outFile, stopFile); Application.Run(); g.Close(); }
}
"@
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[System.Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'High'
[GdRawLog]::Run($Out, $Stop)
