using Sandbox.Game.Entities;
using Sandbox.ModAPI;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using VRage.Game.ModAPI;
using VRage.ModAPI;
using VRage.Plugins;
using VRageMath;

namespace ShipOSClientPlugin
{
    public sealed class Plugin : IPlugin, IDisposable
    {
        public const string Name = "ShipOSClientPlugin";
        private const string Protocol = "shipos.telemetry.v1";
        private const double TerrainScanRangeMeters = 1600.0;
        private const double TerrainScanCeilingMeters = 12000.0;
        private static readonly double[] TerrainAheadMeters = { 0.0, 200.0, 450.0, 800.0, 1200.0, 1600.0 };
        private static readonly double[] TerrainLateralFactors = { -1.0, -0.5, 0.0, 0.5, 1.0 };

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        private readonly HashSet<IMyEntity> entities = new HashSet<IMyEntity>();
        private readonly List<ContactPacket> contacts = new List<ContactPacket>();
        private readonly List<IHitInfo> terrainHits = new List<IHitInfo>(12);

        private string endpoint = "http://127.0.0.1:8795/telemetry";
        private string shipName = "DSV Intrepid";
        private double intervalSeconds = 2;
        private double contactRangeMeters = 250000;
        private int maxContacts = 80;
        private int sequence;
        private DateTime lastSentAt = DateTime.MinValue;
        private bool postInFlight;

        public void Init(object gameInstance)
        {
            LoadConfig();
        }

        public void Update()
        {
            if (postInFlight) return;
            if ((DateTime.UtcNow - lastSentAt).TotalSeconds < intervalSeconds) return;

            IMyPlayer player = MyAPIGateway.Session == null ? null : MyAPIGateway.Session.Player;
            if (player == null) return;

            string packet = BuildPacket(player);
            if (string.IsNullOrWhiteSpace(packet)) return;

            sequence++;
            lastSentAt = DateTime.UtcNow;
            PostPacket(packet);
        }

        public void Dispose()
        {
            SaveStatus("Disposed");
        }

        private string BuildPacket(IMyPlayer player)
        {
            IMyEntity controlledEntity = GetControlledEntity(player);
            Vector3D? position = null;
            if (controlledEntity == null)
            {
                position = GetPlayerPosition(player);
            }
            else
            {
                position = new Vector3D(controlledEntity.GetPosition());
            }
            if (!position.HasValue) return "";

            Vector3D velocity = Vector3D.Zero;
            if (controlledEntity != null && controlledEntity.Physics != null)
            {
                velocity = new Vector3D(controlledEntity.Physics.LinearVelocity);
            }

            contacts.Clear();
            ScanContacts(position.Value, controlledEntity);

            string gridName = controlledEntity == null ? "" : EntityName(controlledEntity);
            string packetId = "client-" + sequence.ToString(CultureInfo.InvariantCulture) + "-" + DateTime.UtcNow.Ticks.ToString(CultureInfo.InvariantCulture);

            StringBuilder json = new StringBuilder(16384);
            json.Append("{");
            AppendJson(json, "protocol", Protocol).Append(",");
            AppendNumber(json, "version", 1).Append(",");
            AppendJson(json, "source", "client-plugin").Append(",");
            AppendJson(json, "packetId", packetId).Append(",");
            AppendNumber(json, "sequence", sequence).Append(",");
            AppendJson(json, "ship", shipName).Append(",");
            AppendJson(json, "grid", gridName).Append(",");
            AppendJson(json, "controller", PlayerName(player)).Append(",");
            AppendJson(json, "stamp", DateTime.UtcNow.ToString("o")).Append(",");
            AppendNumber(json, "x", position.Value.X).Append(",");
            AppendNumber(json, "y", position.Value.Y).Append(",");
            AppendNumber(json, "z", position.Value.Z).Append(",");
            AppendNumber(json, "velocityX", velocity.X).Append(",");
            AppendNumber(json, "velocityY", velocity.Y).Append(",");
            AppendNumber(json, "velocityZ", velocity.Z).Append(",");
            AppendNumber(json, "speed", velocity.Length()).Append(",");
            Sandbox.ModAPI.IMyShipController controller = controlledEntity as Sandbox.ModAPI.IMyShipController;
            AppendFlightTelemetry(json, controller, velocity);
            AppendTerrainScan(json, controller, position.Value);
            AppendNumber(json, "contactCount", contacts.Count).Append(",");
            json.Append("\"contacts\":[");
            for (int index = 0; index < contacts.Count; index++)
            {
                if (index > 0) json.Append(",");
                contacts[index].AppendJson(json);
            }
            json.Append("]}");
            return json.ToString();
        }

        private static void AppendFlightTelemetry(StringBuilder json, Sandbox.ModAPI.IMyShipController controller, Vector3D velocity)
        {
            if (controller == null) return;

            Vector3D gravity = controller.GetNaturalGravity();
            MatrixD orientation = controller.WorldMatrix;
            AppendNumber(json, "naturalGravity", gravity.Length() / 9.81).Append(",");
            AppendNumber(json, "gravityX", gravity.X).Append(",");
            AppendNumber(json, "gravityY", gravity.Y).Append(",");
            AppendNumber(json, "gravityZ", gravity.Z).Append(",");
            AppendNumber(json, "forwardX", orientation.Forward.X).Append(",");
            AppendNumber(json, "forwardY", orientation.Forward.Y).Append(",");
            AppendNumber(json, "forwardZ", orientation.Forward.Z).Append(",");
            AppendNumber(json, "upX", orientation.Up.X).Append(",");
            AppendNumber(json, "upY", orientation.Up.Y).Append(",");
            AppendNumber(json, "upZ", orientation.Up.Z).Append(",");

            if (gravity.LengthSquared() > 0.0001)
            {
                Vector3D radialUp = Vector3D.Normalize(-gravity);
                double verticalSpeed = Vector3D.Dot(velocity, radialUp);
                double horizontalSpeed = Math.Sqrt(Math.Max(0, velocity.LengthSquared() - verticalSpeed * verticalSpeed));
                AppendNumber(json, "verticalSpeed", verticalSpeed).Append(",");
                AppendNumber(json, "horizontalSpeed", horizontalSpeed).Append(",");
            }

            double surfaceAltitude;
            if (controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Surface, out surfaceAltitude))
            {
                AppendNumber(json, "surfaceAltitude", surfaceAltitude).Append(",");
            }

            double seaLevelAltitude;
            if (controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Sealevel, out seaLevelAltitude))
            {
                AppendNumber(json, "seaLevelAltitude", seaLevelAltitude).Append(",");
            }

            Vector3D planetCenter;
            if (controller.TryGetPlanetPosition(out planetCenter))
            {
                AppendNumber(json, "planetCenterX", planetCenter.X).Append(",");
                AppendNumber(json, "planetCenterY", planetCenter.Y).Append(",");
                AppendNumber(json, "planetCenterZ", planetCenter.Z).Append(",");
            }
        }

        private void AppendTerrainScan(StringBuilder json, Sandbox.ModAPI.IMyShipController controller, Vector3D position)
        {
            if (controller == null || MyAPIGateway.Physics == null) return;

            Vector3D gravity = controller.GetNaturalGravity();
            if (gravity.LengthSquared() < 0.0001) return;

            double surfaceAltitude;
            if (!controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Surface, out surfaceAltitude)) return;

            AppendJson(json, "terrainScanSource", "physics-voxel-raycast").Append(",");
            AppendNumber(json, "terrainScanRange", TerrainScanRangeMeters).Append(",");
            AppendNumber(json, "terrainScanWidth", 2.0 * (50.0 + TerrainScanRangeMeters * 0.28)).Append(",");
            AppendNumber(json, "terrainScanRows", TerrainAheadMeters.Length).Append(",");
            AppendNumber(json, "terrainScanColumns", TerrainLateralFactors.Length).Append(",");

            if (surfaceAltitude > TerrainScanCeilingMeters)
            {
                AppendJson(json, "terrainScanStatus", "standby-high-altitude").Append(",\"terrainScan\":[],");
                return;
            }

            Vector3D radialUp = Vector3D.Normalize(-gravity);
            Vector3D tangentForward = controller.WorldMatrix.Forward - radialUp * Vector3D.Dot(controller.WorldMatrix.Forward, radialUp);
            if (tangentForward.LengthSquared() < 0.0001)
            {
                tangentForward = controller.WorldMatrix.Up - radialUp * Vector3D.Dot(controller.WorldMatrix.Up, radialUp);
            }
            if (tangentForward.LengthSquared() < 0.0001)
            {
                AppendJson(json, "terrainScanStatus", "standby-no-forward-vector").Append(",\"terrainScan\":[],");
                return;
            }

            tangentForward.Normalize();
            Vector3D tangentRight = Vector3D.Cross(tangentForward, radialUp);
            tangentRight.Normalize();
            double probeHeight = Math.Max(750.0, Math.Min(4000.0, surfaceAltitude + 1000.0));
            double rayDepth = probeHeight + Math.Max(6000.0, surfaceAltitude + 3500.0);
            int written = 0;

            AppendJson(json, "terrainScanStatus", "live").Append(",\"terrainScan\":[");
            for (int row = 0; row < TerrainAheadMeters.Length; row++)
            {
                double ahead = TerrainAheadMeters[row];
                double halfWidth = 50.0 + ahead * 0.28;
                for (int column = 0; column < TerrainLateralFactors.Length; column++)
                {
                    double lateral = halfWidth * TerrainLateralFactors[column];
                    Vector3D sampleCenter = position + tangentForward * ahead + tangentRight * lateral;
                    Vector3D rayStart = sampleCenter + radialUp * probeHeight;
                    Vector3D rayEnd = rayStart - radialUp * rayDepth;
                    IHitInfo terrainHit = FindTerrainHit(rayStart, rayEnd);
                    if (terrainHit == null) continue;

                    double clearance = Vector3D.Dot(position - terrainHit.Position, radialUp);
                    double surfaceDelta = surfaceAltitude - clearance;
                    if (written > 0) json.Append(",");
                    json.Append("{");
                    AppendNumber(json, "row", row).Append(",");
                    AppendNumber(json, "column", column).Append(",");
                    AppendNumber(json, "ahead", ahead).Append(",");
                    AppendNumber(json, "lateral", lateral).Append(",");
                    AppendNumber(json, "clearance", clearance).Append(",");
                    AppendNumber(json, "surfaceDelta", surfaceDelta);
                    json.Append("}");
                    written++;
                }
            }
            json.Append("],");
        }

        private IHitInfo FindTerrainHit(Vector3D start, Vector3D end)
        {
            terrainHits.Clear();
            try
            {
                MyAPIGateway.Physics.CastRay(start, end, terrainHits, 0);
                for (int index = 0; index < terrainHits.Count; index++)
                {
                    IHitInfo hit = terrainHits[index];
                    if (hit != null && IsVoxelEntity(hit.HitEntity)) return hit;
                }
            }
            catch
            {
            }
            return null;
        }

        private static bool IsVoxelEntity(IMyEntity entity)
        {
            int guard = 0;
            while (entity != null && guard < 8)
            {
                if (entity is IMyVoxelBase) return true;
                entity = entity.Parent;
                guard++;
            }
            return false;
        }

        private void ScanContacts(Vector3D origin, IMyEntity controlledEntity)
        {
            entities.Clear();
            try
            {
                MyAPIGateway.Entities.GetEntities(entities, entity => entity != null);
            }
            catch
            {
                return;
            }

            foreach (IMyEntity entity in entities)
            {
                MyPlanet planet = entity as MyPlanet;
                if (planet == null || entity.Closed || entity.MarkedForClose) continue;

                ContactPacket planetContact;
                Vector3D center = planet.LocationForHudMarker;
                if (TryCreateContact(planet, center, Vector3D.Distance(origin, center), out planetContact))
                {
                    contacts.Add(planetContact);
                }
            }

            int nearbyCount = 0;
            foreach (IMyEntity entity in entities)
            {
                if (entity == null) continue;
                if (entity is MyPlanet) continue;
                if (controlledEntity != null && entity.EntityId == controlledEntity.EntityId) continue;
                if (IsInternalTelemetryEntity(entity)) continue;

                Vector3D position;
                try
                {
                    position = entity.GetPosition();
                }
                catch
                {
                    continue;
                }

                double distance = Vector3D.Distance(origin, position);
                if (distance > contactRangeMeters) continue;

                ContactPacket contact;
                if (!TryCreateContact(entity, position, distance, out contact)) continue;
                contacts.Add(contact);
                nearbyCount++;
                if (nearbyCount >= maxContacts) break;
            }
        }

        private bool TryCreateContact(IMyEntity entity, Vector3D position, double distance, out ContactPacket contact)
        {
            contact = null;
            MyPlanet planet = entity as MyPlanet;
            if (planet != null)
            {
                string entityId = planet.EntityId.ToString(CultureInfo.InvariantCulture);
                string generatorName = planet.Generator == null
                    ? "Planet"
                    : planet.Generator.Id.SubtypeName.ToString();
                string storageName = planet.StorageName ?? "";
                contact = new ContactPacket
                {
                    Id = "planet-" + entityId,
                    EntityId = entityId,
                    Name = EntityName(planet),
                    Kind = "body",
                    ClassName = generatorName + " planetary body",
                    Status = "Authoritative in-game planet registry",
                    X = position.X,
                    Y = position.Y,
                    Z = position.Z,
                    RadiusMeters = planet.AverageRadius,
                    DistanceMeters = distance,
                    GeneratorName = generatorName,
                    StorageName = storageName,
                    HasAtmosphere = planet.HasAtmosphere,
                    SurfaceGravity = planet.Generator == null ? 0 : planet.Generator.SurfaceGravity,
                    Color = "#7de8d2",
                    Notes = "Space Engineers planet entity " + entityId + " / storage " + storageName,
                    ContactSource = "planet-registry"
                };
                return true;
            }

            Vector3D velocity = EntityVelocity(entity);
            IMyCubeGrid grid = entity as IMyCubeGrid;
            if (grid != null)
            {
                string relationship = GridRelationship(grid);
                string antennaName = FindRadioSource(grid);
                string contactSource = string.IsNullOrWhiteSpace(antennaName) ? "grid" : "antenna";
                contact = new ContactPacket
                {
                    Id = "grid-" + entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    EntityId = entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    Name = EntityName(entity),
                    Kind = grid.IsStatic ? "station" : "ship",
                    ClassName = CultureInfo.InvariantCulture.TextInfo.ToTitleCase(relationship) + " " + (contactSource == "antenna" ? "antenna contact" : grid.GridSizeEnum.ToString() + " grid"),
                    Status = contactSource == "antenna"
                        ? CultureInfo.InvariantCulture.TextInfo.ToTitleCase(relationship) + " antenna broadcast"
                        : (grid.IsStatic ? "Static grid contact" : "Mobile grid contact"),
                    X = position.X,
                    Y = position.Y,
                    Z = position.Z,
                    VelocityX = velocity.X,
                    VelocityY = velocity.Y,
                    VelocityZ = velocity.Z,
                    Speed = velocity.Length(),
                    DistanceMeters = distance,
                    Color = ContactColor(relationship, grid.IsStatic),
                    Notes = "Client plugin " + contactSource + " contact at " + Math.Round(distance / 1000, 1).ToString(CultureInfo.InvariantCulture) + " km.",
                    Relationship = relationship,
                    ContactSource = contactSource,
                    AntennaName = antennaName
                };
                return true;
            }

            string typeName = entity.GetType().Name;
            if (typeName.IndexOf("Voxel", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                contact = new ContactPacket
                {
                    Id = "voxel-" + entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    EntityId = entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    Name = EntityName(entity),
                    Kind = "asteroid",
                    ClassName = "Voxel / asteroid body",
                    Status = "Voxel contact",
                    X = position.X,
                    Y = position.Y,
                    Z = position.Z,
                    VelocityX = velocity.X,
                    VelocityY = velocity.Y,
                    VelocityZ = velocity.Z,
                    Speed = velocity.Length(),
                    DistanceMeters = distance,
                    Color = "#b58b5a",
                    Notes = "Client plugin voxel contact at " + Math.Round(distance / 1000, 1).ToString(CultureInfo.InvariantCulture) + " km."
                };
                return true;
            }

            if (typeName.IndexOf("Floating", StringComparison.OrdinalIgnoreCase) >= 0 ||
                typeName.IndexOf("Signal", StringComparison.OrdinalIgnoreCase) >= 0 ||
                typeName.IndexOf("Gps", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                contact = new ContactPacket
                {
                    Id = "signal-" + entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    EntityId = entity.EntityId.ToString(CultureInfo.InvariantCulture),
                    Name = EntityName(entity),
                    Kind = "signal",
                    ClassName = typeName,
                    Status = "Unidentified signal",
                    X = position.X,
                    Y = position.Y,
                    Z = position.Z,
                    VelocityX = velocity.X,
                    VelocityY = velocity.Y,
                    VelocityZ = velocity.Z,
                    Speed = velocity.Length(),
                    DistanceMeters = distance,
                    Color = "#ff6b61",
                    Notes = "Client plugin non-grid contact at " + Math.Round(distance / 1000, 1).ToString(CultureInfo.InvariantCulture) + " km."
                };
                return true;
            }

            return false;
        }

        private void PostPacket(string packet)
        {
            postInFlight = true;
            Task.Run(async () =>
            {
                try
                {
                    using (StringContent content = new StringContent(packet, Encoding.UTF8, "application/json"))
                    using (HttpResponseMessage response = await Http.PostAsync(endpoint, content).ConfigureAwait(false))
                    {
                        SaveStatus(response.IsSuccessStatusCode ? "Last post OK " + DateTime.Now.ToString("s") : "Bridge HTTP " + ((int)response.StatusCode).ToString(CultureInfo.InvariantCulture));
                    }
                }
                catch (Exception error)
                {
                    SaveStatus("Bridge post failed: " + error.Message);
                }
                finally
                {
                    postInFlight = false;
                }
            });
        }

        private void LoadConfig()
        {
            string path = ConfigPath();
            if (!File.Exists(path))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllText(path,
                    "Endpoint=http://127.0.0.1:8795/telemetry\r\n" +
                    "ShipName=DSV Intrepid\r\n" +
                    "IntervalSeconds=2\r\n" +
                    "ContactRangeMeters=250000\r\n" +
                    "MaxContacts=80\r\n");
            }

            foreach (string rawLine in File.ReadAllLines(path))
            {
                string line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;
                int split = line.IndexOf('=');
                if (split <= 0) continue;
                string key = line.Substring(0, split).Trim();
                string value = line.Substring(split + 1).Trim();
                if (key.Equals("Endpoint", StringComparison.OrdinalIgnoreCase) && value.Length > 0) endpoint = value;
                if (key.Equals("ShipName", StringComparison.OrdinalIgnoreCase) && value.Length > 0) shipName = value;
                if (key.Equals("IntervalSeconds", StringComparison.OrdinalIgnoreCase)) intervalSeconds = Clamp(ParseDouble(value, intervalSeconds), 0.5, 60);
                if (key.Equals("ContactRangeMeters", StringComparison.OrdinalIgnoreCase)) contactRangeMeters = Clamp(ParseDouble(value, contactRangeMeters), 1000, 5000000);
                if (key.Equals("MaxContacts", StringComparison.OrdinalIgnoreCase)) maxContacts = (int)Clamp(ParseDouble(value, maxContacts), 1, 500);
            }
        }

        private static IMyEntity GetControlledEntity(IMyPlayer player)
        {
            try
            {
                return player.Controller == null || player.Controller.ControlledEntity == null
                    ? null
                    : player.Controller.ControlledEntity.Entity;
            }
            catch
            {
                return null;
            }
        }

        private static Vector3D? GetPlayerPosition(IMyPlayer player)
        {
            object result = Invoke(player, "GetPosition");
            return result is Vector3D ? (Vector3D?)result : null;
        }

        private static string PlayerName(IMyPlayer player)
        {
            string name = ReadString(player, "DisplayName");
            return string.IsNullOrWhiteSpace(name) ? "Local Player" : name;
        }

        private static Vector3D EntityVelocity(IMyEntity entity)
        {
            if (entity == null) return Vector3D.Zero;
            try
            {
                if (entity.Physics != null) return new Vector3D(entity.Physics.LinearVelocity);
            }
            catch
            {
            }
            return Vector3D.Zero;
        }

        private static string EntityName(IMyEntity entity)
        {
            string name = ReadString(entity, "DisplayName");
            if (!string.IsNullOrWhiteSpace(name)) return name;

            object friendly = Invoke(entity, "GetFriendlyName");
            name = friendly as string;
            if (!string.IsNullOrWhiteSpace(name)) return name;

            return entity.GetType().Name;
        }

        private static bool IsInternalTelemetryEntity(IMyEntity entity)
        {
            if (entity == null) return true;
            string text = (entity.GetType().Name + " " + EntityName(entity)).ToLowerInvariant();
            return text.Contains("dshield")
                || text.Contains("defensiveshield")
                || text.Contains("defense shield")
                || text.Contains("defensive shield")
                || text.Contains("shieldentity")
                || text.Contains("shield field")
                || text.Contains("shield hit");
        }

        private static string GridRelationship(IMyCubeGrid grid)
        {
            string name = EntityName(grid).ToLowerInvariant();
            if (name.Contains("pirate") || name.Contains("hostile") || name.Contains("enemy") || name.Contains("raider")) return "hostile";

            long ownerId = FirstOwnerId(grid);
            long playerId = 0;
            try
            {
                playerId = MyAPIGateway.Session == null || MyAPIGateway.Session.Player == null ? 0 : MyAPIGateway.Session.Player.IdentityId;
            }
            catch
            {
                playerId = 0;
            }

            if (ownerId != 0 && playerId != 0 && ownerId == playerId) return "owned";
            string factionRelation = FactionRelationship(ownerId, playerId);
            if (factionRelation.Length > 0) return factionRelation;
            return "neutral";
        }

        private static long FirstOwnerId(IMyCubeGrid grid)
        {
            long owner = FirstLong(ReadValue(grid, "BigOwners"));
            if (owner != 0) return owner;
            return FirstLong(ReadValue(grid, "SmallOwners"));
        }

        private static long FirstLong(object value)
        {
            IEnumerable enumerable = value as IEnumerable;
            if (enumerable == null) return 0;
            foreach (object item in enumerable)
            {
                if (item is long) return (long)item;
                if (item is int) return (int)item;
            }
            return 0;
        }

        private static string FactionRelationship(long ownerId, long playerId)
        {
            if (ownerId == 0 || playerId == 0 || MyAPIGateway.Session == null) return "";
            object factions = ReadValue(MyAPIGateway.Session, "Factions");
            object ownerFaction = Invoke(factions, "TryGetPlayerFaction", ownerId);
            object playerFaction = Invoke(factions, "TryGetPlayerFaction", playerId);
            if (ownerFaction == null || playerFaction == null) return "";

            object ownerFactionId = ReadValue(ownerFaction, "FactionId");
            object playerFactionId = ReadValue(playerFaction, "FactionId");
            if (ownerFactionId == null || playerFactionId == null) return "";
            if (ownerFactionId.Equals(playerFactionId)) return "friendly";

            object relation = Invoke(factions, "GetRelationBetweenFactions", ownerFactionId, playerFactionId);
            string relationText = relation == null ? "" : relation.ToString().ToLowerInvariant();
            if (relationText.Contains("enem")) return "hostile";
            if (relationText.Contains("ally") || relationText.Contains("friend")) return "friendly";
            if (relationText.Contains("neutral")) return "neutral";
            return "";
        }

        private static string FindRadioSource(IMyCubeGrid grid)
        {
            try
            {
                List<IMySlimBlock> blocks = new List<IMySlimBlock>();
                grid.GetBlocks(blocks, block => block != null && block.FatBlock != null && IsRadioBlock(block.FatBlock));
                for (int index = 0; index < blocks.Count; index++)
                {
                    if (blocks[index] != null && blocks[index].FatBlock != null) return BlockName(blocks[index].FatBlock);
                }
            }
            catch
            {
            }
            return "";
        }

        private static bool IsRadioBlock(IMyCubeBlock block)
        {
            if (block == null) return false;
            string text = (block.GetType().Name + " " + BlockName(block) + " " + Convert.ToString(ReadValue(block, "BlockDefinition"), CultureInfo.InvariantCulture)).ToLowerInvariant();
            return text.Contains("antenna") || text.Contains("beacon");
        }

        private static string BlockName(IMyCubeBlock block)
        {
            string customName = ReadString(block, "CustomName");
            if (!string.IsNullOrWhiteSpace(customName)) return customName;
            string displayName = ReadString(block, "DisplayNameText");
            if (!string.IsNullOrWhiteSpace(displayName)) return displayName;
            return block.GetType().Name;
        }

        private static string ContactColor(string relationship, bool isStatic)
        {
            if (relationship == "hostile") return "#ff4f4f";
            if (relationship == "owned" || relationship == "friendly") return "#75d69d";
            if (relationship == "neutral") return "#c9cdd2";
            return isStatic ? "#f6b94d" : "#d68ebd";
        }

        private static string ReadString(object target, string propertyName)
        {
            if (target == null) return "";
            try
            {
                object value = ReadValue(target, propertyName);
                return value as string ?? "";
            }
            catch
            {
                return "";
            }
        }

        private static object ReadValue(object target, string memberName)
        {
            if (target == null) return null;
            try
            {
                PropertyInfo property = target.GetType().GetProperty(memberName);
                if (property != null) return property.GetValue(target, null);
                FieldInfo field = target.GetType().GetField(memberName);
                return field == null ? null : field.GetValue(target);
            }
            catch
            {
                return null;
            }
        }

        private static object Invoke(object target, string methodName)
        {
            return Invoke(target, methodName, new object[0]);
        }

        private static object Invoke(object target, string methodName, params object[] args)
        {
            if (target == null) return null;
            try
            {
                MethodInfo[] methods = target.GetType().GetMethods();
                for (int index = 0; index < methods.Length; index++)
                {
                    MethodInfo method = methods[index];
                    if (!method.Name.Equals(methodName, StringComparison.Ordinal)) continue;
                    if (method.GetParameters().Length != args.Length) continue;
                    return method.Invoke(target, args);
                }
                return null;
            }
            catch
            {
                return null;
            }
        }

        private static string ConfigPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "SpaceEngineers",
                "Storage",
                "ShipOSClientPlugin.cfg");
        }

        private static void SaveStatus(string status)
        {
            try
            {
                string path = Path.Combine(Path.GetDirectoryName(ConfigPath()), "ShipOSClientPlugin.status.txt");
                File.WriteAllText(path, status);
            }
            catch
            {
            }
        }

        private static double ParseDouble(string value, double fallback)
        {
            double parsed;
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed) ? parsed : fallback;
        }

        private static double Clamp(double value, double min, double max)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return min;
            return Math.Max(min, Math.Min(max, value));
        }

        private static StringBuilder AppendJson(StringBuilder json, string key, string value)
        {
            json.Append("\"").Append(Escape(key)).Append("\":\"").Append(Escape(value ?? "")).Append("\"");
            return json;
        }

        private static StringBuilder AppendNumber(StringBuilder json, string key, double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) value = 0;
            json.Append("\"").Append(Escape(key)).Append("\":").Append(Math.Round(value, 3).ToString("0.###", CultureInfo.InvariantCulture));
            return json;
        }

        private static StringBuilder AppendBoolean(StringBuilder json, string key, bool value)
        {
            json.Append("\"").Append(Escape(key)).Append("\":").Append(value ? "true" : "false");
            return json;
        }

        private static string Escape(string value)
        {
            return (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private sealed class ContactPacket
        {
            public string Id;
            public string Name;
            public string Kind;
            public string ClassName;
            public string Status;
            public string Color;
            public string Notes;
            public string Relationship;
            public string ContactSource;
            public string AntennaName;
            public string EntityId;
            public string GeneratorName;
            public string StorageName;
            public double X;
            public double Y;
            public double Z;
            public double VelocityX;
            public double VelocityY;
            public double VelocityZ;
            public double Speed;
            public double DistanceMeters;
            public double RadiusMeters;
            public double SurfaceGravity;
            public bool HasAtmosphere;

            public void AppendJson(StringBuilder json)
            {
                json.Append("{");
                Plugin.AppendJson(json, "id", Id).Append(",");
                Plugin.AppendJson(json, "name", Name).Append(",");
                Plugin.AppendJson(json, "kind", Kind).Append(",");
                Plugin.AppendJson(json, "className", ClassName).Append(",");
                Plugin.AppendNumber(json, "x", X).Append(",");
                Plugin.AppendNumber(json, "y", Y).Append(",");
                Plugin.AppendNumber(json, "z", Z).Append(",");
                Plugin.AppendNumber(json, "velocityX", VelocityX).Append(",");
                Plugin.AppendNumber(json, "velocityY", VelocityY).Append(",");
                Plugin.AppendNumber(json, "velocityZ", VelocityZ).Append(",");
                Plugin.AppendNumber(json, "speed", Speed).Append(",");
                Plugin.AppendNumber(json, "distanceMeters", DistanceMeters).Append(",");
                Plugin.AppendJson(json, "status", Status).Append(",");
                Plugin.AppendJson(json, "color", Color).Append(",");
                Plugin.AppendJson(json, "notes", Notes).Append(",");
                Plugin.AppendJson(json, "relationship", Relationship ?? "").Append(",");
                Plugin.AppendJson(json, "contactSource", ContactSource ?? "").Append(",");
                Plugin.AppendJson(json, "antennaName", AntennaName ?? "").Append(",");
                Plugin.AppendJson(json, "entityId", EntityId ?? "");
                if (Kind == "body")
                {
                    json.Append(",");
                    Plugin.AppendNumber(json, "radiusMeters", RadiusMeters).Append(",");
                    Plugin.AppendJson(json, "generatorName", GeneratorName ?? "").Append(",");
                    Plugin.AppendJson(json, "storageName", StorageName ?? "").Append(",");
                    Plugin.AppendBoolean(json, "hasAtmosphere", HasAtmosphere).Append(",");
                    Plugin.AppendNumber(json, "surfaceGravity", SurfaceGravity);
                }
                json.Append("}");
            }
        }
    }
}
