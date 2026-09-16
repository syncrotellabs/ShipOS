// Intrepid Telemetry Uplink
// Space Engineers programmable block script for ShipOS.
//
// Vanilla programmable blocks cannot make HTTP/web requests. This script
// gathers robust ship telemetry, writes it to Echo/an optional LCD, and
// broadcasts it over IGC for in-game receivers. A local bridge, Torch plugin,
// or mod can relay the packet to ShipOS.
//
// Setup:
// 1. Add a Programmable Block to the ship.
// 2. Optional: add an LCD/Text Panel named "[SHIPOS TELEMETRY]".
// 3. Paste this script into the PB, check code, remember and exit.
// 4. Run with argument "setup" once. Edit the generated Custom Data if needed.
// 5. Let it tick every Update100. UpdateIntervalSeconds controls packet rate.
// 6. Run with "once" for a single immediate packet.

const string DEFAULT_SHIP_NAME = "DSV Intrepid";
const string DEFAULT_CONTROLLER_NAME = "Intrepid Flight Seat";
const string DEFAULT_PANEL_NAME = "[SHIPOS TELEMETRY]";
const string DEFAULT_IGC_TAG = "INTREPID_TELEMETRY";
const string PROTOCOL = "shipos.telemetry.v1";

string shipName = DEFAULT_SHIP_NAME;
string controllerName = DEFAULT_CONTROLLER_NAME;
string panelName = DEFAULT_PANEL_NAME;
string igcTag = DEFAULT_IGC_TAG;
bool writePanel = true;
bool broadcastIgc = true;
double updateIntervalSeconds = 10;

IMyShipController controller;
IMyTextPanel telemetryPanel;

readonly List<IMyTerminalBlock> terminalBlocks = new List<IMyTerminalBlock>();
int sequence;
DateTime lastPacketAt = DateTime.MinValue;

public Program()
{
    Runtime.UpdateFrequency = UpdateFrequency.Update100;
    int.TryParse(Storage, out sequence);
    LoadConfig();
}

public void Main(string argument, UpdateType updateSource)
{
    string command = (argument ?? "").Trim().ToLower();
    if (command == "setup")
    {
        WriteDefaultConfig();
        LoadConfig();
        SetupPanel();
    }
    else if (command == "reload")
    {
        LoadConfig();
        SetupPanel();
    }
    else if (command == "reset")
    {
        sequence = 0;
        Storage = "0";
    }
    else if (command == "status")
    {
        EchoStatus();
        return;
    }

    bool forcePacket = command == "once" || command == "setup" || command == "reload";
    if (!forcePacket && updateIntervalSeconds > 0 && lastPacketAt != DateTime.MinValue)
    {
        double elapsedSeconds = (DateTime.UtcNow - lastPacketAt).TotalSeconds;
        if (elapsedSeconds < updateIntervalSeconds) return;
    }

    RefreshBlocks();

    if (controller == null)
    {
        Echo("ShipOS uplink offline: controller not found.");
        Echo("Set ControllerName in PB Custom Data, name a cockpit/remote control, or set a main cockpit.");
        return;
    }

    sequence++;
    Storage = sequence.ToString();
    lastPacketAt = DateTime.UtcNow;

    string packet = BuildPacket();
    Echo("ShipOS uplink " + PROTOCOL + " seq " + sequence);
    Echo(packet);

    if (writePanel && telemetryPanel != null)
    {
        telemetryPanel.WriteText(packet);
    }

    if (broadcastIgc)
    {
        IGC.SendBroadcastMessage(igcTag, packet);
    }
}

void WriteDefaultConfig()
{
    if (!string.IsNullOrWhiteSpace(Me.CustomData)) return;
    Me.CustomData =
        "ShipName=" + DEFAULT_SHIP_NAME + "\n" +
        "ControllerName=" + DEFAULT_CONTROLLER_NAME + "\n" +
        "PanelName=" + DEFAULT_PANEL_NAME + "\n" +
        "IgcTag=" + DEFAULT_IGC_TAG + "\n" +
        "WritePanel=true\n" +
        "BroadcastIgc=true\n" +
        "UpdateIntervalSeconds=10\n" +
        "# Contact=asteroid|Nickel Asteroid|72000|138000|-121000|Asteroid contact|Nickel-rich claim|#b58b5a\n" +
        "# GPS:Ice Claim:12345.67:-890.12:45678.9:#FF75D69D:\n";
}

void LoadConfig()
{
    shipName = ReadConfig("ShipName", DEFAULT_SHIP_NAME);
    controllerName = ReadConfig("ControllerName", DEFAULT_CONTROLLER_NAME);
    panelName = ReadConfig("PanelName", DEFAULT_PANEL_NAME);
    igcTag = ReadConfig("IgcTag", DEFAULT_IGC_TAG);
    writePanel = ReadBoolConfig("WritePanel", true);
    broadcastIgc = ReadBoolConfig("BroadcastIgc", true);
    updateIntervalSeconds = ReadDoubleConfig("UpdateIntervalSeconds", 10);
}

string ReadConfig(string key, string fallback)
{
    string[] lines = (Me.CustomData ?? "").Split('\n');
    for (int i = 0; i < lines.Length; i++)
    {
        string line = lines[i].Trim();
        if (line.Length == 0 || line.StartsWith("#")) continue;
        int split = line.IndexOf('=');
        if (split <= 0) continue;
        string name = line.Substring(0, split).Trim();
        if (!name.Equals(key, StringComparison.OrdinalIgnoreCase)) continue;
        string value = line.Substring(split + 1).Trim();
        return value.Length > 0 ? value : fallback;
    }
    return fallback;
}

bool ReadBoolConfig(string key, bool fallback)
{
    string value = ReadConfig(key, fallback ? "true" : "false").ToLower();
    return value == "true" || value == "yes" || value == "1" || value == "on";
}

double ReadDoubleConfig(string key, double fallback)
{
    double value;
    if (double.TryParse(ReadConfig(key, fallback.ToString()), out value))
    {
        return Math.Max(0, value);
    }
    return fallback;
}

void SetupPanel()
{
    telemetryPanel = GridTerminalSystem.GetBlockWithName(panelName) as IMyTextPanel;
    if (telemetryPanel != null)
    {
        telemetryPanel.ContentType = ContentType.TEXT_AND_IMAGE;
        telemetryPanel.Font = "Monospace";
        telemetryPanel.FontSize = 0.62f;
        telemetryPanel.WriteText("ShipOS telemetry uplink armed.\nTag: " + igcTag);
    }
}

void RefreshBlocks()
{
    terminalBlocks.Clear();
    GridTerminalSystem.GetBlocksOfType(terminalBlocks, block => block.IsSameConstructAs(Me));

    controller = GridTerminalSystem.GetBlockWithName(controllerName) as IMyShipController;
    if (controller == null || !controller.IsSameConstructAs(Me))
    {
        controller = null;
        for (int i = 0; i < terminalBlocks.Count; i++)
        {
            IMyShipController candidate = terminalBlocks[i] as IMyShipController;
            if (candidate == null) continue;
            if (candidate.IsMainCockpit)
            {
                controller = candidate;
                break;
            }
            if (controller == null) controller = candidate;
        }
    }

    telemetryPanel = GridTerminalSystem.GetBlockWithName(panelName) as IMyTextPanel;
}

string BuildPacket()
{
    Vector3D position = controller.GetPosition();
    MyShipVelocities velocities = controller.GetShipVelocities();
    Vector3D linearVelocity = velocities.LinearVelocity;
    Vector3D angularVelocity = velocities.AngularVelocity;
    MyShipMass mass = controller.CalculateShipMass();

    double batteryCurrent = 0;
    double batteryMax = 0;
    double gasTotal = 0;
    int gasCount = 0;
    double hydrogenTotal = 0;
    int hydrogenCount = 0;
    double oxygenTotal = 0;
    int oxygenCount = 0;
    double jumpCurrent = 0;
    double jumpMax = 0;
    double reactorCurrent = 0;
    double reactorMax = 0;
    double thrustCurrent = 0;
    double thrustMax = 0;
    double cargoCurrent = 0;
    double cargoMax = 0;

    int terminalBlockCount = terminalBlocks.Count;
    int functionalBlockCount = 0;
    int nonFunctionalBlockCount = 0;
    int notWorkingBlockCount = 0;
    int batteryCount = 0;
    int gasTankCount = 0;
    int jumpDriveCount = 0;
    int reactorCount = 0;
    int inventoryCount = 0;
    int thrusterCount = 0;
    int gyroCount = 0;
    int connectorCount = 0;
    int connectedConnectorCount = 0;
    int landingGearCount = 0;
    int lockedLandingGearCount = 0;
    int airVentCount = 0;
    int pressurizedVentCount = 0;
    int antennaCount = 0;
    int weaponCount = 0;
    int toolCount = 0;

    for (int i = 0; i < terminalBlocks.Count; i++)
    {
        IMyTerminalBlock block = terminalBlocks[i];
        if (block.IsFunctional) functionalBlockCount++;
        else nonFunctionalBlockCount++;
        if (!block.IsWorking) notWorkingBlockCount++;

        IMyBatteryBlock battery = block as IMyBatteryBlock;
        if (battery != null)
        {
            batteryCount++;
            batteryCurrent += battery.CurrentStoredPower;
            batteryMax += battery.MaxStoredPower;
        }

        IMyGasTank tank = block as IMyGasTank;
        if (tank != null)
        {
            gasTankCount++;
            double fill = tank.FilledRatio * 100.0;
            string name = tank.CustomName.ToLower();
            gasTotal += fill;
            gasCount++;
            if (name.Contains("hydrogen") || name.Contains("h2"))
            {
                hydrogenTotal += fill;
                hydrogenCount++;
            }
            else if (name.Contains("oxygen") || name.Contains("o2"))
            {
                oxygenTotal += fill;
                oxygenCount++;
            }
        }

        IMyJumpDrive jumpDrive = block as IMyJumpDrive;
        if (jumpDrive != null)
        {
            jumpDriveCount++;
            jumpCurrent += jumpDrive.CurrentStoredPower;
            jumpMax += jumpDrive.MaxStoredPower;
        }

        IMyReactor reactor = block as IMyReactor;
        if (reactor != null)
        {
            reactorCount++;
            reactorCurrent += reactor.CurrentOutput;
            reactorMax += reactor.MaxOutput;
        }

        IMyThrust thruster = block as IMyThrust;
        if (thruster != null)
        {
            thrusterCount++;
            thrustCurrent += thruster.CurrentThrust;
            thrustMax += thruster.MaxEffectiveThrust;
        }

        IMyGyro gyro = block as IMyGyro;
        if (gyro != null) gyroCount++;

        IMyShipConnector connector = block as IMyShipConnector;
        if (connector != null)
        {
            connectorCount++;
            if (connector.Status == MyShipConnectorStatus.Connected) connectedConnectorCount++;
        }

        IMyLandingGear gear = block as IMyLandingGear;
        if (gear != null)
        {
            landingGearCount++;
            if (gear.LockMode == LandingGearMode.Locked) lockedLandingGearCount++;
        }

        IMyAirVent vent = block as IMyAirVent;
        if (vent != null)
        {
            airVentCount++;
            if (vent.CanPressurize && vent.GetOxygenLevel() >= 0.95f) pressurizedVentCount++;
        }

        if (block is IMyRadioAntenna || block is IMyLaserAntenna) antennaCount++;
        if (block is IMyUserControllableGun) weaponCount++;
        if (block is IMyShipDrill || block is IMyShipWelder || block is IMyShipGrinder) toolCount++;

        if (block.HasInventory)
        {
            for (int inventoryIndex = 0; inventoryIndex < block.InventoryCount; inventoryIndex++)
            {
                var inventory = block.GetInventory(inventoryIndex);
                inventoryCount++;
                cargoCurrent += (double)inventory.CurrentVolume;
                cargoMax += (double)inventory.MaxVolume;
            }
        }
    }

    double hydrogenPercent = hydrogenCount > 0 ? hydrogenTotal / hydrogenCount : (gasCount > 0 ? gasTotal / gasCount : 0);
    double oxygenPercent = oxygenCount > 0 ? oxygenTotal / oxygenCount : (gasCount > 0 ? gasTotal / gasCount : 0);
    double gravityG = controller.GetNaturalGravity().Length() / 9.81;
    string packetId = Me.CubeGrid.EntityId.ToString() + "-" + sequence.ToString();
    string contactsJson = BuildContactsJson();

    return "{"
        + Json("protocol", PROTOCOL) + ","
        + NumInt("version", 1) + ","
        + Json("source", "programmable-block") + ","
        + Json("packetId", packetId) + ","
        + NumInt("sequence", sequence) + ","
        + Json("ship", shipName) + ","
        + Json("grid", Me.CubeGrid.CustomName) + ","
        + Json("controller", controller.CustomName) + ","
        + Json("stamp", DateTime.UtcNow.ToString("o")) + ","
        + Num("x", position.X) + ","
        + Num("y", position.Y) + ","
        + Num("z", position.Z) + ","
        + Num("velocityX", linearVelocity.X) + ","
        + Num("velocityY", linearVelocity.Y) + ","
        + Num("velocityZ", linearVelocity.Z) + ","
        + Num("angularVelocityX", angularVelocity.X) + ","
        + Num("angularVelocityY", angularVelocity.Y) + ","
        + Num("angularVelocityZ", angularVelocity.Z) + ","
        + Num("speed", linearVelocity.Length()) + ","
        + Num("mass", mass.PhysicalMass) + ","
        + Num("naturalGravity", gravityG) + ","
        + BuildFlightTelemetry(linearVelocity)
        + Bool("dampeners", controller.DampenersOverride) + ","
        + Bool("underControl", controller.IsUnderControl) + ","
        + Num("batteryPercent", Percent(batteryCurrent, batteryMax)) + ","
        + Num("hydrogenPercent", hydrogenPercent) + ","
        + Num("oxygenPercent", oxygenPercent) + ","
        + Num("jumpPercent", Percent(jumpCurrent, jumpMax)) + ","
        + Num("reactorPercent", Percent(reactorCurrent, reactorMax)) + ","
        + Num("thrustPercent", Percent(thrustCurrent, thrustMax)) + ","
        + Num("cargoPercent", Percent(cargoCurrent, cargoMax)) + ","
        + Num("cargoCurrentVolume", cargoCurrent) + ","
        + Num("cargoMaxVolume", cargoMax) + ","
        + NumInt("terminalBlockCount", terminalBlockCount) + ","
        + NumInt("functionalBlockCount", functionalBlockCount) + ","
        + NumInt("nonFunctionalBlockCount", nonFunctionalBlockCount) + ","
        + NumInt("notWorkingBlockCount", notWorkingBlockCount) + ","
        + NumInt("batteryCount", batteryCount) + ","
        + NumInt("gasTankCount", gasTankCount) + ","
        + NumInt("hydrogenTankCount", hydrogenCount) + ","
        + NumInt("oxygenTankCount", oxygenCount) + ","
        + NumInt("jumpDriveCount", jumpDriveCount) + ","
        + NumInt("reactorCount", reactorCount) + ","
        + NumInt("inventoryCount", inventoryCount) + ","
        + NumInt("thrusterCount", thrusterCount) + ","
        + NumInt("gyroCount", gyroCount) + ","
        + NumInt("connectorCount", connectorCount) + ","
        + NumInt("connectedConnectorCount", connectedConnectorCount) + ","
        + NumInt("landingGearCount", landingGearCount) + ","
        + NumInt("lockedLandingGearCount", lockedLandingGearCount) + ","
        + NumInt("airVentCount", airVentCount) + ","
        + NumInt("pressurizedVentCount", pressurizedVentCount) + ","
        + NumInt("antennaCount", antennaCount) + ","
        + NumInt("weaponCount", weaponCount) + ","
        + NumInt("toolCount", toolCount) + ","
        + "\"contacts\":" + contactsJson + ","
        + NumInt("instructionCount", Runtime.CurrentInstructionCount)
        + "}";
}

string BuildFlightTelemetry(Vector3D linearVelocity)
{
    Vector3D gravity = controller.GetNaturalGravity();
    MatrixD orientation = controller.WorldMatrix;
    string telemetry = Num("gravityX", gravity.X) + ","
        + Num("gravityY", gravity.Y) + ","
        + Num("gravityZ", gravity.Z) + ","
        + Num("forwardX", orientation.Forward.X) + ","
        + Num("forwardY", orientation.Forward.Y) + ","
        + Num("forwardZ", orientation.Forward.Z) + ","
        + Num("upX", orientation.Up.X) + ","
        + Num("upY", orientation.Up.Y) + ","
        + Num("upZ", orientation.Up.Z) + ",";

    if (gravity.LengthSquared() > 0.0001)
    {
        Vector3D radialUp = Vector3D.Normalize(-gravity);
        double verticalSpeed = Vector3D.Dot(linearVelocity, radialUp);
        double horizontalSpeed = Math.Sqrt(Math.Max(0, linearVelocity.LengthSquared() - verticalSpeed * verticalSpeed));
        telemetry += Num("verticalSpeed", verticalSpeed) + ","
            + Num("horizontalSpeed", horizontalSpeed) + ",";
    }

    double surfaceAltitude;
    if (controller.TryGetPlanetElevation(MyPlanetElevation.Surface, out surfaceAltitude))
    {
        telemetry += Num("surfaceAltitude", surfaceAltitude) + ",";
    }

    double seaLevelAltitude;
    if (controller.TryGetPlanetElevation(MyPlanetElevation.Sealevel, out seaLevelAltitude))
    {
        telemetry += Num("seaLevelAltitude", seaLevelAltitude) + ",";
    }

    Vector3D planetCenter;
    if (controller.TryGetPlanetPosition(out planetCenter))
    {
        telemetry += Num("planetCenterX", planetCenter.X) + ","
            + Num("planetCenterY", planetCenter.Y) + ","
            + Num("planetCenterZ", planetCenter.Z) + ",";
    }

    return telemetry;
}

string BuildContactsJson()
{
    List<string> contacts = new List<string>();
    string[] lines = (Me.CustomData ?? "").Split('\n');
    for (int i = 0; i < lines.Length; i++)
    {
        string line = lines[i].Trim();
        if (line.Length == 0 || line.StartsWith("#")) continue;
        string value = line;
        int split = line.IndexOf('=');
        if (split > 0)
        {
            string key = line.Substring(0, split).Trim();
            if (!key.Equals("Contact", StringComparison.OrdinalIgnoreCase)) continue;
            value = line.Substring(split + 1).Trim();
        }
        else if (!line.StartsWith("GPS:", StringComparison.OrdinalIgnoreCase))
        {
            continue;
        }

        string contactJson = value.StartsWith("GPS:", StringComparison.OrdinalIgnoreCase)
            ? ContactJsonFromGps(value, contacts.Count)
            : ContactJsonFromPipe(value, contacts.Count);
        if (contactJson.Length > 0) contacts.Add(contactJson);
    }
    return "[" + string.Join(",", contacts.ToArray()) + "]";
}

string ContactJsonFromPipe(string value, int index)
{
    string[] parts = value.Split('|');
    if (parts.Length < 5) return "";

    string kind = NormalizeContactKind(parts[0]);
    string name = parts[1].Trim();
    double x;
    double y;
    double z;
    if (!TryParseDouble(parts[2], out x) || !TryParseDouble(parts[3], out y) || !TryParseDouble(parts[4], out z)) return "";

    string status = parts.Length > 5 && parts[5].Trim().Length > 0 ? parts[5].Trim() : DefaultStatusForKind(kind);
    string notes = parts.Length > 6 ? parts[6].Trim() : "Programmable block Custom Data contact.";
    string color = parts.Length > 7 && parts[7].Trim().Length > 0 ? parts[7].Trim() : DefaultColorForKind(kind);
    return BuildContactObject("pb-contact-" + index.ToString(), name, kind, x, y, z, status, notes, color);
}

string ContactJsonFromGps(string value, int index)
{
    string[] parts = value.Split(':');
    if (parts.Length < 5) return "";

    string name = parts[1].Trim();
    double x;
    double y;
    double z;
    if (!TryParseDouble(parts[2], out x) || !TryParseDouble(parts[3], out y) || !TryParseDouble(parts[4], out z)) return "";

    string color = parts.Length > 5 && parts[5].Trim().Length > 0 ? GpsColor(parts[5].Trim()) : DefaultColorForKind("gps");
    return BuildContactObject("pb-gps-" + index.ToString(), name, "gps", x, y, z, "GPS imported", value, color);
}

string BuildContactObject(string id, string name, string kind, double x, double y, double z, string status, string notes, string color)
{
    if (name.Length == 0) name = "Telemetry Contact";
    return "{"
        + Json("id", id) + ","
        + Json("name", name) + ","
        + Json("kind", kind) + ","
        + Json("className", DefaultClassForKind(kind)) + ","
        + Num("x", x) + ","
        + Num("y", y) + ","
        + Num("z", z) + ","
        + Json("status", status) + ","
        + Json("notes", notes) + ","
        + Json("color", color)
        + "}";
}

bool TryParseDouble(string text, out double value)
{
    return double.TryParse((text ?? "").Trim().Replace(",", "."), out value);
}

string NormalizeContactKind(string value)
{
    string kind = (value ?? "").Trim().ToLower();
    if (kind == "gps" || kind == "waypoint" || kind == "asteroid" || kind == "radar" || kind == "signal" || kind == "ship" || kind == "station" || kind == "relay") return kind;
    if (kind == "unknown" || kind == "unidentified") return "signal";
    if (kind == "ore" || kind == "resource") return "asteroid";
    if (kind == "vessel") return "ship";
    if (kind == "base") return "station";
    if (kind == "beacon") return "relay";
    return "signal";
}

string DefaultClassForKind(string kind)
{
    if (kind == "gps") return "GPS fix";
    if (kind == "waypoint") return "Navigation waypoint";
    if (kind == "asteroid") return "Asteroid / resource contact";
    if (kind == "radar") return "Radar contact";
    if (kind == "signal") return "Unidentified signal";
    if (kind == "ship") return "Vessel contact";
    if (kind == "station") return "Station contact";
    if (kind == "relay") return "Communications relay";
    return "Telemetry contact";
}

string DefaultStatusForKind(string kind)
{
    if (kind == "gps") return "GPS imported";
    if (kind == "asteroid") return "Asteroid contact";
    if (kind == "radar") return "Radar contact";
    if (kind == "signal") return "Unidentified signal";
    if (kind == "ship") return "Vessel contact";
    if (kind == "station") return "Station contact";
    if (kind == "relay") return "Relay contact";
    return "Telemetry contact";
}

string DefaultColorForKind(string kind)
{
    if (kind == "gps") return "#7de8d2";
    if (kind == "asteroid") return "#b58b5a";
    if (kind == "radar") return "#8fb4ff";
    if (kind == "signal") return "#ff6b61";
    if (kind == "ship") return "#d68ebd";
    if (kind == "station") return "#f6b94d";
    if (kind == "relay") return "#63d7ff";
    return "#f1e2c6";
}

string GpsColor(string value)
{
    string color = value.Trim();
    if (color.Length == 9 && color[0] == '#') return "#" + color.Substring(3);
    return color.StartsWith("#") ? color : "#" + color;
}

void EchoStatus()
{
    RefreshBlocks();
    Echo("ShipOS uplink status");
    Echo("Protocol: " + PROTOCOL);
    Echo("Ship: " + shipName);
    Echo("Controller: " + (controller == null ? "missing" : controller.CustomName));
    Echo("Panel: " + (telemetryPanel == null ? "missing/disabled" : telemetryPanel.CustomName));
    Echo("IGC tag: " + igcTag);
    Echo("Interval seconds: " + updateIntervalSeconds.ToString("0.##"));
    Echo("Blocks scanned: " + terminalBlocks.Count);
    Echo("Next sequence: " + (sequence + 1));
}

double Percent(double current, double max)
{
    if (max <= 0) return 0;
    return Math.Max(0, Math.Min(100, current / max * 100.0));
}

string Num(string key, double value)
{
    string text = Math.Round(value, 3).ToString("0.###").Replace(",", ".");
    return "\"" + key + "\":" + text;
}

string NumInt(string key, int value)
{
    return "\"" + key + "\":" + value.ToString();
}

string Bool(string key, bool value)
{
    return "\"" + key + "\":" + (value ? "true" : "false");
}

string Json(string key, string value)
{
    return "\"" + key + "\":\"" + Escape(value) + "\"";
}

string Escape(string value)
{
    if (value == null) return "";
    return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
