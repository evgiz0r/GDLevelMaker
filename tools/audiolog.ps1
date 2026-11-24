# tools/audiolog.ps1 -Out <file.wav> -Stop <flagfile>
# Records the PC's own sound (what the speakers/headset play: GD's music) while a recording runs, with no install:
# Windows' WASAPI loopback on the default output device. Started and stopped by tools/record.sh (only on the
# user's "record", hidden). The WAV starts at the logger's start; silence is written where Windows delivers no
# audio (nothing playing), so sample n is always n / rate seconds after the start. <file>.json beside it holds
# the start time (UTC, ISO) and the format, so the audio lines up with the video and the input log
# (tools/replay_run.js pins each attempt's clock on the song restarting; PHYSICS.md "Fidelity").
param([Parameter(Mandatory = $true)][string]$Out, [Parameter(Mandatory = $true)][string]$Stop)
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Diagnostics; using System.Threading; using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int EnumAudioEndpoints(int f, int s, out IntPtr c); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioClient {
  int Initialize(int share, int flags, long buf, long period, IntPtr fmt, IntPtr session); int GetBufferSize(out uint n);
  int GetStreamLatency(out long l); int GetCurrentPadding(out uint p); int IsFormatSupported(int s, IntPtr f, out IntPtr c);
  int GetMixFormat(out IntPtr f); int GetDevicePeriod(out long d, out long m); int Start(); int Stop(); int Reset();
  int SetEventHandle(IntPtr h); int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioCaptureClient { int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong pos, out ulong qpc); int ReleaseBuffer(uint n); int GetNextPacketSize(out uint n); }
public static class GdAudioLog {
  public static void Run(string outFile, string stopFile) {
    var en = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom()); IMMDevice dev; Check(en.GetDefaultAudioEndpoint(0, 0, out dev));
    Guid iidAC = typeof(IAudioClient).GUID; object o; Check(dev.Activate(ref iidAC, 23, IntPtr.Zero, out o)); var ac = (IAudioClient)o;
    IntPtr fmt; Check(ac.GetMixFormat(out fmt));
    int ch = Marshal.ReadInt16(fmt, 2), rate = Marshal.ReadInt32(fmt, 4), block = Marshal.ReadInt16(fmt, 12), bits = Marshal.ReadInt16(fmt, 14), cb = Marshal.ReadInt16(fmt, 16);
    byte[] fmtBytes = new byte[18 + cb]; Marshal.Copy(fmt, fmtBytes, 0, fmtBytes.Length);
    Check(ac.Initialize(0, 0x00020000 /* LOOPBACK */, 10000000 /* 1 s buffer */, 0, fmt, IntPtr.Zero));
    Guid iidCC = typeof(IAudioCaptureClient).GUID; Check(ac.GetService(ref iidCC, out o)); var cc = (IAudioCaptureClient)o;
    var fs = new FileStream(outFile, FileMode.Create, FileAccess.Write); var w = new BinaryWriter(fs);
    // RIFF header with the device's own format chunk; sizes patched at the end
    w.Write(new[] { 'R', 'I', 'F', 'F' }); w.Write(0); w.Write(new[] { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' }); w.Write(fmtBytes.Length); w.Write(fmtBytes);
    w.Write(new[] { 'd', 'a', 't', 'a' }); long dataSizePos = fs.Position; w.Write(0);
    var sw = Stopwatch.StartNew(); DateTime t0 = DateTime.UtcNow;
    File.WriteAllText(outFile + ".json", "{\"start_utc\":\"" + t0.ToString("o") + "\",\"rate\":" + rate + ",\"channels\":" + ch + ",\"bits\":" + bits + ",\"block\":" + block + ",\"note\":\"sample n is n/rate s after start_utc; silence written where nothing played\"}");
    Check(ac.Start()); long written = 0; byte[] buf = new byte[0];
    while (!File.Exists(stopFile)) {
      uint n; Check(cc.GetNextPacketSize(out n));
      while (n > 0) {
        IntPtr data; uint frames, flags; ulong pos, qpc; Check(cc.GetBuffer(out data, out frames, out flags, out pos, out qpc));
        // keep the timeline: if this packet starts later than what is written, fill the gap with silence
        long due = (long)(sw.Elapsed.TotalSeconds * rate) - frames; if (due > written + rate / 50) { Pad(w, (due - written) * block); written = due; }
        int bytes = (int)frames * block; if (buf.Length < bytes) buf = new byte[bytes];
        if ((flags & 2) != 0) Array.Clear(buf, 0, bytes); else Marshal.Copy(data, buf, 0, bytes);
        w.Write(buf, 0, bytes); written += frames; Check(cc.ReleaseBuffer(frames)); Check(cc.GetNextPacketSize(out n));
      }
      long now = (long)(sw.Elapsed.TotalSeconds * rate); if (now - written > rate / 5) { Pad(w, (now - written - rate / 20) * block); written = now - rate / 20; }   // nothing playing
      Thread.Sleep(10);
    }
    ac.Stop(); w.Flush(); long end = fs.Position;
    fs.Position = 4; w.Write((int)(end - 8)); fs.Position = dataSizePos; w.Write((int)(end - dataSizePos - 4)); w.Close();
  }
  static void Pad(BinaryWriter w, long bytes) { var z = new byte[65536]; while (bytes > 0) { int k = (int)Math.Min(bytes, z.Length); w.Write(z, 0, k); bytes -= k; } }
  static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }
}
"@
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
[GdAudioLog]::Run($Out, $Stop)
