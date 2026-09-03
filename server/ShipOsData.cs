using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace Echoboard.Api;

public sealed class ShipOsData(IConfiguration config)
{
    public const int HistoryLimit = 1000;
    public const int MaximumContactsPerPacket = 500;
    public const int MaximumTerrainSamplesPerPacket = 100;
    public const int MaximumStateBytes = 10_000_000;

    private static readonly JsonDocumentOptions PacketDocumentOptions = new()
    {
        AllowTrailingCommas = false,
        CommentHandling = JsonCommentHandling.Disallow,
        MaxDepth = 64,
    };

    private readonly string _connectionString = config.GetConnectionString("EchoboardPostgres")
        ?? "Host=127.0.0.1;Port=5432;Database=echoboard_next;Username=postgres;Password=postgres";

    private NpgsqlConnection CreateConnection() => new(_connectionString);

    public async Task EnsureSchemaAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            CREATE SCHEMA IF NOT EXISTS gaming;

            CREATE TABLE IF NOT EXISTS gaming.shipos_campaign_state (
                campaign_key text PRIMARY KEY,
                state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
                revision bigint NOT NULL DEFAULT 1,
                updated_by text NOT NULL DEFAULT '',
                updated_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS gaming.shipos_telemetry_packets (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                vessel_key text NOT NULL,
                vessel_name text NOT NULL,
                packet_id text NOT NULL,
                source_name text NOT NULL DEFAULT '',
                packet_stamp timestamptz NULL,
                payload jsonb NOT NULL,
                received_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE (vessel_key, packet_id)
            );

            CREATE INDEX IF NOT EXISTS ix_shipos_telemetry_received
                ON gaming.shipos_telemetry_packets (received_at DESC);
            CREATE INDEX IF NOT EXISTS ix_shipos_telemetry_vessel_received
                ON gaming.shipos_telemetry_packets (vessel_key, received_at DESC);

            CREATE TABLE IF NOT EXISTS gaming.shipos_telemetry_keys (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                campaign_key text NOT NULL,
                key_hash text NOT NULL UNIQUE,
                label text NOT NULL DEFAULT 'ShipOS helper',
                created_by text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                last_used_at timestamptz NULL,
                revoked_at timestamptz NULL
            );

            CREATE INDEX IF NOT EXISTS ix_shipos_telemetry_keys_campaign
                ON gaming.shipos_telemetry_keys (campaign_key, created_at DESC)
                WHERE revoked_at IS NULL;
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<ShipOsCampaignState?> GetCampaignStateAsync(string campaignKey, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT campaign_key, state_json::text, revision, updated_by, updated_at
            FROM gaming.shipos_campaign_state
            WHERE campaign_key = @campaign_key
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.Add("campaign_key", NpgsqlDbType.Text).Value = NormalizeCampaignKey(campaignKey);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;

        using var stateDocument = JsonDocument.Parse(reader.GetString(1));
        return new ShipOsCampaignState(
            reader.GetString(0),
            stateDocument.RootElement.Clone(),
            reader.GetInt64(2),
            reader.GetString(3),
            reader.GetFieldValue<DateTimeOffset>(4));
    }

    public async Task<ShipOsCampaignState> SaveCampaignStateAsync(
        string campaignKey,
        JsonElement state,
        long? expectedRevision,
        string updatedBy,
        CancellationToken cancellationToken)
    {
        if (state.ValueKind != JsonValueKind.Object)
        {
            throw new ArgumentException("ShipOS campaign state must be a JSON object.");
        }

        var stateJson = state.GetRawText();
        if (Encoding.UTF8.GetByteCount(stateJson) > MaximumStateBytes)
        {
            throw new ArgumentException("ShipOS campaign state exceeds the 10 MB limit.");
        }

        var normalizedCampaignKey = NormalizeCampaignKey(campaignKey);
        const string sql = """
            INSERT INTO gaming.shipos_campaign_state (campaign_key, state_json, revision, updated_by, updated_at)
            VALUES (@campaign_key, @state_json, 1, @updated_by, now())
            ON CONFLICT (campaign_key) DO UPDATE SET
                state_json = EXCLUDED.state_json,
                revision = gaming.shipos_campaign_state.revision + 1,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            WHERE @expected_revision IS NULL
               OR gaming.shipos_campaign_state.revision = @expected_revision
            RETURNING campaign_key, state_json::text, revision, updated_by, updated_at
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.Add("campaign_key", NpgsqlDbType.Text).Value = normalizedCampaignKey;
        command.Parameters.Add("state_json", NpgsqlDbType.Jsonb).Value = stateJson;
        command.Parameters.Add("updated_by", NpgsqlDbType.Text).Value = CleanText(updatedBy, 160, "EchoBoard operator");
        command.Parameters.Add("expected_revision", NpgsqlDbType.Bigint).Value = expectedRevision is null ? DBNull.Value : expectedRevision.Value;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new ShipOsStateRevisionConflictException(expectedRevision ?? 0);
        }

        using var stateDocument = JsonDocument.Parse(reader.GetString(1));
        return new ShipOsCampaignState(
            reader.GetString(0),
            stateDocument.RootElement.Clone(),
            reader.GetInt64(2),
            reader.GetString(3),
            reader.GetFieldValue<DateTimeOffset>(4));
    }

    public async Task<ShipOsTelemetryKey> IssueTelemetryKeyAsync(
        string campaignKey,
        string label,
        string createdBy,
        CancellationToken cancellationToken)
    {
        var secret = $"shipos_{Base64Url(RandomNumberGenerator.GetBytes(32))}";
        var keyHash = HashSecret(secret);
        const string sql = """
            WITH inserted AS (
                INSERT INTO gaming.shipos_telemetry_keys (campaign_key, key_hash, label, created_by)
                VALUES (@campaign_key, @key_hash, @label, @created_by)
                RETURNING id, campaign_key, label, created_at
            ), retired AS (
                UPDATE gaming.shipos_telemetry_keys
                SET revoked_at = now()
                WHERE id IN (
                    SELECT id
                    FROM gaming.shipos_telemetry_keys
                    WHERE campaign_key = @campaign_key AND revoked_at IS NULL
                    ORDER BY created_at DESC
                    OFFSET 7
                )
            )
            SELECT id, campaign_key, label, created_at FROM inserted
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.Add("campaign_key", NpgsqlDbType.Text).Value = NormalizeCampaignKey(campaignKey);
        command.Parameters.Add("key_hash", NpgsqlDbType.Text).Value = keyHash;
        command.Parameters.Add("label", NpgsqlDbType.Text).Value = CleanText(label, 100, "ShipOS helper");
        command.Parameters.Add("created_by", NpgsqlDbType.Text).Value = CleanText(createdBy, 160, "EchoBoard operator");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return new ShipOsTelemetryKey(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            secret,
            reader.GetFieldValue<DateTimeOffset>(3));
    }

    public async Task<bool> ValidateTelemetryKeyAsync(string? secret, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(secret) || secret.Length > 200) return false;
        const string sql = """
            UPDATE gaming.shipos_telemetry_keys
            SET last_used_at = now()
            WHERE key_hash = @key_hash AND revoked_at IS NULL
            RETURNING id
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.Add("key_hash", NpgsqlDbType.Text).Value = HashSecret(secret.Trim());
        return await command.ExecuteScalarAsync(cancellationToken) is not null;
    }

    public async Task<ShipOsTelemetryIngestResult> IngestAsync(string body, CancellationToken cancellationToken)
    {
        var packet = ValidatePacket(body);
        const string insertSql = """
            INSERT INTO gaming.shipos_telemetry_packets (
                vessel_key, vessel_name, packet_id, source_name, packet_stamp, payload, received_at)
            VALUES (@vessel_key, @vessel_name, @packet_id, @source_name, @packet_stamp, @payload, now())
            ON CONFLICT (vessel_key, packet_id) DO NOTHING
            RETURNING received_at
            """;

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        DateTimeOffset receivedAt;
        var accepted = false;
        await using (var command = new NpgsqlCommand(insertSql, connection))
        {
            command.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = packet.VesselKey;
            command.Parameters.Add("vessel_name", NpgsqlDbType.Text).Value = packet.VesselName;
            command.Parameters.Add("packet_id", NpgsqlDbType.Text).Value = packet.PacketId;
            command.Parameters.Add("source_name", NpgsqlDbType.Text).Value = packet.Source;
            command.Parameters.Add("packet_stamp", NpgsqlDbType.TimestampTz).Value = packet.Stamp is null ? DBNull.Value : packet.Stamp.Value;
            command.Parameters.Add("payload", NpgsqlDbType.Jsonb).Value = packet.Json;
            var insertedAt = await command.ExecuteScalarAsync(cancellationToken);
            accepted = insertedAt is not null;
            receivedAt = insertedAt is null ? DateTimeOffset.UtcNow : (DateTimeOffset)insertedAt;
        }

        if (accepted)
        {
            const string trimSql = """
                DELETE FROM gaming.shipos_telemetry_packets
                WHERE vessel_key = @vessel_key
                  AND id NOT IN (
                    SELECT id FROM gaming.shipos_telemetry_packets
                    WHERE vessel_key = @vessel_key
                    ORDER BY received_at DESC
                    LIMIT 10000
                  )
                """;
            await using var trim = new NpgsqlCommand(trimSql, connection);
            trim.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = packet.VesselKey;
            await trim.ExecuteNonQueryAsync(cancellationToken);
        }

        const string countSql = "SELECT count(*) FROM gaming.shipos_telemetry_packets WHERE vessel_key = @vessel_key";
        await using var count = new NpgsqlCommand(countSql, connection);
        count.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = packet.VesselKey;
        var packetCount = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
        return new ShipOsTelemetryIngestResult(packetCount, packet.PacketId, packet.Stamp?.ToString("O"), receivedAt, accepted, packet.VesselName);
    }

    public async Task<string?> GetLatestJsonAsync(string? vessel, CancellationToken cancellationToken)
    {
        var hasVessel = !string.IsNullOrWhiteSpace(vessel);
        var sql = hasVessel
            ? "SELECT payload::text FROM gaming.shipos_telemetry_packets WHERE vessel_key = @vessel_key ORDER BY received_at DESC LIMIT 1"
            : "SELECT payload::text FROM gaming.shipos_telemetry_packets ORDER BY received_at DESC LIMIT 1";
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        if (hasVessel) command.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = NormalizeVesselKey(vessel!);
        return await command.ExecuteScalarAsync(cancellationToken) as string;
    }

    public async Task<string[]> GetHistoryJsonAsync(int limit, string? vessel, CancellationToken cancellationToken)
    {
        var count = Math.Clamp(limit, 1, HistoryLimit);
        var hasVessel = !string.IsNullOrWhiteSpace(vessel);
        var sql = hasVessel
            ? "SELECT payload::text FROM gaming.shipos_telemetry_packets WHERE vessel_key = @vessel_key ORDER BY received_at DESC LIMIT @limit"
            : "SELECT payload::text FROM gaming.shipos_telemetry_packets ORDER BY received_at DESC LIMIT @limit";
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.Add("limit", NpgsqlDbType.Integer).Value = count;
        if (hasVessel) command.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = NormalizeVesselKey(vessel!);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var packets = new List<string>();
        while (await reader.ReadAsync(cancellationToken)) packets.Add(reader.GetString(0));
        packets.Reverse();
        return packets.ToArray();
    }

    public async Task<ShipOsTelemetryHealth> GetHealthAsync(string? vessel, CancellationToken cancellationToken)
    {
        var hasVessel = !string.IsNullOrWhiteSpace(vessel);
        var where = hasVessel ? "WHERE vessel_key = @vessel_key" : string.Empty;
        var sql = $"""
            SELECT
                count(*),
                (SELECT packet_id FROM gaming.shipos_telemetry_packets {where} ORDER BY received_at DESC LIMIT 1),
                (SELECT packet_stamp FROM gaming.shipos_telemetry_packets {where} ORDER BY received_at DESC LIMIT 1),
                (SELECT received_at FROM gaming.shipos_telemetry_packets {where} ORDER BY received_at DESC LIMIT 1),
                (SELECT vessel_name FROM gaming.shipos_telemetry_packets {where} ORDER BY received_at DESC LIMIT 1)
            FROM gaming.shipos_telemetry_packets
            {where}
            """;
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        if (hasVessel) command.Parameters.Add("vessel_key", NpgsqlDbType.Text).Value = NormalizeVesselKey(vessel!);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return new ShipOsTelemetryHealth(
            "online",
            reader.GetInt64(0),
            reader.IsDBNull(1) ? null : reader.GetString(1),
            reader.IsDBNull(2) ? null : reader.GetFieldValue<DateTimeOffset>(2).ToString("O"),
            reader.IsDBNull(3) ? null : reader.GetFieldValue<DateTimeOffset>(3),
            HistoryLimit,
            reader.IsDBNull(4) ? null : reader.GetString(4));
    }

    private static ValidatedPacket ValidatePacket(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Telemetry body is empty.");
        using var document = JsonDocument.Parse(body, PacketDocumentOptions);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object) throw new ArgumentException("Telemetry packet must be a JSON object.");
        if (!HasFiniteCoordinate(root, "x") || !HasFiniteCoordinate(root, "y") || !HasFiniteCoordinate(root, "z"))
        {
            throw new ArgumentException("Telemetry packet requires finite x, y, and z coordinates.");
        }
        if (root.TryGetProperty("contacts", out var contacts))
        {
            if (contacts.ValueKind != JsonValueKind.Array) throw new ArgumentException("Telemetry contacts must be an array.");
            if (contacts.GetArrayLength() > MaximumContactsPerPacket) throw new ArgumentException($"Telemetry packet exceeds {MaximumContactsPerPacket} contacts.");
        }
        if (root.TryGetProperty("terrainScan", out var terrainScan))
        {
            if (terrainScan.ValueKind != JsonValueKind.Array) throw new ArgumentException("Telemetry terrain scan must be an array.");
            if (terrainScan.GetArrayLength() > MaximumTerrainSamplesPerPacket) throw new ArgumentException($"Telemetry packet exceeds {MaximumTerrainSamplesPerPacket} terrain samples.");
        }

        var normalizedJson = JsonSerializer.Serialize(root);
        var vesselName = CleanText(StringProperty(root, "ship") ?? StringProperty(root, "grid"), 160, "Unknown vessel");
        var packetId = CleanText(StringProperty(root, "packetId"), 240, string.Empty);
        if (packetId.Length == 0) packetId = $"sha256-{HashSecret(normalizedJson)[..24]}";
        var source = CleanText(StringProperty(root, "source"), 100, "telemetry");
        DateTimeOffset? stamp = null;
        var stampText = StringProperty(root, "stamp");
        if (DateTimeOffset.TryParse(stampText, out var parsedStamp)) stamp = parsedStamp.ToUniversalTime();
        return new ValidatedPacket(NormalizeVesselKey(vesselName), vesselName, packetId, source, stamp, normalizedJson);
    }

    private static bool HasFiniteCoordinate(JsonElement packet, string name)
    {
        if (packet.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number))
        {
            return double.IsFinite(number);
        }
        return packet.TryGetProperty("position", out var position)
            && position.ValueKind == JsonValueKind.Object
            && position.TryGetProperty(name, out value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetDouble(out number)
            && double.IsFinite(number);
    }

    private static string? StringProperty(JsonElement packet, string name) =>
        packet.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string NormalizeCampaignKey(string value)
    {
        var normalized = new string((value ?? string.Empty).Trim().ToLowerInvariant()
            .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            .Take(80)
            .ToArray());
        if (normalized.Length == 0) throw new ArgumentException("Campaign key is required.");
        return normalized;
    }

    private static string NormalizeVesselKey(string value)
    {
        var normalized = new string(value.Trim().ToLowerInvariant()
            .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_' or ' ')
            .Take(160)
            .ToArray());
        return normalized.Length == 0 ? "unknown-vessel" : normalized;
    }

    private static string CleanText(string? value, int maximumLength, string fallback)
    {
        var cleaned = (value ?? string.Empty).Trim();
        if (cleaned.Length == 0) return fallback;
        return cleaned.Length <= maximumLength ? cleaned : cleaned[..maximumLength];
    }

    private static string HashSecret(string secret) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed record ValidatedPacket(
        string VesselKey,
        string VesselName,
        string PacketId,
        string Source,
        DateTimeOffset? Stamp,
        string Json);
}

public sealed record ShipOsCampaignState(
    string CampaignKey,
    JsonElement State,
    long Revision,
    string UpdatedBy,
    DateTimeOffset UpdatedAt);

public sealed record ShipOsCampaignStateSaveRequest(JsonElement State, long? ExpectedRevision);

public sealed record ShipOsTelemetryKey(
    Guid Id,
    string CampaignKey,
    string Label,
    string Secret,
    DateTimeOffset CreatedAt);

public sealed record ShipOsTelemetryKeyRequest(string? Label);

public sealed record ShipOsTelemetryIngestResult(
    long PacketCount,
    string LatestPacketId,
    string? LatestStamp,
    DateTimeOffset ReceivedAt,
    bool Accepted,
    string VesselName);

public sealed record ShipOsTelemetryHealth(
    string Status,
    long PacketCount,
    string? LatestPacketId,
    string? LatestStamp,
    DateTimeOffset? LatestReceivedAt,
    int HistoryLimit,
    string? VesselName);

public sealed class ShipOsStateRevisionConflictException(long expectedRevision)
    : Exception($"ShipOS campaign state changed after revision {expectedRevision} was loaded.");
