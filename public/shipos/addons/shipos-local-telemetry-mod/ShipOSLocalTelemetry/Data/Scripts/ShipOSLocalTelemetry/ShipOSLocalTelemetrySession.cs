using Sandbox.Game.Entities;
using Sandbox.ModAPI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using VRage.Game;
using VRage.Game.Components;
using VRage.Game.ModAPI;
using VRage.ModAPI;
using VRageMath;

namespace ShipOSLocalTelemetry
{
    [MySessionComponentDescriptor(MyUpdateOrder.AfterSimulation)]
    public class ShipOSLocalTelemetrySession : MySessionComponentBase
    {
        private const string OutputFileName = "ShipOSLocalTelemetry.latest.json";
        private const string ModVersion = "2026.09.04.1";
        private const string FleetTag = "[ShipOS]";
        private const int MaxFleetGrids = 128;
        private const string WorldIdentityFile = "ShipOS.world-id.txt";
        private const int TickInterval = 120;
        private const int ContactScanPacketInterval = 5;
        private const double ContactRangeMeters = 250000.0;
        private const int MaxContacts = 80;
        private const double TerrainScanRangeMeters = 1600.0;
        private const double TerrainScanCeilingMeters = 12000.0;
        private static readonly double[] TerrainAheadMeters = { 0.0, 200.0, 450.0, 800.0, 1200.0, 1600.0 };
        private static readonly double[] TerrainLateralFactors = { -1.0, -0.5, 0.0, 0.5, 1.0 };

        private int _ticks;
        private int _sequence;
        private bool _announced;
        private readonly string _sessionId = Guid.NewGuid().ToString("N");
        private string _worldId;
        private string _cachedContactsJson = "[]";
        private readonly List<IHitInfo> _terrainHits = new List<IHitInfo>(12);
        private readonly HashSet<IMyEntity> _fleetCandidates = new HashSet<IMyEntity>();

        public override void UpdateAfterSimulation()
        {
            _ticks++;
            if (_ticks < TickInterval) return;
            _ticks = 0;
            WriteTelemetryPacket();
        }

        private void WriteTelemetryPacket()
        {
            if (MyAPIGateway.Session == null || MyAPIGateway.Utilities == null) return;
            if (_worldId == null) _worldId = ReadOrCreateWorldIdentity();

            IMyEntity controlled = GetControlledEntity();
            if (controlled == null) return;

            IMyEntity subject = GetTopMost(controlled);
            if (subject == null) subject = controlled;

            Vector3D position = subject.GetPosition();
            Vector3D velocity = GetVelocity(subject, controlled);
            double speed = velocity.Length();
            _sequence++;

            StringBuilder packet = new StringBuilder(16384);
            packet.Append('{');
            AppendString(packet, "source", "local-mod", false);
            AppendString(packet, "modVersion", ModVersion, true);
            AppendString(packet, "ship", SafeName(subject, "Engineer"), true);
            AppendString(packet, "grid", SafeName(subject, "Controlled Entity"), true);
            AppendString(packet, "sessionId", _sessionId, true);
            AppendString(packet, "worldId", _worldId, true);
            AppendString(packet, "worldName", MyAPIGateway.Session.Name ?? "Star System", true);
            AppendString(packet, "controlMode", controlled is Sandbox.ModAPI.IMyShipController ? "cockpit" : "character", true);
            AppendString(packet, "packetId", "shipos-local-" + _sessionId + "-" + _sequence.ToString(CultureInfo.InvariantCulture), true);
            AppendNumber(packet, "sequence", _sequence, true);
            AppendString(packet, "stamp", DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture), true);
            AppendNumber(packet, "x", position.X, true);
            AppendNumber(packet, "y", position.Y, true);
            AppendNumber(packet, "z", position.Z, true);
            AppendNumber(packet, "vx", velocity.X, true);
            AppendNumber(packet, "vy", velocity.Y, true);
            AppendNumber(packet, "vz", velocity.Z, true);
            AppendNumber(packet, "speed", speed, true);
            Sandbox.ModAPI.IMyShipController controller = controlled as Sandbox.ModAPI.IMyShipController;
            AppendFlightTelemetry(packet, controller, velocity);
            if (controller == null) AppendCharacterTelemetry(packet, controlled, position, velocity);
            AppendTerrainScan(packet, controller, position);
            if (subject is IMyCubeGrid) AppendGridSystems(packet, (IMyCubeGrid)subject);
            AppendFleetTelemetry(packet, position);
            packet.Append(",\"contacts\":");
            if (_sequence == 1 || _sequence % ContactScanPacketInterval == 0)
            {
                StringBuilder contacts = new StringBuilder(8192);
                AppendContacts(contacts, subject, position);
                _cachedContactsJson = contacts.ToString();
            }
            packet.Append(_cachedContactsJson);
            packet.Append('}');

            using (TextWriter writer = MyAPIGateway.Utilities.WriteFileInGlobalStorage(OutputFileName))
            {
                writer.Write(packet.ToString());
            }

            if (!_announced)
            {
                _announced = true;
                MyAPIGateway.Utilities.ShowMessage("ShipOS", "Local telemetry writing to Storage\\" + OutputFileName);
            }
        }

        private static string ReadOrCreateWorldIdentity()
        {
            // World storage is saved with the world, unlike the per-launch session identifier.
            if (MyAPIGateway.Utilities.FileExistsInWorldStorage(WorldIdentityFile, typeof(ShipOSLocalTelemetrySession)))
            {
                using (TextReader reader = MyAPIGateway.Utilities.ReadFileInWorldStorage(WorldIdentityFile, typeof(ShipOSLocalTelemetrySession)))
                {
                    Guid parsed;
                    if (Guid.TryParse(reader.ReadToEnd().Trim(), out parsed)) return parsed.ToString("N");
                }
            }
            string id = Guid.NewGuid().ToString("N");
            using (TextWriter writer = MyAPIGateway.Utilities.WriteFileInWorldStorage(WorldIdentityFile, typeof(ShipOSLocalTelemetrySession))) writer.Write(id);
            return id;
        }

        private static void AppendCharacterTelemetry(StringBuilder packet, IMyEntity controlled, Vector3D position, Vector3D velocity)
        {
            if (MyAPIGateway.Physics == null) return;
            float interference;
            Vector3D gravity = MyAPIGateway.Physics.CalculateNaturalGravityAt(position, out interference);
            MatrixD orientation = controlled.WorldMatrix;
            AppendNumber(packet, "naturalGravity", gravity.Length() / 9.81, true);
            AppendNumber(packet, "gravityX", gravity.X, true);
            AppendNumber(packet, "gravityY", gravity.Y, true);
            AppendNumber(packet, "gravityZ", gravity.Z, true);
            AppendNumber(packet, "forwardX", orientation.Forward.X, true);
            AppendNumber(packet, "forwardY", orientation.Forward.Y, true);
            AppendNumber(packet, "forwardZ", orientation.Forward.Z, true);
            AppendNumber(packet, "upX", orientation.Up.X, true);
            AppendNumber(packet, "upY", orientation.Up.Y, true);
            AppendNumber(packet, "upZ", orientation.Up.Z, true);
            if (gravity.LengthSquared() < 0.0001) return;
            Vector3D radialUp = Vector3D.Normalize(-gravity);
            double vertical = Vector3D.Dot(velocity, radialUp);
            AppendNumber(packet, "verticalSpeed", vertical, true);
            AppendNumber(packet, "horizontalSpeed", Math.Sqrt(Math.Max(0, velocity.LengthSquared() - vertical * vertical)), true);
            MyPlanet planet = MyGamePruningStructure.GetClosestPlanet(position);
            if (planet == null) return;
            Vector3D center = planet.PositionComp.GetPosition();
            Vector3D surface = planet.GetClosestSurfacePointGlobal(ref position);
            AppendNumber(packet, "surfaceAltitude", Vector3D.Dot(position - surface, radialUp), true);
            AppendNumber(packet, "seaLevelAltitude", Vector3D.Distance(position, center) - planet.AverageRadius, true);
            AppendNumber(packet, "planetCenterX", center.X, true);
            AppendNumber(packet, "planetCenterY", center.Y, true);
            AppendNumber(packet, "planetCenterZ", center.Z, true);
            AppendString(packet, "terrainScanStatus", controlled is IMyCubeGrid ? "not-sampled-for-fleet" : "not-available-on-foot", true);
        }

        private void AppendFleetTelemetry(StringBuilder packet, Vector3D origin)
        {
            // Discover loaded grids every ten seconds; re-check tag and ownership on EVERY packet.
            if (_sequence == 1 || _sequence % ContactScanPacketInterval == 0)
            {
                _fleetCandidates.Clear();
                if (MyAPIGateway.Entities != null)
                    MyAPIGateway.Entities.GetEntities(_fleetCandidates, entity => entity is IMyCubeGrid);
            }
            List<IMyCubeGrid> eligible = new List<IMyCubeGrid>();
            foreach (IMyEntity entity in _fleetCandidates)
            {
                IMyCubeGrid grid = entity as IMyCubeGrid;
                if (grid == null || grid.Closed || grid.MarkedForClose) continue;
                if (string.IsNullOrEmpty(grid.CustomName) || grid.CustomName.IndexOf(FleetTag, StringComparison.OrdinalIgnoreCase) < 0) continue;
                string relationship = GridRelationship(grid);
                if (relationship != "owned" && relationship != "friendly") continue;
                eligible.Add(grid);
            }
            eligible.Sort((a, b) => {
                int distance = Vector3D.DistanceSquared(a.GetPosition(), origin).CompareTo(Vector3D.DistanceSquared(b.GetPosition(), origin));
                return distance != 0 ? distance : a.EntityId.CompareTo(b.EntityId);
            });
            AppendString(packet, "fleetTag", FleetTag, true);
            AppendNumber(packet, "fleetEligibleCount", eligible.Count, true);
            packet.Append(",\"fleet\":[");
            for (int i = 0; i < eligible.Count && i < MaxFleetGrids; i++)
            {
                IMyCubeGrid grid = eligible[i];
                Vector3D position = grid.GetPosition();
                Vector3D velocity = ContactVelocity(grid, grid);
                if (i > 0) packet.Append(',');
                packet.Append('{');
                AppendString(packet, "id", "se-" + grid.EntityId.ToString(CultureInfo.InvariantCulture), false);
                AppendString(packet, "name", grid.CustomName, true);
                AppendString(packet, "ship", grid.CustomName, true);
                AppendString(packet, "grid", grid.CustomName, true);
                AppendString(packet, "tag", FleetTag, true);
                AppendString(packet, "relationship", GridRelationship(grid), true);
                AppendString(packet, "kind", grid.IsStatic ? "station" : "ship", true);
                AppendString(packet, "controlMode", grid.IsStatic ? "station" : "grid", true);
                AppendNumber(packet, "x", position.X, true);
                AppendNumber(packet, "y", position.Y, true);
                AppendNumber(packet, "z", position.Z, true);
                AppendNumber(packet, "velocityX", velocity.X, true);
                AppendNumber(packet, "velocityY", velocity.Y, true);
                AppendNumber(packet, "velocityZ", velocity.Z, true);
                AppendNumber(packet, "speed", velocity.Length(), true);
                // Grid orientation/position, not an arbitrary cockpit or the player's readings.
                AppendCharacterTelemetry(packet, grid, position, velocity);
                AppendGridSystems(packet, grid);
                packet.Append('}');
            }
            packet.Append(']');
        }

        private static void AppendGridSystems(StringBuilder packet, IMyCubeGrid grid)
        {
            List<IMySlimBlock> blocks = new List<IMySlimBlock>();
            grid.GetBlocks(blocks, block => block != null && block.FatBlock is IMyTerminalBlock);
            double stored = 0, capacity = 0, cargo = 0, cargoCapacity = 0;
            int batteries = 0, cargoContainers = 0, damaged = 0, offline = 0;
            foreach (IMySlimBlock slim in blocks)
            {
                IMyTerminalBlock block = (IMyTerminalBlock)slim.FatBlock;
                if (!block.IsFunctional) damaged++;
                if (!block.IsWorking) offline++;
                IMyBatteryBlock battery = block as IMyBatteryBlock;
                if (battery != null) { batteries++; stored += battery.CurrentStoredPower; capacity += battery.MaxStoredPower; }
                // Cargo means cargo-container inventories, not reactor fuel or production queues.
                IMyCargoContainer container = block as IMyCargoContainer;
                if (container != null && container.HasInventory)
                {
                    cargoContainers++;
                    IMyInventory inventory = container.GetInventory();
                    cargo += (double)inventory.CurrentVolume;
                    cargoCapacity += (double)inventory.MaxVolume;
                }
            }
            AppendNumber(packet, "terminalBlockCount", blocks.Count, true);
            AppendNumber(packet, "nonFunctionalBlockCount", damaged, true);
            AppendNumber(packet, "notWorkingBlockCount", offline, true);
            AppendNumber(packet, "batteryCount", batteries, true);
            if (capacity > 0) AppendNumber(packet, "batteryPercent", 100.0 * stored / capacity, true);
            AppendNumber(packet, "inventoryCount", cargoContainers, true);
            if (cargoCapacity > 0)
            {
                AppendNumber(packet, "cargoPercent", 100.0 * cargo / cargoCapacity, true);
                AppendNumber(packet, "cargoCurrentVolume", cargo, true);
                AppendNumber(packet, "cargoMaxVolume", cargoCapacity, true);
            }
        }

        private static void AppendFlightTelemetry(StringBuilder packet, Sandbox.ModAPI.IMyShipController controller, Vector3D velocity)
        {
            if (controller == null) return;

            Vector3D gravity = controller.GetNaturalGravity();
            MatrixD orientation = controller.WorldMatrix;
            AppendNumber(packet, "naturalGravity", gravity.Length() / 9.81, true);
            AppendNumber(packet, "gravityX", gravity.X, true);
            AppendNumber(packet, "gravityY", gravity.Y, true);
            AppendNumber(packet, "gravityZ", gravity.Z, true);
            AppendNumber(packet, "forwardX", orientation.Forward.X, true);
            AppendNumber(packet, "forwardY", orientation.Forward.Y, true);
            AppendNumber(packet, "forwardZ", orientation.Forward.Z, true);
            AppendNumber(packet, "upX", orientation.Up.X, true);
            AppendNumber(packet, "upY", orientation.Up.Y, true);
            AppendNumber(packet, "upZ", orientation.Up.Z, true);

            if (gravity.LengthSquared() > 0.0001)
            {
                Vector3D radialUp = Vector3D.Normalize(-gravity);
                double verticalSpeed = Vector3D.Dot(velocity, radialUp);
                double horizontalSpeed = Math.Sqrt(Math.Max(0, velocity.LengthSquared() - verticalSpeed * verticalSpeed));
                AppendNumber(packet, "verticalSpeed", verticalSpeed, true);
                AppendNumber(packet, "horizontalSpeed", horizontalSpeed, true);
            }

            double surfaceAltitude;
            if (controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Surface, out surfaceAltitude))
            {
                AppendNumber(packet, "surfaceAltitude", surfaceAltitude, true);
            }

            double seaLevelAltitude;
            if (controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Sealevel, out seaLevelAltitude))
            {
                AppendNumber(packet, "seaLevelAltitude", seaLevelAltitude, true);
            }

            Vector3D planetCenter;
            if (controller.TryGetPlanetPosition(out planetCenter))
            {
                AppendNumber(packet, "planetCenterX", planetCenter.X, true);
                AppendNumber(packet, "planetCenterY", planetCenter.Y, true);
                AppendNumber(packet, "planetCenterZ", planetCenter.Z, true);
            }
        }

        private void AppendTerrainScan(StringBuilder packet, Sandbox.ModAPI.IMyShipController controller, Vector3D position)
        {
            if (controller == null || MyAPIGateway.Physics == null) return;

            Vector3D gravity = controller.GetNaturalGravity();
            if (gravity.LengthSquared() < 0.0001) return;

            double surfaceAltitude;
            if (!controller.TryGetPlanetElevation(Sandbox.ModAPI.Ingame.MyPlanetElevation.Surface, out surfaceAltitude)) return;

            AppendString(packet, "terrainScanSource", "physics-voxel-raycast", true);
            AppendNumber(packet, "terrainScanRange", TerrainScanRangeMeters, true);
            AppendNumber(packet, "terrainScanWidth", 2.0 * (50.0 + TerrainScanRangeMeters * 0.28), true);
            AppendNumber(packet, "terrainScanRows", TerrainAheadMeters.Length, true);
            AppendNumber(packet, "terrainScanColumns", TerrainLateralFactors.Length, true);

            if (surfaceAltitude > TerrainScanCeilingMeters)
            {
                AppendString(packet, "terrainScanStatus", "standby-high-altitude", true);
                packet.Append(",\"terrainScan\":[]");
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
                AppendString(packet, "terrainScanStatus", "standby-no-forward-vector", true);
                packet.Append(",\"terrainScan\":[]");
                return;
            }

            tangentForward.Normalize();
            Vector3D tangentRight = Vector3D.Cross(tangentForward, radialUp);
            tangentRight.Normalize();
            double probeHeight = Math.Max(750.0, Math.Min(4000.0, surfaceAltitude + 1000.0));
            double rayDepth = probeHeight + Math.Max(6000.0, surfaceAltitude + 3500.0);
            int written = 0;

            AppendString(packet, "terrainScanStatus", "live", true);
            packet.Append(",\"terrainScan\":[");
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
                    if (written > 0) packet.Append(',');
                    packet.Append('{');
                    AppendNumber(packet, "row", row, false);
                    AppendNumber(packet, "column", column, true);
                    AppendNumber(packet, "ahead", ahead, true);
                    AppendNumber(packet, "lateral", lateral, true);
                    AppendNumber(packet, "clearance", clearance, true);
                    AppendNumber(packet, "surfaceDelta", surfaceDelta, true);
                    packet.Append('}');
                    written++;
                }
            }
            packet.Append(']');
        }

        private IHitInfo FindTerrainHit(Vector3D start, Vector3D end)
        {
            _terrainHits.Clear();
            try
            {
                MyAPIGateway.Physics.CastRay(start, end, _terrainHits, 0);
                for (int index = 0; index < _terrainHits.Count; index++)
                {
                    IHitInfo hit = _terrainHits[index];
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

        private static IMyEntity GetControlledEntity()
        {
            if (MyAPIGateway.Session == null || MyAPIGateway.Session.Player == null) return null;

            IMyEntity entity = null;
            if (MyAPIGateway.Session.Player.Controller != null && MyAPIGateway.Session.Player.Controller.ControlledEntity != null)
            {
                entity = MyAPIGateway.Session.Player.Controller.ControlledEntity.Entity as IMyEntity;
            }

            if (entity == null && MyAPIGateway.Session.Player.Character != null)
            {
                entity = MyAPIGateway.Session.Player.Character as IMyEntity;
            }

            return entity;
        }

        private static IMyEntity GetTopMost(IMyEntity entity)
        {
            IMyEntity current = entity;
            int guard = 0;
            while (current != null && current.Parent != null && guard < 20)
            {
                current = current.Parent;
                guard++;
            }
            return current;
        }

        private static Vector3D GetVelocity(IMyEntity subject, IMyEntity controlled)
        {
            IMyCubeGrid grid = subject as IMyCubeGrid;
            if (grid != null) return grid.LinearVelocity;

            if (subject != null && subject.Physics != null) return subject.Physics.LinearVelocity;
            if (controlled != null && controlled.Physics != null) return controlled.Physics.LinearVelocity;
            return Vector3D.Zero;
        }

        private static void AppendContacts(StringBuilder packet, IMyEntity subject, Vector3D origin)
        {
            packet.Append('[');
            if (MyAPIGateway.Entities == null)
            {
                packet.Append(']');
                return;
            }

            int emitted = 0;
            HashSet<IMyEntity> planets = new HashSet<IMyEntity>();
            try
            {
                MyAPIGateway.Entities.GetEntities(planets, entity => entity is MyPlanet);
            }
            catch
            {
            }

            foreach (IMyEntity entity in planets)
            {
                MyPlanet planet = entity as MyPlanet;
                if (planet == null || planet.Closed || planet.MarkedForClose) continue;
                if (emitted > 0) packet.Append(',');
                AppendPlanetContact(packet, planet, origin);
                emitted++;
            }

            BoundingSphereD sphere = new BoundingSphereD(origin, ContactRangeMeters);
            List<IMyEntity> entities = MyAPIGateway.Entities.GetTopMostEntitiesInSphere(ref sphere);
            int written = 0;

            for (int i = 0; i < entities.Count && written < MaxContacts; i++)
            {
                IMyEntity entity = entities[i];
                if (entity == null || entity.Closed || entity.MarkedForClose) continue;
                if (entity is MyPlanet) continue;
                if (subject != null && entity.EntityId == subject.EntityId) continue;
                if (IsInternalTelemetryEntity(entity)) continue;

                Vector3D position = entity.GetPosition();
                double distance = Vector3D.Distance(origin, position);
                if (distance < 10.0 || distance > ContactRangeMeters) continue;

                IMyCubeGrid grid = entity as IMyCubeGrid;
                Vector3D velocity = ContactVelocity(entity, grid);
                string relationship = grid == null ? "" : GridRelationship(grid);
                string antennaName = grid == null ? "" : FindRadioSource(grid);
                string contactSource = grid == null
                    ? ""
                    : string.IsNullOrWhiteSpace(antennaName) ? "grid" : "antenna";

                if (emitted + written > 0) packet.Append(',');
                packet.Append('{');
                AppendString(packet, "id", "se-" + entity.EntityId.ToString(CultureInfo.InvariantCulture), false);
                AppendString(packet, "name", SafeName(entity, "Contact " + written.ToString(CultureInfo.InvariantCulture)), true);
                AppendString(packet, "kind", Classify(entity), true);
                AppendString(packet, "className", grid == null ? Classify(entity) : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(relationship) + " " + (contactSource == "antenna" ? "antenna contact" : "grid contact"), true);
                AppendNumber(packet, "x", position.X, true);
                AppendNumber(packet, "y", position.Y, true);
                AppendNumber(packet, "z", position.Z, true);
                AppendNumber(packet, "velocityX", velocity.X, true);
                AppendNumber(packet, "velocityY", velocity.Y, true);
                AppendNumber(packet, "velocityZ", velocity.Z, true);
                AppendNumber(packet, "speed", velocity.Length(), true);
                AppendNumber(packet, "distanceMeters", distance, true);
                AppendString(packet, "status", contactSource == "antenna" ? CultureInfo.InvariantCulture.TextInfo.ToTitleCase(relationship) + " antenna broadcast" : "Observed by local telemetry mod", true);
                AppendString(packet, "color", ContactColor(relationship, grid != null && grid.IsStatic), true);
                AppendString(packet, "notes", "Space Engineers entity " + entity.EntityId.ToString(CultureInfo.InvariantCulture), true);
                AppendString(packet, "relationship", relationship, true);
                AppendString(packet, "contactSource", contactSource, true);
                AppendString(packet, "antennaName", antennaName, true);
                packet.Append('}');
                written++;
            }

            packet.Append(']');
        }

        private static void AppendPlanetContact(StringBuilder packet, MyPlanet planet, Vector3D origin)
        {
            Vector3D center = planet.LocationForHudMarker;
            string generatorName = planet.Generator == null
                ? "Planet"
                : planet.Generator.Id.SubtypeName.ToString();
            string storageName = planet.StorageName ?? string.Empty;
            string entityId = planet.EntityId.ToString(CultureInfo.InvariantCulture);

            packet.Append('{');
            AppendString(packet, "id", "planet-" + entityId, false);
            AppendString(packet, "entityId", entityId, true);
            AppendString(packet, "name", SafeName(planet, generatorName), true);
            AppendString(packet, "kind", "body", true);
            AppendString(packet, "className", generatorName + " planetary body", true);
            AppendNumber(packet, "x", center.X, true);
            AppendNumber(packet, "y", center.Y, true);
            AppendNumber(packet, "z", center.Z, true);
            AppendNumber(packet, "velocityX", 0, true);
            AppendNumber(packet, "velocityY", 0, true);
            AppendNumber(packet, "velocityZ", 0, true);
            AppendNumber(packet, "speed", 0, true);
            AppendNumber(packet, "distanceMeters", Vector3D.Distance(origin, center), true);
            AppendNumber(packet, "radiusMeters", planet.AverageRadius, true);
            AppendString(packet, "generatorName", generatorName, true);
            AppendString(packet, "storageName", storageName, true);
            AppendString(packet, "hasAtmosphere", planet.HasAtmosphere ? "true" : "false", true);
            AppendNumber(packet, "surfaceGravity", planet.Generator == null ? 0 : planet.Generator.SurfaceGravity, true);
            AppendString(packet, "status", "Authoritative in-game planet registry", true);
            AppendString(packet, "color", "#7de8d2", true);
            AppendString(packet, "notes", "Space Engineers planet entity " + entityId + " / storage " + storageName, true);
            AppendString(packet, "relationship", string.Empty, true);
            AppendString(packet, "contactSource", "planet-registry", true);
            AppendString(packet, "antennaName", string.Empty, true);
            packet.Append('}');
        }

        private static Vector3D ContactVelocity(IMyEntity entity, IMyCubeGrid grid)
        {
            try
            {
                if (grid != null) return grid.LinearVelocity;
                if (entity != null && entity.Physics != null) return entity.Physics.LinearVelocity;
            }
            catch
            {
            }
            return Vector3D.Zero;
        }

        private static string Classify(IMyEntity entity)
        {
            IMyCubeGrid grid = entity as IMyCubeGrid;
            if (grid != null) return grid.IsStatic ? "station" : "ship";
            if (entity is MyPlanet) return "body";
            if (entity is IMyVoxelBase) return "asteroid";

            string name = SafeName(entity, string.Empty).ToLowerInvariant();
            if (name.Contains("signal")) return "signal";
            if (name.Contains("asteroid")) return "asteroid";
            if (name.Contains("station") || name.Contains("base")) return "station";
            return "radar";
        }

        private static string GridRelationship(IMyCubeGrid grid)
        {
            long playerId = 0;
            try
            {
                playerId = MyAPIGateway.Session == null || MyAPIGateway.Session.Player == null ? 0 : MyAPIGateway.Session.Player.IdentityId;
            }
            catch
            {
                playerId = 0;
            }

            if (grid == null || playerId == 0) return "unknown";
            var owners = grid.BigOwners != null && grid.BigOwners.Count > 0 ? grid.BigOwners : grid.SmallOwners;
            if (owners == null || owners.Count == 0) return "neutral";
            bool allOwned = true;
            bool allFriendly = true;
            foreach (long ownerId in owners)
            {
                if (ownerId == playerId) continue;
                allOwned = false;
                string relation = FactionRelationship(ownerId, playerId);
                if (relation == "hostile") return "hostile";
                if (relation != "friendly") allFriendly = false;
            }
            return allOwned ? "owned" : allFriendly ? "friendly" : "neutral";
        }

        private static string FactionRelationship(long ownerId, long playerId)
        {
            if (ownerId == 0 || playerId == 0 || MyAPIGateway.Session == null || MyAPIGateway.Session.Factions == null) return string.Empty;
            IMyFactionCollection factions = MyAPIGateway.Session.Factions;
            IMyFaction ownerFaction = factions.TryGetPlayerFaction(ownerId);
            IMyFaction playerFaction = factions.TryGetPlayerFaction(playerId);
            if (ownerFaction == null || playerFaction == null) return string.Empty;
            if (ownerFaction.FactionId == playerFaction.FactionId) return "friendly";

            MyRelationsBetweenFactions relation = factions.GetRelationBetweenFactions(ownerFaction.FactionId, playerFaction.FactionId);
            if (relation == MyRelationsBetweenFactions.Enemies) return "hostile";
            if (relation == MyRelationsBetweenFactions.Allies || relation == MyRelationsBetweenFactions.Friends) return "friendly";
            if (relation == MyRelationsBetweenFactions.Neutral) return "neutral";
            return string.Empty;
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
            return string.Empty;
        }

        private static bool IsRadioBlock(IMyCubeBlock block)
        {
            return block is IMyRadioAntenna || block is IMyBeacon;
        }

        private static string BlockName(IMyCubeBlock block)
        {
            if (block == null) return string.Empty;
            IMyTerminalBlock terminal = block as IMyTerminalBlock;
            if (terminal != null && !string.IsNullOrWhiteSpace(terminal.CustomName)) return terminal.CustomName;
            return block.DisplayNameText ?? block.GetType().Name;
        }

        private static string ContactColor(string relationship, bool isStatic)
        {
            if (relationship == "hostile") return "#ff4f4f";
            if (relationship == "owned" || relationship == "friendly") return "#75d69d";
            if (relationship == "neutral") return "#c9cdd2";
            return isStatic ? "#f6b94d" : "#d68ebd";
        }

        private static string SafeName(IMyEntity entity, string fallback)
        {
            if (entity == null) return fallback;

            IMyCubeGrid grid = entity as IMyCubeGrid;
            if (grid != null && !string.IsNullOrWhiteSpace(grid.CustomName)) return grid.CustomName;
            if (!string.IsNullOrWhiteSpace(entity.DisplayName)) return entity.DisplayName;
            if (!string.IsNullOrWhiteSpace(entity.Name)) return entity.Name;
            return fallback;
        }

        private static bool IsInternalTelemetryEntity(IMyEntity entity)
        {
            if (entity == null) return true;
            string text = (entity.GetType().Name + " " + SafeName(entity, string.Empty)).ToLowerInvariant();
            return text.Contains("dshield")
                || text.Contains("defensiveshield")
                || text.Contains("defense shield")
                || text.Contains("defensive shield")
                || text.Contains("shieldentity")
                || text.Contains("shield field")
                || text.Contains("shield hit");
        }

        private static void AppendString(StringBuilder builder, string name, string value, bool comma)
        {
            if (comma) builder.Append(',');
            builder.Append('"').Append(name).Append("\":\"").Append(Escape(value)).Append('"');
        }

        private static void AppendNumber(StringBuilder builder, string name, double value, bool comma)
        {
            if (comma) builder.Append(',');
            builder.Append('"').Append(name).Append("\":");
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                builder.Append('0');
                return;
            }
            builder.Append(value.ToString("0.###", CultureInfo.InvariantCulture));
        }

        private static string Escape(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            StringBuilder escaped = new StringBuilder(value.Length + 8);
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                if (c == '\\') escaped.Append("\\\\");
                else if (c == '"') escaped.Append("\\\"");
                else if (c == '\r') escaped.Append("\\r");
                else if (c == '\n') escaped.Append("\\n");
                else if (c == '\t') escaped.Append("\\t");
                else escaped.Append(c);
            }
            return escaped.ToString();
        }
    }
}
