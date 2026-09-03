#!/usr/bin/env node
import { createServer } from 'node:http'
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'

const port = Number(process.env.SHIPOS_TELEMETRY_PORT || process.env.PORT || 8795)
const host = process.env.SHIPOS_TELEMETRY_HOST || '127.0.0.1'
const historyLimit = clamp(Number(process.env.SHIPOS_TELEMETRY_HISTORY || 1000), 1, 10000)
const logPath = resolve(process.env.SHIPOS_TELEMETRY_LOG || 'shipos-telemetry-log.jsonl')
const maxLogBytes = clamp(Number(process.env.SHIPOS_TELEMETRY_MAX_LOG_BYTES || 8_000_000), 1_000_000, 100_000_000)
const maxPacketBytes = 2_000_000
const watchFile = process.env.SHIPOS_WATCH_FILE ? resolve(process.env.SHIPOS_WATCH_FILE) : ''
const watchIntervalMs = clamp(Number(process.env.SHIPOS_WATCH_INTERVAL_MS || 1000), 250, 60000)
const remotePushUrl = process.env.SHIPOS_REMOTE_PUSH_URL || ''
const remotePushKey = process.env.SHIPOS_REMOTE_PUSH_KEY || ''
const remotePushTimeoutMs = clamp(Number(process.env.SHIPOS_REMOTE_PUSH_TIMEOUT_MS || 8000), 1000, 60000)
const remoteSyncIntervalMs = clamp(Number(process.env.SHIPOS_REMOTE_SYNC_INTERVAL_MS || 30000), 5000, 300000)
const startedAt = Date.now()
const history = []
const identities = new Set()
const eventClients = new Set()
const fileWatch = {
  enabled: Boolean(watchFile),
  path: watchFile || null,
  intervalMs: watchIntervalMs,
  lastReadAt: null,
  lastMtimeMs: 0,
  lastSize: 0,
  accepted: 0,
  lastError: '',
}
const remotePush = {
  enabled: Boolean(remotePushUrl),
  url: remotePushUrl || null,
  timeoutMs: remotePushTimeoutMs,
  accepted: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastSyncAt: null,
  lastError: '',
}

loadHistory()
startFileWatcher()
startRemoteSync()

const server = createServer(async (request, response) => {
  response.shipOsCorsOrigin = allowedCorsOrigin(request.headers.origin)
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`)

  if (request.method === 'OPTIONS') {
    send(response, 204)
    return
  }

  try {
    if (request.method === 'GET' && url.pathname === '/') {
      sendJson(response, 200, {
        name: 'ShipOS Telemetry Bridge',
        status: 'online',
        endpoints: ['/health', '/telemetry/latest', '/telemetry/history', '/telemetry/events', 'POST /telemetry', 'POST /telemetry/raw'],
        fileWatch: fileWatchInfo(),
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        status: 'online',
        packetCount: history.length,
        latestStamp: latestPacket()?.stamp || null,
        latestPacketId: packetIdentity(latestPacket()) || null,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        historyLimit,
        maxLogBytes,
        host,
        localTelemetryEndpoint: `http://127.0.0.1:${port}/telemetry/latest`,
        lanTelemetryEndpoints: lanAddresses().map((address) => `http://${address}:${port}/telemetry/latest`),
        fileWatch: fileWatchInfo(),
        remotePush: remotePushInfo(),
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/telemetry/latest') {
      const latest = latestPacket()
      if (!latest) {
        sendJson(response, 404, { error: 'No telemetry packets received yet.' })
        return
      }
      sendJson(response, 200, latest)
      return
    }

    if (request.method === 'GET' && url.pathname === '/telemetry/history') {
      const limit = clamp(Number(url.searchParams.get('limit') || 50), 1, historyLimit)
      sendJson(response, 200, history.slice(-limit))
      return
    }

    if (request.method === 'GET' && url.pathname === '/telemetry/events') {
      response.writeHead(200, {
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
        Vary: 'Access-Control-Request-Private-Network',
        ...(response.shipOsCorsOrigin ? { 'Access-Control-Allow-Origin': response.shipOsCorsOrigin } : {}),
      })
      response.write(`event: health\ndata: ${JSON.stringify({ status: 'online', packetCount: history.length })}\n\n`)
      eventClients.add(response)
      request.on('close', () => eventClients.delete(response))
      return
    }

    if (request.method === 'POST' && (url.pathname === '/telemetry' || url.pathname === '/telemetry/raw')) {
      const body = await readBody(request)
      const parsed = parseBody(body, url.pathname === '/telemetry/raw')
      const packets = Array.isArray(parsed) ? parsed : [parsed]
      const accepted = packets.map(normalizePacket).filter(Boolean).map(ingestPacket)
      sendJson(response, 202, {
        accepted: accepted.filter(Boolean).length,
        received: packets.length,
        packetCount: history.length,
        latestStamp: latestPacket()?.stamp || null,
      })
      return
    }

    sendJson(response, 404, { error: 'Unknown ShipOS bridge endpoint.' })
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Bridge request failed.' })
  }
})

server.listen(port, host, () => {
  const localEndpoint = `http://127.0.0.1:${port}/telemetry/latest`
  console.log(`ShipOS telemetry bridge online on ${host}:${port}`)
  console.log(`Local browser endpoint: ${localEndpoint}`)
  const addresses = lanAddresses()
  if (addresses.length) {
    console.log('LAN/tablet endpoints:')
    addresses.forEach((address) => console.log(`  http://${address}:${port}/telemetry/latest`))
  } else {
    console.log('No LAN IPv4 address detected. Use the local endpoint from this PC.')
  }
  console.log(`History log: ${logPath}`)
  if (fileWatch.enabled) {
    console.log(`Watching telemetry file: ${fileWatch.path}`)
  }
  if (remotePush.enabled) {
    console.log(`Remote relay push: ${remotePush.url}`)
  }
})

function loadHistory() {
  if (!existsSync(logPath)) return
  const lines = readLogTail(logPath, maxLogBytes).split(/\r?\n/).filter(Boolean)
  lines.slice(-historyLimit).forEach((line) => {
    try {
      const packet = normalizePacket(JSON.parse(line))
      if (packet) pushPacket(packet, false)
    } catch {
      // Ignore malformed archived lines so the bridge can still start.
    }
  })
  if (statSync(logPath).size > maxLogBytes) compactLog()
}

function startFileWatcher() {
  if (!fileWatch.enabled) return
  pollWatchedFile()
  const timer = setInterval(pollWatchedFile, watchIntervalMs)
  if (typeof timer.unref === 'function') timer.unref()
}

function startRemoteSync() {
  if (!remotePush.enabled) return
  setTimeout(() => {
    void syncRemoteRelay()
  }, 1500)
  const timer = setInterval(() => {
    void syncRemoteRelay()
  }, remoteSyncIntervalMs)
  if (typeof timer.unref === 'function') timer.unref()
}

function pollWatchedFile() {
  try {
    if (!watchFile || !existsSync(watchFile)) {
      fileWatch.lastError = 'Waiting for watched telemetry file.'
      return
    }

    const stats = statSync(watchFile)
    if (stats.mtimeMs === fileWatch.lastMtimeMs && stats.size === fileWatch.lastSize) return
    if (stats.size > maxPacketBytes) throw new Error('Watched telemetry packet exceeds the 2 MB limit.')

    const body = readFileSync(watchFile, 'utf8').trim()
    fileWatch.lastMtimeMs = stats.mtimeMs
    fileWatch.lastSize = stats.size
    fileWatch.lastReadAt = new Date().toISOString()

    if (!body) {
      fileWatch.lastError = 'Watched telemetry file is empty.'
      return
    }

    const parsed = parseBody(body, false)
    const packets = Array.isArray(parsed) ? parsed : [parsed]
    let accepted = 0
    packets.map(normalizePacket).filter(Boolean).forEach((packet) => {
      if (ingestPacket(packet)) accepted += 1
    })
    fileWatch.accepted += accepted
    fileWatch.lastError = ''
  } catch (error) {
    fileWatch.lastError = error instanceof Error ? error.message : 'Watched telemetry import failed.'
  }
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (Buffer.byteLength(body, 'utf8') > maxPacketBytes) {
        rejectBody(new Error('Telemetry body is too large.'))
        request.destroy()
      }
    })
    request.on('end', () => resolveBody(body))
    request.on('error', rejectBody)
  })
}

function parseBody(body, rawMode) {
  const trimmed = String(body || '').trim()
  if (!trimmed) throw new Error('Telemetry body is empty.')
  if (!rawMode) return JSON.parse(trimmed)

  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Raw telemetry body does not contain a JSON object.')
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

function normalizePacket(payload) {
  if (!payload || typeof payload !== 'object') return null
  const packet = payload.packet && typeof payload.packet === 'object' ? payload.packet : payload
  if (!['x', 'y', 'z'].every((axis) => Number.isFinite(Number(packet[axis] ?? packet.position?.[axis])))) return null
  if (packet.contacts !== undefined && (!Array.isArray(packet.contacts) || packet.contacts.length > 500)) return null
  if (!packet.stamp) packet.stamp = new Date().toISOString()
  if (!packet.source) packet.source = 'bridge'
  return packet
}

function ingestPacket(packet) {
  const pushed = pushPacket(packet, true)
  if (pushed) {
    broadcastPacket(packet)
    void pushRemotePacket(packet)
  }
  return pushed
}

function pushPacket(packet, persist) {
  const identity = packetIdentity(packet)
  if (identity && identities.has(identity)) return false
  if (identity) identities.add(identity)
  history.push(packet)
  while (history.length > historyLimit) {
    const removed = history.shift()
    const removedIdentity = packetIdentity(removed)
    if (removedIdentity) identities.delete(removedIdentity)
  }
  if (persist) persistPacket(packet)
  return true
}

function persistPacket(packet) {
  const line = `${JSON.stringify(packet)}\n`
  const currentBytes = existsSync(logPath) ? statSync(logPath).size : 0
  if (currentBytes + Buffer.byteLength(line, 'utf8') > maxLogBytes) {
    compactLog()
    return
  }
  appendFileSync(logPath, line, 'utf8')
}

function compactLog() {
  const lines = []
  let retainedBytes = 0
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const line = `${JSON.stringify(history[index])}\n`
    const lineBytes = Buffer.byteLength(line, 'utf8')
    if (lineBytes > maxLogBytes) continue
    if (retainedBytes + lineBytes > maxLogBytes) break
    lines.unshift(line)
    retainedBytes += lineBytes
  }
  writeFileSync(logPath, lines.join(''), 'utf8')
}

function readLogTail(path, maximumBytes) {
  const size = statSync(path).size
  const length = Math.min(size, maximumBytes)
  if (length <= 0) return ''
  const buffer = Buffer.alloc(length)
  const file = openSync(path, 'r')
  try {
    readSync(file, buffer, 0, length, size - length)
  } finally {
    closeSync(file)
  }
  let text = buffer.toString('utf8')
  if (size > length) {
    const firstLineBreak = text.indexOf('\n')
    text = firstLineBreak >= 0 ? text.slice(firstLineBreak + 1) : ''
  }
  return text
}

function broadcastPacket(packet) {
  const data = `event: telemetry\ndata: ${JSON.stringify(packet)}\n\n`
  eventClients.forEach((client) => client.write(data))
}

function latestPacket() {
  return history[history.length - 1] || null
}

function fileWatchInfo() {
  return {
    enabled: fileWatch.enabled,
    path: fileWatch.path,
    intervalMs: fileWatch.intervalMs,
    lastReadAt: fileWatch.lastReadAt,
    accepted: fileWatch.accepted,
    lastError: fileWatch.lastError || null,
  }
}

function remotePushInfo() {
  return {
    enabled: remotePush.enabled,
    url: remotePush.url,
    timeoutMs: remotePush.timeoutMs,
    syncIntervalMs: remoteSyncIntervalMs,
    accepted: remotePush.accepted,
    lastAttemptAt: remotePush.lastAttemptAt,
    lastSuccessAt: remotePush.lastSuccessAt,
    lastSyncAt: remotePush.lastSyncAt,
    lastError: remotePush.lastError || null,
  }
}

async function syncRemoteRelay() {
  if (!remotePush.enabled || !remotePush.url || typeof fetch !== 'function') return
  const packet = latestPacket()
  if (!packet) return

  remotePush.lastSyncAt = new Date().toISOString()
  try {
    const health = await fetchRemoteHealth()
    const identity = packetIdentity(packet)
    const relayHasPacket = Number(health.packetCount) > 0
    const relayMatchesIdentity = identity && health.latestPacketId === identity
    const relayMatchesStamp = packet.stamp && health.latestStamp === packet.stamp
    if (!relayHasPacket || (identity && !relayMatchesIdentity) || (packet.stamp && !relayMatchesStamp)) {
      await pushRemotePacket(packet)
    } else {
      remotePush.lastError = ''
    }
  } catch {
    await pushRemotePacket(packet)
  }
}

async function fetchRemoteHealth() {
  const healthUrl = remoteHealthUrl()
  if (!healthUrl) throw new Error('Remote relay health endpoint is unavailable.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), remotePush.timeoutMs)
  try {
    const response = await fetch(healthUrl, {
      headers: remoteHeaders(false),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Remote relay health returned HTTP ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function pushRemotePacket(packet) {
  if (!remotePush.enabled || !remotePush.url) return
  if (typeof fetch !== 'function') {
    remotePush.lastError = 'Node.js fetch is unavailable; use Node 18 or newer for remote relay push.'
    return
  }

  remotePush.lastAttemptAt = new Date().toISOString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), remotePush.timeoutMs)
  try {
    const response = await fetch(remotePush.url, {
      method: 'POST',
      headers: remoteHeaders(true),
      body: JSON.stringify(packet),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Remote relay returned HTTP ${response.status}.`)
    remotePush.accepted += 1
    remotePush.lastSuccessAt = new Date().toISOString()
    remotePush.lastError = ''
  } catch (error) {
    remotePush.lastError = error instanceof Error ? error.message : 'Remote relay push failed.'
  } finally {
    clearTimeout(timer)
  }
}

function remoteHeaders(includeContentType) {
  return {
    Accept: 'application/json',
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(remotePushKey ? { 'X-ShipOS-Key': remotePushKey } : {}),
  }
}

function remoteHealthUrl() {
  try {
    const url = new URL(remotePush.url)
    const path = url.pathname.replace(/\/+$/, '')
    if (path.endsWith('/telemetry/latest')) {
      url.pathname = path.replace(/\/latest$/, '/health')
    } else if (path.endsWith('/telemetry')) {
      url.pathname = `${path}/health`
    } else {
      url.pathname = '/api/shipos/telemetry/health'
    }
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function packetIdentity(packet) {
  if (!packet || typeof packet !== 'object') return ''
  if (packet.packetId) return String(packet.packetId)
  if (packet.sequence !== undefined && packet.stamp) return `${packet.sequence}-${packet.stamp}`
  if (packet.stamp && packet.ship) return `${packet.ship}-${packet.stamp}`
  return ''
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => address.address)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload), {
    'Content-Type': 'application/json',
  })
}

function send(response, status, body = '', headers = {}) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'content-type, accept, authorization, x-shipos-key, access-control-request-private-network',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    Vary: 'Access-Control-Request-Private-Network',
    ...(response.shipOsCorsOrigin ? { 'Access-Control-Allow-Origin': response.shipOsCorsOrigin } : {}),
    ...headers,
  })
  response.end(body)
}

function allowedCorsOrigin(origin) {
  if (!origin) return ''
  if (origin === 'https://gaming.echoboardhq.com') return origin
  try {
    const parsed = new URL(origin)
    if ((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) return origin
  } catch {
  }
  return ''
}
