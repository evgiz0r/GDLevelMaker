// The key bot: plays a level's solver clicks in the user's real, unmodded game by pressing Space.
// Started by tools/bot.js (through Windows PowerShell's Add-Type, so nothing has to be installed).
//
// How it keeps time: it watches the game window (ffmpeg's Desktop Duplication grabber, a strip at the
// ground -- plain GDI grabs of fullscreen GD come back frozen), sees
// the lime cube slide in from the left at the start of each attempt -- the camera stands still for
// the first ~0.2 s, so the cube's screen x is a straight line in time -- and fits that line to get
// the attempt's tick 0. It then presses and releases Space at tick/240 s after it. The lag between
// what it sees and what the game does (display + input latency) is measured from the cube's first
// ground jumps (it starts rising later than planned by exactly that lag) and corrected from the next
// attempt on. A death shows up as the cube coming back in from the left: it starts again, up to
// the attempt limit. Facts used: 1 unit = window height / 320 px; the camera's left edge starts at
// level x = 15.4 (measured on a recording of GDLM 42); 1x speed = 311.58 units/s.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public static class KeyBot {
    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc, ref BITMAPINFO bmi, uint usage, out IntPtr bits, IntPtr sec, uint off);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dst, int x, int y, int w, int h, IntPtr src, int sx, int sy, uint rop);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr o);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("winmm.dll")] static extern uint timeBeginPeriod(uint ms);

    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct BITMAPINFO { public int size, w, h; public short planes, bits; public int comp, img, xppm, yppm, used, imp; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit, Size = 40)] struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public KEYBDINPUT ki; }

    const double UNITS_PER_S = 311.58, CAM_X0 = 15.4;
    static Stopwatch clock = Stopwatch.StartNew();
    static double Now() { return clock.ElapsedTicks / (double)Stopwatch.Frequency; }

    static void Key(bool down) {
        var a = new INPUT[1];
        a[0].type = 1; a[0].ki.vk = 0x20; a[0].ki.scan = 0x39; a[0].ki.flags = down ? 0u : 2u; // Space
        SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
    }

    // ---- watching the screen ----
    static IntPtr hwnd; static int gx, gy, gw, gh, stripY, stripH; static double ppu;
    // the game's window: by process, waiting up to `wait` seconds for the game to start
    static IntPtr FindGame(double wait) {
        double until = Now() + wait; bool said = false;
        while (true) {
            foreach (var pr in Process.GetProcessesByName("GeometryDash")) if (pr.MainWindowHandle != IntPtr.Zero) return pr.MainWindowHandle;
            if (Now() > until) return IntPtr.Zero;
            if (!said) { Console.WriteLine("Waiting for Geometry Dash to start..."); said = true; }
            Thread.Sleep(500);
        }
    }
    // Screen frames come from ffmpeg's Desktop Duplication grabber (the same as tools/record.sh):
    // plain GDI grabs of a fullscreen GD come back frozen. ffmpeg crops to a strip at the ground and
    // pipes raw frames; a reader thread notes each frame's arrival time and where the cube is.
    static Process ff; static Thread reader; static byte[] buf;
    static readonly object qlock = new object(); static Queue<double[]> q = new Queue<double[]>();
    static void SetupCapture() {
        RECT r; GetClientRect(hwnd, out r); var p = new POINT(); ClientToScreen(hwnd, ref p);
        gx = p.X; gy = p.Y; gw = r.R - r.L; gh = r.B - r.T; ppu = gh / 320.0;
        if (gw < 100 || gh < 100) throw new Exception("the Geometry Dash window is minimised or too small (" + gw + "x" + gh + "); bring it up first");
        // a strip around the ground line, where the cube starts (ground at ~67% of the height)
        stripY = (int)(gh * 0.52); stripH = (int)(gh * 0.24) & ~1; gw &= ~1;
        string exe = Environment.GetEnvironmentVariable("GDLM_FFMPEG") ?? "ffmpeg";
        var si = new ProcessStartInfo(exe, string.Format("-hide_banner -loglevel error -f lavfi -i ddagrab=output_idx=0:framerate=240:dup_frames=0:offset_x={0}:offset_y={1}:video_size={2}x{3} -vf hwdownload,format=bgra -f rawvideo -pix_fmt bgra pipe:1", gx, gy + stripY, gw, stripH));
        si.UseShellExecute = false; si.RedirectStandardOutput = true; si.CreateNoWindow = true;
        ff = Process.Start(si);
        int len = gw * stripH * 4; buf = new byte[len];
        reader = new Thread(() => {
            var st = ff.StandardOutput.BaseStream; var f = new byte[len];
            while (true) {
                int got = 0; while (got < len) { int k = st.Read(f, got, len - got); if (k <= 0) return; got += k; }
                double t = Now(); long sx = 0; int cnt = 0, minY = int.MaxValue;
                for (int y = 0; y < stripH; y += 2) for (int x = 0; x < gw; x += 2) {
                    int i = (y * gw + x) * 4; int bb = f[i], g = f[i + 1], rr = f[i + 2];
                    if (g > 200 && rr > 70 && rr < 185 && bb < 70) { sx += x; cnt++; if (y < minY) minY = y; }
                }
                lock (qlock) { Buffer.BlockCopy(f, 0, buf, 0, len); q.Enqueue(new double[] { t, cnt > 20 ? sx / (double)cnt : -1, cnt > 20 ? minY : -1, cnt }); while (q.Count > 64) q.Dequeue(); }
            }
        });
        reader.IsBackground = true; reader.Start();
    }
    static void StopCapture() { try { if (ff != null && !ff.HasExited) ff.Kill(); } catch (Exception) { } }
    // the next new frame: its arrival time, the lime cube's centre x and top y in the strip (-1 when
    // not seen) and pixel count. waitS = 0 returns at once; false when no new frame came.
    static bool Grab(double waitS, out double t, out double cx, out double topY, out int n) {
        double until = Now() + waitS;
        while (true) {
            lock (qlock) if (q.Count > 0) { var v = q.Dequeue(); t = v[0]; cx = v[1]; topY = v[2]; n = (int)v[3]; return true; }
            if (Now() >= until) { t = Now(); cx = -1; topY = -1; n = 0; return false; }
            Thread.Sleep(1);
        }
    }

    // Look only, never press: reports what the grabs see for a few seconds (tools/bot.js --probe).
    public static int Probe(double seconds) {
        SetProcessDPIAware();
        hwnd = FindGame(600);
        if (hwnd == IntPtr.Zero) { Console.WriteLine("Geometry Dash is not running."); return 2; }
        while (true) { try { SetupCapture(); break; } catch (Exception) { Thread.Sleep(1000); } }
        Console.WriteLine(string.Format("GD window {0}x{1} at {2},{3}; strip y {4}..{5}", gw, gh, gx, gy, stripY, stripY + stripH));
        double t1 = Now() + seconds, last = 0; int frames = 0, inHalf = 0;
        while (Now() < t1) {
            double t, cx, ty; int n; if (!Grab(0.05, out t, out cx, out ty, out n)) { cx = -1; n = 0; ty = -1; } else { frames++; inHalf++; }
            if (Now() - last > 0.5) { long sum = 0; lock (qlock) for (int i = 0; i < buf.Length; i += 4 * 97) sum += buf[i] + buf[i + 1] + buf[i + 2];
                last = Now(); Console.WriteLine(string.Format("  active {0}  new frames {1}, lime px {2}, cube x {3:F0}, top {4:F0}, brightness {5}", GetForegroundWindow() == hwnd, inHalf, n, cx, ty, sum * 97 * 4 / buf.Length / 3)); inHalf = 0; }
        }
        Console.WriteLine(string.Format("{0} new frames in {1:F1} s", frames, seconds));
        StopCapture();
        return 0;
    }

    // ---- one attempt ----
    // events: tick (240 Hz) and down/up. jumpTicks: ticks of presses the sim says are ground jumps.
    public static int Run(int[] ticks, bool[] downs, int[] jumpTicks, double endTick, int attempts, double offsetMs, string logPath) {
        SetProcessDPIAware(); timeBeginPeriod(1);
        hwnd = FindGame(600);
        if (hwnd == IntPtr.Zero) { Console.WriteLine("Geometry Dash did not start within 10 minutes."); return 2; }
        while (true) { try { SetupCapture(); break; } catch (Exception) { Thread.Sleep(1000); } } // wait while minimised
        Console.WriteLine(string.Format("GD window {0}x{1}, {2:F3} px per unit. Open the level and press Play; I start at the first attempt.", gw, gh, ppu));
        double lag = -offsetMs / 1000.0; // seconds to press EARLY by
        bool cleared = false;
        for (int a = 1; a <= attempts && !cleared; a++) {
            // wait for the cube to come in from the left edge, then fit its slide
            var ts = new List<double>(); var xs = new List<double>(); double lastSeen = -1;
            while (true) {
                if (GetForegroundWindow() != hwnd) { Thread.Sleep(50); continue; }
                double t, cx, ty; int n; if (!Grab(0.1, out t, out cx, out ty, out n)) continue;
                double unit = 30 * ppu; // the cube is one block wide
                // fully on screen (centre past half a block) and before the camera starts to follow
                if (cx >= 0 && cx > unit * 0.55 && cx < unit * 1.9) { ts.Add(t); xs.Add(cx); lastSeen = t; }
                else if (ts.Count > 0 && (cx < 0 || cx >= unit * 1.9)) {
                    if (ts.Count >= 4) break;
                    ts.Clear(); xs.Clear();
                }
                if (ts.Count >= 4 && t - ts[0] > 0.12) break;
            }
            // least squares x = a + b t; tick 0 is when the cube's level x was 0
            int m = ts.Count; double st = 0, sx = 0, stt = 0, stx = 0;
            for (int i = 0; i < m; i++) { st += ts[i]; sx += xs[i]; stt += ts[i] * ts[i]; stx += ts[i] * xs[i]; }
            double b = (m * stx - st * sx) / (m * stt - st * st), a0 = (sx - b * st) / m;
            double speed = b / ppu; // units per second seen on screen
            if (Math.Abs(speed - UNITS_PER_S) > 40) { Console.WriteLine(string.Format("attempt {0}: start not clear (slide {1:F0} units/s), waiting for the next one", a, speed)); a--; Thread.Sleep(300); continue; }
            // screen x = (levelX - CAM_X0) * ppu and levelX = UNITS_PER_S * (t - t0)
            double t0 = (-CAM_X0 * ppu - a0) / b; // the time the cube's level x was 0
            Console.WriteLine(string.Format("attempt {0}: tick 0 at {1:F4} s ({2} samples, slide {3:F1} units/s), pressing {4:F1} ms early", a, t0, m, speed, lag * 1000));

            // play the clicks, watching for the cube to leave the ground and for a restart
            var seenJump = new List<double>(); int ji = 0; double groundTop = -1; bool restarted = false;
            int k = 0; double tEnd = t0 + endTick / 240.0 + 1.0;
            bool held = false;
            while (Now() < tEnd) {
                double now = Now();
                if (k < ticks.Length) {
                    double due = t0 + ticks[k] / 240.0 - lag;
                    if (now >= due) { Key(downs[k]); held = downs[k]; k++; continue; }
                    if (due - now < 0.004) continue; // busy-wait the last few ms
                }
                double tt, cx, ty; int n; if (!Grab(0.002, out tt, out cx, out ty, out n)) continue;
                // a restart: the cube is back at the far left
                if (cx >= 0 && cx < 30 * ppu * 0.9 && tt - t0 > 0.6) { restarted = true; break; }
                // first jumps: the cube's top rises 3+ px above where it sat
                if (ji < jumpTicks.Length && ty >= 0) {
                    double planned = t0 + jumpTicks[ji] / 240.0;
                    if (tt < planned - 0.05) groundTop = ty;
                    else if (groundTop >= 0 && ty < groundTop - 3) { seenJump.Add(tt - planned); ji++; groundTop = -1; }
                    else if (tt > planned + 0.25) { ji++; groundTop = -1; }
                }
            }
            if (held) Key(false);
            double reached = (Now() - t0) * UNITS_PER_S / 30.0;
            if (seenJump.Count > 0) {
                seenJump.Sort(); double med = seenJump[seenJump.Count / 2];
                Console.WriteLine(string.Format("   jumps seen {0} ms after their planned time (median of {1}; includes the {2:F1} ms early press)", (med * 1000).ToString("F1"), seenJump.Count, lag * 1000));
                lag += med; // press earlier next time by what was still late
            }
            if (restarted) Console.WriteLine(string.Format("   DIED: the attempt restarted after {0:F2} s (around block {1:F0} at 1x)", Now() - t0, reached));
            else { Console.WriteLine(string.Format("   CLEARED (no restart within the level's length + 1 s). Measured lag: {0:F1} ms", lag * 1000)); cleared = true; }
            if (logPath != null) System.IO.File.AppendAllText(logPath, string.Format("{0}\tattempt {1}\t{2}\tlag_ms {3:F1}\n", DateTime.Now.ToString("s"), a, restarted ? "died" : "cleared", lag * 1000));
        }
        StopCapture();
        return cleared ? 0 : 1;
    }
}
