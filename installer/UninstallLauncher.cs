using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

// Small standalone entry point; the installed uninstaller owns all removal logic.
internal static class UninstallLauncher
{
    [STAThread]
    private static int Main()
    {
        try
        {
            string installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "ShipOS", "Uninstall.exe");
            if (!File.Exists(installed))
            {
                MessageBox.Show("ShipOS is not installed for this Windows user.", "Uninstall ShipOS", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }
            Process.Start(new ProcessStartInfo(installed, "/uninstall") { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(installed) });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Uninstall ShipOS could not start", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
