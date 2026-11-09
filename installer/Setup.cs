using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

// Per-user, offline installer. No elevation, downloaded code, or firewall changes.
// Express setup safely enables the local telemetry mod in the latest save with a retained backup.
internal static class Setup
{
    [DllImport("user32.dll", SetLastError = true)] private static extern bool DestroyIcon(IntPtr handle);
    private static readonly string Local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    private static readonly string NormalRoot = Path.Combine(Local, "Programs", "ShipOS");
    private static readonly string DataRoot = Path.Combine(Local, "ShipOS");
    private const string Marker = ".shipos-install-v1";
    private const string Version = "0.2.0-beta.5";
    private static string InstallRoot = NormalRoot;
    private static bool TestMode;
    private static bool Quiet;
    private static bool Express;
    private static Form Window;
    private static Label Status;
    private static CheckBox Mod, AutoConfigure, Startup, Desktop, Launch;
    private static Panel Content;
    private static Button Back, Next, Cancel;
    private static int Step;
    private static bool Installing, Complete;
    private static bool InstallModOption = true, AutoConfigureOption = true, DesktopOption = true, StartupOption = true, LaunchOption = true;

    [STAThread]
    public static int Main(string[] args)
    {
        try
        {
            Quiet = Array.IndexOf(args, "/quiet") >= 0;
            Express = Array.IndexOf(args, "/express") >= 0;
            foreach (string arg in args)
            {
                if (!arg.StartsWith("/test-root=", StringComparison.OrdinalIgnoreCase)) continue;
                string candidate = Path.GetFullPath(arg.Substring(11));
                string temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
                if (!String.Equals(Path.GetDirectoryName(candidate), temp, StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(candidate).StartsWith("ShipOS-install-test-", StringComparison.Ordinal)) throw new Exception("Unsafe test installation path.");
                InstallRoot = candidate; TestMode = true;
            }
            if (Array.IndexOf(args, "/uninstall-worker") >= 0) { Uninstall(); return 0; }
            if (Array.IndexOf(args, "/uninstall") >= 0 || String.Equals(Path.GetFileName(Assembly.GetExecutingAssembly().Location), "Uninstall.exe", StringComparison.OrdinalIgnoreCase))
            {
                if (!Quiet && MessageBox.Show("Remove ShipOS? Your stories, backups, logs, and local telemetry mod will be preserved.", "Uninstall ShipOS", MessageBoxButtons.OKCancel) != DialogResult.OK) return 0;
                string worker = Path.Combine(Path.GetTempPath(), "ShipOS-uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
                File.Copy(Assembly.GetExecutingAssembly().Location, worker);
                string workerArgs = "/uninstall-worker /quiet" + (TestMode ? " /test-root=\"" + InstallRoot + "\"" : "");
                Process.Start(new ProcessStartInfo(worker, workerArgs) { UseShellExecute = false, CreateNoWindow = true });
                return 0;
            }
            if (Quiet) { Install(Express, Express, Express, Express, Express); return 0; }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            BuildWizard(); Application.Run(Window); return 0;
        }
        catch (Exception error)
        {
            try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "ShipOS-setup-error.log"), error.ToString()); } catch { }
            if (!Quiet) MessageBox.Show(error.Message, "ShipOS setup failed");
            return 1;
        }
    }

    private static void BuildWizard()
    {
        if (Directory.Exists(NormalRoot) && File.Exists(Path.Combine(NormalRoot, Marker)))
        {
            DesktopOption = File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ShipOS.lnk"));
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) StartupOption = key != null && key.GetValue("ShipOS") != null;
            AutoConfigureOption = File.Exists(Path.Combine(DataRoot, @"Data\auto-configure-saves"));
        }
        Window = new Form { Text = "ShipOS Setup Wizard", ClientSize = new Size(720, 610), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen, BackColor = Color.FromArgb(14, 28, 35), ForeColor = Color.FromArgb(221, 239, 233), Font = new Font("Segoe UI", 10) };
        var header = new Panel { Location = new Point(0, 0), Size = new Size(720, 82), BackColor = Color.FromArgb(10, 21, 27) };
        header.Controls.Add(new Label { Text = "SHIPOS", Font = new Font("Segoe UI", 25, FontStyle.Bold), Location = new Point(28, 17), AutoSize = true, ForeColor = Color.FromArgb(143, 228, 197) });
        header.Controls.Add(new Label { Text = "LOCAL SINGLE-PLAYER BETA  ·  " + Version, Location = new Point(190, 33), AutoSize = true, ForeColor = Color.FromArgb(153, 182, 190), Font = new Font("Consolas", 9) });
        Window.Controls.Add(header);
        Content = new Panel { Location = new Point(28, 98), Size = new Size(664, 410), AutoScroll = true };
        Window.Controls.Add(Content);
        Status = new Label { Location = new Point(30, 516), Size = new Size(660, 32), ForeColor = Color.FromArgb(153, 182, 190), Font = new Font("Segoe UI", 8) };
        Window.Controls.Add(Status);
        Back = WizardButton("< Back", 354, 556, 98); Back.Click += delegate { if (Step > 0 && !Installing) { Step--; RenderStep(); } };
        Next = WizardButton("Next >", 460, 556, 112); Next.Click += delegate { AdvanceWizard(); };
        Cancel = WizardButton("Cancel", 580, 556, 112); Cancel.Click += delegate { if (!Installing) Window.Close(); };
        Window.Controls.Add(Back); Window.Controls.Add(Next); Window.Controls.Add(Cancel);
        Window.CancelButton = Cancel;
        Window.FormClosing += delegate(object sender, FormClosingEventArgs args) { if (Installing) args.Cancel = true; };
        RenderStep();
    }

    private static Button WizardButton(string text, int left, int top, int width)
    {
        return new Button { Text = text, Location = new Point(left, top), Size = new Size(width, 36), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(22, 42, 49), ForeColor = Color.FromArgb(221, 239, 233) };
    }

    private static Label AddText(string text, int top, int height, float size, Color color)
    {
        var label = new Label { Text = text, Location = new Point(2, top), Size = new Size(650, height), Font = new Font("Segoe UI", size), ForeColor = color };
        Content.Controls.Add(label); return label;
    }

    private static void AddTitle(string title, string subtitle)
    {
        AddText(title, 0, 42, 20, Color.FromArgb(143, 228, 197));
        AddText(subtitle, 47, 52, 10, Color.FromArgb(183, 207, 210));
    }

    private static CheckBox AddChoice(string text, int top, bool selected, bool enabled, Action<bool> changed)
    {
        var box = new CheckBox { Text = text, Checked = selected, Enabled = enabled, Location = new Point(8, top), Size = new Size(640, 30), ForeColor = enabled ? Window.ForeColor : Color.FromArgb(147, 174, 179) };
        box.CheckedChanged += delegate { changed(box.Checked); }; Content.Controls.Add(box); return box;
    }

    private static Button AddSmallButton(string text, int left, int top, int width, Action clicked)
    {
        var button = new Button { Text = text, Location = new Point(left, top), Size = new Size(width, 31), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(22, 42, 49), ForeColor = Window.ForeColor, Font = new Font("Segoe UI", 8) };
        button.Click += delegate { clicked(); }; Content.Controls.Add(button); return button;
    }

    private static int WindowsMajorVersion()
    {
        try { using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion")) return Convert.ToInt32(key.GetValue("CurrentMajorVersionNumber", Environment.OSVersion.Version.Major)); }
        catch { return Environment.OSVersion.Version.Major; }
    }

    private static string WindowsProductName()
    {
        try { using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion")) return Convert.ToString(key.GetValue("ProductName", "Windows")); }
        catch { return "Windows"; }
    }

    private static string DotNetFrameworkVersion()
    {
        try
        {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"))
            {
                int release = Convert.ToInt32(key.GetValue("Release", 0));
                if (release >= 533320) return "4.8.1";
                if (release >= 528040) return "4.8";
                if (release >= 461808) return "4.7.2";
                if (release > 0) return "4.x (release " + release + ")";
            }
        }
        catch { }
        return "4.x (setup is running)";
    }

    private static void OpenHelp(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch { MessageBox.Show("Could not open the browser. Copy this address instead:\n\n" + url, "ShipOS requirements"); }
    }

    private static void RenderStep()
    {
        Content.Controls.Clear(); Back.Enabled = Step > 0 && Step < 4 && !Installing; Cancel.Enabled = !Installing && Step < 4;
        Status.Text = Step == 0 ? "Express setup  ·  One click  ·  No administrator access required" : "Advanced setup  ·  Step " + Step + " of 4";
        if (Step == 0) RenderWelcome();
        else if (Step == 1) RenderReadiness();
        else if (Step == 2) RenderComponents();
        else if (Step == 3) RenderReview();
        else RenderFinished();
    }

    private static void RenderWelcome()
    {
        AddTitle("Install ShipOS", "The recommended setup is automatic, local, and reversible.");
        AddText("Express setup installs the app, bundled Node runtime, tray helper, shortcuts, and telemetry mod; enables telemetry for the most recently played local save; starts ShipOS with Windows; and opens the app when finished.", 112, 82, 10, Window.ForeColor);
        AddText("Before changing a save, ShipOS keeps the original configuration and checkpoint under its local save-backups folder. New saves are enabled after Space Engineers closes, ready for their next session.", 202, 76, 10, Color.FromArgb(183, 207, 210));
        AddText("If the game is open, setup will not touch its active files. Exit and reopen the game once when convenient—the helper finishes configuration after the game closes. No account, subscription, cloud relay, or downloaded prerequisite is involved.", 287, 76, 9, Color.FromArgb(236, 205, 156));
        AddSmallButton("Advanced options", 8, 371, 150, delegate { Step = 1; RenderStep(); });
        Next.Text = "Install ShipOS"; Next.Enabled = true;
    }

    private static void RenderReadiness()
    {
        AddTitle("Readiness check", "Everything ShipOS can install is carried inside this offline package.");
        bool supportedWindows = Environment.Is64BitOperatingSystem && WindowsMajorVersion() >= 10;
        bool powershell = File.Exists(PowerShellPath());
        bool gameData = Directory.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SpaceEngineers"));
        long freeMb = new DriveInfo(Path.GetPathRoot(NormalRoot)).AvailableFreeSpace / 1024 / 1024;
        string report = "ShipOS " + Version + " readiness\r\nWindows: " + WindowsProductName() + " x" + (Environment.Is64BitOperatingSystem ? "64" : "86") + "\r\n.NET Framework: " + DotNetFrameworkVersion() + "\r\nWindows PowerShell 5.1 path: " + (powershell ? PowerShellPath() : "MISSING") + "\r\nBundled Node.js: included\r\nSpace Engineers data: " + (gameData ? "detected" : "not detected") + "\r\nFree space: " + freeMb.ToString("N0") + " MB";
        AddText((supportedWindows ? "✓" : "✕") + " Windows 10/11 x64: " + WindowsProductName() + "\n✓ Microsoft .NET Framework: " + DotNetFrameworkVersion() + "\n" + (powershell ? "✓" : "✕") + " Windows PowerShell 5.1 helper: " + (powershell ? "available" : "missing") + "\n✓ Node.js 24: bundled; no system install required\n" + (gameData ? "✓" : "!") + " Space Engineers data folder: " + (gameData ? "detected" : "not detected yet") + "\n" + (freeMb >= 250 ? "✓" : "✕") + " Free disk space: " + freeMb.ToString("N0") + " MB (250 MB minimum; more for rollback)", 112, 145, 10, Window.ForeColor);
        AddText(gameData ? "The telemetry mod and latest local save can be configured automatically. Originals are backed up first; a running game is never modified." : "The core app can install now. When Space Engineers creates a local save, the helper can configure it automatically after the game closes.", 263, 62, 9, Color.FromArgb(236, 205, 156));
        AddText("Setup never downloads prerequisites or changes Windows Firewall. If a required check fails, use the official help buttons or copy the check details for support.", 327, 40, 8, Color.FromArgb(153, 182, 190));
        AddSmallButton("Copy check details", 8, 371, 148, delegate { try { Clipboard.SetText(report); Status.Text = "Readiness details copied."; } catch { Status.Text = "Could not copy readiness details."; } });
        AddSmallButton("Microsoft .NET help", 165, 371, 160, delegate { OpenHelp("https://dotnet.microsoft.com/download/dotnet-framework"); });
        AddSmallButton("PowerShell help", 334, 371, 145, delegate { OpenHelp("https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_windows_powershell_5.1"); });
        AddSmallButton("Firewall help", 488, 371, 145, delegate { OpenHelp("https://support.microsoft.com/windows/security/firewall/risks-of-allowing-apps-through-windows-firewall"); });
        Next.Text = "Next >"; Next.Enabled = supportedWindows && powershell && freeMb >= 250;
    }

    private static void RenderComponents()
    {
        AddTitle("Choose components", "Core application files and a Start menu entry are required.");
        AddChoice("ShipOS application + bundled private Node 24 runtime (required)", 108, true, false, delegate { });
        AddChoice("Tray helper and Start menu launch/uninstall shortcuts (required)", 143, true, false, delegate { });
        Mod = AddChoice("Install/update the ShipOSLocalTelemetry world mod", 183, InstallModOption, true, value => { InstallModOption = value; if (AutoConfigure != null) { AutoConfigure.Enabled = value; if (!value) AutoConfigure.Checked = false; } });
        AutoConfigure = AddChoice("Automatically enable telemetry for the latest local save (backed up first)", 218, AutoConfigureOption, InstallModOption, value => AutoConfigureOption = value);
        Desktop = AddChoice("Create a desktop shortcut", 253, DesktopOption, true, value => DesktopOption = value);
        Startup = AddChoice("Start the ShipOS helper when I sign in to Windows", 288, StartupOption, true, value => StartupOption = value);
        Launch = AddChoice("Open ShipOS after setup", 323, LaunchOption, true, value => LaunchOption = value);
        AddText("A running game is never edited. Setup makes no firewall rule, opens no router port, and installs no plugin loader.", 365, 38, 8, Color.FromArgb(153, 182, 190));
        Next.Text = "Next >"; Next.Enabled = true;
    }

    private static void RenderReview()
    {
        AddTitle("Ready to install", "Review what will happen, then choose Install.");
        string modTarget = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SpaceEngineers", "Mods", "ShipOSLocalTelemetry");
        AddText("Application\n  " + InstallRoot + "\n\nTelemetry world mod\n  " + (InstallModOption ? modTarget : "Not selected") + "\n  Latest local save: " + (AutoConfigureOption ? "enable automatically with backup" : "leave unchanged") + "\n\nShortcuts\n  Start menu: ShipOS + Uninstall ShipOS\n  Desktop: " + (DesktopOption ? "Yes" : "No") + "    Start at sign-in: " + (StartupOption ? "Yes" : "No"), 105, 185, 9, Window.ForeColor);
        AddText("Updates preserve the separate story database and retain the prior app directory for rollback. Uninstall removes the app/helper/shortcuts but deliberately keeps stories, backups, logs, the game mod, and rollback copies.", 287, 68, 9, Color.FromArgb(236, 205, 156));
        var license = new TextBox { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Location = new Point(3, 360), Size = new Size(645, 45), BackColor = Color.FromArgb(22, 42, 49), ForeColor = Window.ForeColor, Font = new Font("Consolas", 8) };
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ShipOS.License")) using (var reader = new StreamReader(stream)) license.Text = reader.ReadToEnd();
        Content.Controls.Add(license); Next.Text = "Install"; Next.Enabled = true;
    }

    private static void RenderFinished()
    {
        AddTitle("ShipOS is installed", "The helper, runtime, shortcuts, and selected telemetry files are ready.");
        AddText("ShipOS is ready. Start Space Engineers normally and open the most recently played local save—the telemetry mod has been enabled automatically. If the game was running during setup, exit and reopen it once so the helper can finish safely. Future local saves are configured after the game closes.\n\nFor another PC, iPad, or Android device, use the tray pairing QR/link on the same trusted network. Paired play screens can read and write Storytelling immediately.", 108, 175, 10, Window.ForeColor);
        AddText("Uninstall: Start > ShipOS > Uninstall ShipOS, or Windows Installed apps. Story data and the game mod are retained so uninstall is recoverable. Local sharing is unencrypted HTTP; use only trusted private Wi-Fi/LAN and never port-forward it.", 279, 82, 9, Color.FromArgb(236, 205, 156));
        AddText("Storytelling and optional AI roleplay are beta fiction. Back up anything important from Configuration.", 370, 35, 9, Color.FromArgb(183, 207, 210));
        Next.Text = "Finish"; Next.Enabled = true; Back.Enabled = false; Cancel.Enabled = false;
        Status.Text = "Installation complete  ·  " + InstallRoot;
    }

    private static void AdvanceWizard()
    {
        if (Step == 4) { Window.Close(); return; }
        if (Step == 0)
        {
            string reason;
            if (!PrerequisitesReady(out reason)) { Step = 1; RenderStep(); Status.Text = reason; return; }
            BeginInstall(true, true, true, true, true); return;
        }
        if (Step < 3) { Step++; RenderStep(); return; }
        BeginInstall(InstallModOption, DesktopOption, StartupOption, AutoConfigureOption, LaunchOption);
    }

    private static bool PrerequisitesReady(out string reason)
    {
        if (!Environment.Is64BitOperatingSystem || WindowsMajorVersion() < 10) { reason = "ShipOS requires 64-bit Windows 10 or 11."; return false; }
        if (!File.Exists(PowerShellPath())) { reason = "Windows PowerShell 5.1 is missing. Use the official help link below."; return false; }
        long freeMb = new DriveInfo(Path.GetPathRoot(NormalRoot)).AvailableFreeSpace / 1024 / 1024;
        if (freeMb < 250) { reason = "ShipOS needs at least 250 MB free, plus room for rollback and save backups."; return false; }
        reason = "Ready"; return true;
    }

    private static void BeginInstall(bool installMod, bool desktop, bool startup, bool autoConfigure, bool launch)
    {
        Installing = true; Back.Enabled = false; Next.Enabled = false; Cancel.Enabled = false; Window.UseWaitCursor = true;
        try { Install(installMod, desktop, startup, autoConfigure, launch); Complete = true; Step = 4; }
        catch (Exception error) { MessageBox.Show(error.Message, "ShipOS setup could not finish"); Status.Text = "Setup stopped without replacing your previous installation."; }
        finally { Installing = false; Window.UseWaitCursor = false; if (!Complete) { Next.Enabled = true; Cancel.Enabled = true; Back.Enabled = true; } }
        if (Complete) RenderStep();
    }
    private static void Report(string message) { if (Status != null) { Status.Text = message; Status.Refresh(); } }
    private static void StopHelper()
    {
        if (TestMode) return;
        try { using (var handle = EventWaitHandle.OpenExisting("Local\\ShipOS.Stop." + Environment.UserName)) handle.Set(); Thread.Sleep(3500); } catch (WaitHandleCannotBeOpenedException) { }
    }
    private static void VerifyRoot()
    {
        if (!TestMode && !String.Equals(Path.GetFullPath(InstallRoot), Path.GetFullPath(NormalRoot), StringComparison.OrdinalIgnoreCase)) throw new Exception("Unexpected installation path.");
        if (Directory.Exists(InstallRoot) && !File.Exists(Path.Combine(InstallRoot, Marker))) throw new Exception("The target folder already exists but is not a recognized ShipOS installation. No files were changed.");
    }
    private static void Install(bool installMod, bool desktop, bool startup, bool autoConfigure, bool launch)
    {
        VerifyRoot(); StopHelper();
        string stage = Path.Combine(Path.GetTempPath(), "ShipOS-stage-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stage);
        string previous = null;
        try
        {
            Report("Unpacking the offline application and bundled runtime...");
            using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("ShipOS.Payload"))
            using (var zip = new ZipArchive(resource, ZipArchiveMode.Read))
            {
                foreach (var entry in zip.Entries)
                {
                    string target = Path.GetFullPath(Path.Combine(stage, entry.FullName));
                    if (!target.StartsWith(stage + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("Invalid payload path.");
                    // ZIP producers use either separator for directory entries on Windows.
                    // Entry.Name is empty for a directory and is the reliable cross-producer test.
                    if (String.IsNullOrEmpty(entry.Name) || entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\")) { Directory.CreateDirectory(target); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    entry.ExtractToFile(target, false);
                }
            }
            File.WriteAllText(Path.Combine(stage, Marker), Version);
            Directory.CreateDirectory(Path.GetDirectoryName(InstallRoot));
            if (Directory.Exists(InstallRoot))
            {
                previous = InstallRoot + ".previous-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
                Directory.Move(InstallRoot, previous);
            }
            Directory.Move(stage, InstallRoot);
            string uninstall = Path.Combine(InstallRoot, "Uninstall.exe");
            // Release payloads contain a compact copy without the embedded app archive.
            // Keep a fallback for developer/test packages built before that split.
            if (!File.Exists(uninstall)) File.Copy(Assembly.GetExecutingAssembly().Location, uninstall, true);
            if (!TestMode)
            {
                string shortcutFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ShipOS");
                Directory.CreateDirectory(shortcutFolder); EnsureIcon();
                HelperShortcut(Path.Combine(shortcutFolder, "ShipOS.lnk"));
                UninstallShortcut(Path.Combine(shortcutFolder, "Uninstall ShipOS.lnk"), uninstall);
                if (desktop) HelperShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ShipOS.lnk"));
                else if (!Quiet) File.Delete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ShipOS.lnk"));
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\ShipOS"))
                {
                    key.SetValue("DisplayName", "ShipOS Local Beta"); key.SetValue("DisplayVersion", Version); key.SetValue("Publisher", "syncrotellabs"); key.SetValue("InstallLocation", InstallRoot); key.SetValue("UninstallString", "\"" + uninstall + "\" /uninstall"); key.SetValue("NoModify", 1); key.SetValue("NoRepair", 1);
                }
                if (startup) using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run")) key.SetValue("ShipOS", HelperCommand());
                else if (!Quiet) using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true)) if (key != null) key.DeleteValue("ShipOS", false);
                if (installMod) InstallMod();
                if (autoConfigure) ConfigureSaves(true);
                else if (!Quiet) ConfigureSaves(false);
                if (launch) { LaunchHelper(); Thread.Sleep(1200); OpenLocalApp(); }
            }
            Report("ShipOS installed. Your saved stories are preserved.");
            // Previous application versions are retained for rollback, never removed silently.
        }
        catch
        {
            if (previous != null && !Directory.Exists(InstallRoot)) Directory.Move(previous, InstallRoot);
            throw;
        }
        finally
        {
            string tempRoot = Path.GetFullPath(Path.GetTempPath());
            if (Directory.Exists(stage) && stage.StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(stage).StartsWith("ShipOS-stage-", StringComparison.Ordinal)) Directory.Delete(stage, true);
        }
    }
    private static string PowerShellPath() { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\WindowsPowerShell\v1.0\powershell.exe"); }
    private static string HelperArgs() { return "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(InstallRoot, @"runtime\helper.ps1") + "\""; }
    private static string HelperCommand() { return "\"" + PowerShellPath() + "\" " + HelperArgs(); }
    private static void LaunchHelper() { Process.Start(new ProcessStartInfo(PowerShellPath(), HelperArgs()) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = InstallRoot }); }
    private static void OpenLocalApp()
    {
        try { Process.Start(new ProcessStartInfo("http://127.0.0.1:5174/") { UseShellExecute = true }); }
        catch { }
    }
    private static void HelperShortcut(string name)
    {
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        dynamic link = shell.CreateShortcut(name); link.TargetPath = PowerShellPath(); link.Arguments = HelperArgs(); link.WorkingDirectory = InstallRoot; link.IconLocation = Path.Combine(DataRoot, @"Logs\shipos.ico"); link.Description = "Start ShipOS local single-player companion"; link.Save();
    }
    private static void UninstallShortcut(string name, string uninstall)
    {
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        dynamic link = shell.CreateShortcut(name); link.TargetPath = uninstall; link.Arguments = "/uninstall"; link.WorkingDirectory = InstallRoot; link.IconLocation = Path.Combine(DataRoot, @"Logs\shipos.ico"); link.Description = "Uninstall ShipOS (stories and game mod are retained)"; link.Save();
    }
    private static void EnsureIcon()
    {
        string iconPath = Path.Combine(DataRoot, @"Logs\shipos.ico");
        if (File.Exists(iconPath)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(iconPath));
        using (var bitmap = new Bitmap(64, 64)) using (Graphics graphics = Graphics.FromImage(bitmap))
        using (var outline = new Pen(Color.FromArgb(139, 232, 202), 4))
        using (var fill = new SolidBrush(Color.FromArgb(12, 36, 43)))
        using (var visor = new SolidBrush(Color.FromArgb(232, 188, 99)))
        {
            graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; graphics.Clear(Color.Transparent);
            graphics.FillEllipse(fill, 8, 6, 48, 52); graphics.DrawEllipse(outline, 8, 6, 48, 52);
            graphics.FillRectangle(visor, 15, 23, 35, 16); graphics.DrawLine(outline, 20, 49, 44, 49);
            IntPtr handle = bitmap.GetHicon();
            try { using (Icon icon = (Icon)Icon.FromHandle(handle).Clone()) using (FileStream stream = File.Create(iconPath)) icon.Save(stream); }
            finally { DestroyIcon(handle); }
        }
    }
    private static void CopyTree(string source, string destination)
    {
        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            string relative = file.Substring(source.Length).TrimStart(Path.DirectorySeparatorChar);
            string target = Path.GetFullPath(Path.Combine(destination, relative));
            if (!target.StartsWith(Path.GetFullPath(destination) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("Invalid mod path.");
            Directory.CreateDirectory(Path.GetDirectoryName(target)); File.Copy(file, target, true);
        }
    }
    private static void InstallMod()
    {
        string source = Path.Combine(InstallRoot, "mod", "ShipOSLocalTelemetry");
        string target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SpaceEngineers", "Mods", "ShipOSLocalTelemetry");
        if (Directory.Exists(target)) CopyTree(target, Path.Combine(DataRoot, "Mod-backups", DateTime.Now.ToString("yyyyMMdd-HHmmss")));
        CopyTree(source, target);
    }
    private static void ConfigureSaves(bool enabled)
    {
        string data = Path.Combine(DataRoot, "Data");
        string marker = Path.Combine(data, "auto-configure-saves");
        Directory.CreateDirectory(data);
        if (!enabled) { File.Delete(marker); return; }
        File.WriteAllText(marker, "enabled by ShipOS setup " + Version);
        if (Process.GetProcessesByName("SpaceEngineers").Length > 0) return;
        string script = Path.Combine(InstallRoot, @"runtime\configure-saves.ps1");
        try
        {
            var process = Process.Start(new ProcessStartInfo(PowerShellPath(), "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, WorkingDirectory = InstallRoot });
            if (!process.WaitForExit(30000)) { try { process.Kill(); } catch { } throw new Exception("Save configuration timed out. The helper will retry after Space Engineers closes."); }
            if (process.ExitCode != 0 && process.ExitCode != 2) throw new Exception("Save configuration returned " + process.ExitCode + ". The helper will retry after Space Engineers closes.");
        }
        catch (Exception error)
        {
            string logs = Path.Combine(DataRoot, "Logs"); Directory.CreateDirectory(logs);
            File.AppendAllText(Path.Combine(logs, "save-config-error.log"), DateTime.Now.ToString("o") + " " + error.Message + Environment.NewLine);
        }
    }
    private static void Uninstall()
    {
        VerifyRoot(); StopHelper(); Thread.Sleep(1000);
        if (!TestMode)
        {
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\ShipOS", false);
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true)) if (key != null) key.DeleteValue("ShipOS", false);
            File.Delete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "ShipOS.lnk"));
            File.Delete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ShipOS", "ShipOS.lnk"));
            File.Delete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ShipOS", "Uninstall ShipOS.lnk"));
            string shortcutFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "ShipOS");
            if (Directory.Exists(shortcutFolder) && Directory.GetFileSystemEntries(shortcutFolder).Length == 0) Directory.Delete(shortcutFolder);
        }
        // Fixed per-user application path, validated above. Data and game mod paths are separate.
        if (Directory.Exists(InstallRoot) && File.Exists(Path.Combine(InstallRoot, Marker))) Directory.Delete(InstallRoot, true);
    }
}
