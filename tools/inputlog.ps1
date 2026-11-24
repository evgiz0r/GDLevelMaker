# tools/inputlog.ps1 -Out <file.csv> -Stop <flagfile>
# Logs the user's Geometry Dash inputs while a recording runs (started and stopped by tools/record.sh; only on
# the user's "record"): Space, Up, W and the left mouse button, down and up, ONLY while GeometryDash.exe is the
# foreground window. No other key, no text, nothing while another window is in front. Each line:
#   ms since the logger started (high-resolution), the wall-clock time (UTC, ISO), down|up, space|up|w|mouse
# The first line is a header with the start time, so the log lines up with the video (its name holds its start
# time; frame times are pts). Stops when the flag file appears. Written to local/inputs/ (never committed).
# Use: USE_CASES 29 -- replay the user's real runs in the sim (tools/replay_run.js), PHYSICS.md "Fidelity".
# INPUT LATENCY (2026-11-24, after "a spike killed me, probably we are running something"): a low-level hook
# runs inside every key and click of the whole system, so its callback does almost nothing -- reads the clock,
# the foreground window's process id and the key, puts them in a queue, returns. A writer thread does the rest
# (process-name lookup, cached; filtering; the file). The first version wrote and flushed the file and could
# look up a process inside the callback.
param([Parameter(Mandatory = $true)][string]$Out, [Parameter(Mandatory = $true)][string]$Stop)
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System; using System.Diagnostics; using System.IO; using System.Threading; using System.Collections.Generic;
using System.Collections.Concurrent; using System.Runtime.InteropServices; using System.Windows.Forms;
public static class GdInputLog {
  delegate IntPtr Proc(int code, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, Proc fn, IntPtr mod, uint tid);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string n);
  struct Ev { public double ms; public long utcTicks; public bool down; public int key; public uint pid; }
  static Proc kp = KeyHook, mp = MouseHook; static IntPtr kh, mh; static Stopwatch sw; static DateTime t0;
  static readonly ConcurrentQueue<Ev> q = new ConcurrentQueue<Ev>(); static readonly bool[] isDown = new bool[4];
  static readonly string[] names = { "space", "up", "w", "mouse" };
  // the callback: clock, foreground pid, key -> queue. Nothing else.
  static void Put(int k, bool d) {
    if (isDown[k] == d) return; isDown[k] = d;
    uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    double ms = sw.Elapsed.TotalMilliseconds;
    q.Enqueue(new Ev { ms = ms, utcTicks = t0.Ticks + (long)(ms * 10000), down = d, key = k, pid = pid });
  }
  static IntPtr KeyHook(int code, IntPtr w, IntPtr l) {
    if (code >= 0) { int vk = Marshal.ReadInt32(l), msg = (int)w; bool d = msg == 0x100 || msg == 0x104, u = msg == 0x101 || msg == 0x105;
      if (d || u) { if (vk == 0x20) Put(0, d); else if (vk == 0x26) Put(1, d); else if (vk == 0x57) Put(2, d); } }
    return CallNextHookEx(kh, code, w, l);
  }
  static IntPtr MouseHook(int code, IntPtr w, IntPtr l) {
    if (code >= 0) { int msg = (int)w; if (msg == 0x201) Put(3, true); else if (msg == 0x202) Put(3, false); }
    return CallNextHookEx(mh, code, w, l);
  }
  // the writer: off the input path
  static void Writer(object o) {
    var a = (object[])o; var log = (StreamWriter)a[0]; var stop = (string)a[1]; var gd = new Dictionary<uint, bool>();
    while (true) {
      Ev e; bool any = false;
      while (q.TryDequeue(out e)) {
        bool isGd; if (!gd.TryGetValue(e.pid, out isGd)) { try { isGd = Process.GetProcessById((int)e.pid).ProcessName.ToLower() == "geometrydash"; } catch { isGd = false; } gd[e.pid] = isGd; }
        if (!isGd) continue;
        log.WriteLine(string.Format("{0:F3},{1:o},{2},{3}", e.ms, new DateTime(e.utcTicks, DateTimeKind.Utc), e.down ? "down" : "up", names[e.key])); any = true;
      }
      if (any) log.Flush();
      if (File.Exists(stop)) { Application.Exit(); return; }
      Thread.Sleep(50);
    }
  }
  public static void Run(string outFile, string stopFile) {
    sw = Stopwatch.StartNew(); t0 = DateTime.UtcNow; var log = new StreamWriter(outFile, true);
    log.WriteLine("# GD input log, started " + t0.ToString("o") + " UTC; ms,utc,down|up,key; only while GeometryDash.exe is in front"); log.Flush();
    IntPtr mod = GetModuleHandle(null); kh = SetWindowsHookEx(13, kp, mod, 0); mh = SetWindowsHookEx(14, mp, mod, 0);
    var th = new Thread(Writer); th.IsBackground = true; th.Start(new object[] { log, stopFile });
    Application.Run();
    UnhookWindowsHookEx(kh); UnhookWindowsHookEx(mh);
    Ev e; while (q.TryDequeue(out e)) { }   // whatever came after the stop
    log.WriteLine("# stopped " + DateTime.UtcNow.ToString("o")); log.Close();
  }
}
"@
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[GdInputLog]::Run($Out, $Stop)
