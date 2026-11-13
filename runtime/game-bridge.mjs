import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const telemetryName = 'ShipOSLocalTelemetry.latest.json'
const chatRequestName = 'ShipOSLocalTelemetry.chat-request.txt'
const chatReplyName = 'ShipOSLocalTelemetry.chat-reply.txt'
const bridgeTokenPattern = /^shipos_bridge_[A-Za-z0-9_-]{43}$/
const privateIpv4 = value => /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(value)
const fingerprint = value => createHash('sha256').update(value).digest('hex')

export function parseEnvelope(source) {
  return Object.fromEntries(String(source).split(/\r?\n/).map(line => {
    const separator = line.indexOf('=')
    return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : null
  }).filter(Boolean))
}

export function serializeEnvelope(envelope) {
  return ['version', 'session', 'reply', 'expires', 'message'].map(key => `${key}=${String(envelope[key] || '')}`).concat('').join('\n')
}

export function validateBridgeUrl(value) {
  let url
  try { url = new URL(String(value || '')) } catch { throw Error('Bridge URL must be the HTTP URL shown by ShipOS.') }
  if (url.protocol !== 'http:' || !privateIpv4(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/api/bridge/exchange') {
    throw Error('Bridge URL must be the private-LAN HTTP /api/bridge/exchange URL shown by ShipOS.')
  }
  return url.toString()
}

export function parseArguments(args, environment = process.env) {
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const option = name => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const url = validateBridgeUrl(option('--url') || environment.SHIPOS_BRIDGE_URL)
  const token = String(option('--token') || environment.SHIPOS_BRIDGE_TOKEN || '')
  if (!bridgeTokenPattern.test(token)) throw Error('Paste the one-time game-PC bridge key shown by ShipOS.')
  const appData = String(option('--appdata') || environment.APPDATA || '')
  if (!path.isAbsolute(appData)) throw Error('APPDATA is unavailable. Run this bridge from your Windows gaming account.')
  return { help: false, url, token, storageDir: path.join(appData, 'SpaceEngineers', 'Storage') }
}

async function readBounded(filename, limit) {
  try {
    if ((await stat(filename)).size > limit) throw Error(`${path.basename(filename)} is too large.`)
    return await readFile(filename, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function removeIfPresent(filename) {
  try { await unlink(filename) } catch (error) { if (error.code !== 'ENOENT') throw error }
}

async function writeReply(filename, envelope) {
  if (!envelope || envelope.version !== '1' || !envelope.session || !envelope.reply || !envelope.expires || !envelope.message) throw Error('ShipOS returned an invalid chat reply.')
  const temporary = `${filename}.tmp`
  await writeFile(temporary, serializeEnvelope(envelope), 'utf8')
  await removeIfPresent(filename)
  await rename(temporary, filename)
}

export async function runGameBridge(config, options = {}) {
  const intervalMs = options.intervalMs ?? 1000
  const request = options.fetch || fetch
  const log = options.log || console.log
  const report = options.error || console.error
  const signal = options.signal
  const telemetryFile = path.join(config.storageDir, telemetryName)
  const chatRequestFile = path.join(config.storageDir, chatRequestName)
  const chatReplyFile = path.join(config.storageDir, chatReplyName)
  await mkdir(config.storageDir, { recursive: true })
  let sentTelemetry = ''
  let acknowledgedReply = ''
  let lastError = ''
  log(`ShipOS game bridge watching ${config.storageDir}`)
  log(`Connecting to ${new URL(config.url).origin} (the bridge key is hidden)`)

  while (!signal?.aborted) {
    try {
      const telemetrySource = await readBounded(telemetryFile, 2_000_000)
      const telemetryFingerprint = telemetrySource ? fingerprint(telemetrySource) : ''
      const chatSource = await readBounded(chatRequestFile, 16_000)
      const body = {}
      if (telemetrySource && telemetryFingerprint !== sentTelemetry) body.telemetry = JSON.parse(telemetrySource)
      if (chatSource) body.chatRequest = parseEnvelope(chatSource)
      if (acknowledgedReply) body.ackReplyId = acknowledgedReply
      const response = await request(config.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json', 'X-ShipOS-Bridge': 'v1' },
        body: JSON.stringify(body),
        signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw Error(result.error || `ShipOS returned HTTP ${response.status}.`)
      if (body.telemetry) sentTelemetry = telemetryFingerprint
      if (body.chatRequest && result.acceptedChat) await removeIfPresent(chatRequestFile)
      if (acknowledgedReply && !result.reply) acknowledgedReply = ''
      if (result.reply) {
        await writeReply(chatReplyFile, result.reply)
        acknowledgedReply = result.reply.reply
      }
      if (lastError) log('ShipOS game bridge reconnected.')
      lastError = ''
    } catch (error) {
      const message = String(error?.message || error)
      if (message !== lastError && error?.name !== 'AbortError') report(`ShipOS game bridge: ${message}`)
      lastError = message
    }
    if (!signal?.aborted) await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}

function help() {
  return [
    'ShipOS gaming-PC bridge',
    '',
    'Usage:',
    '  node runtime/game-bridge.mjs --url http://192.168.1.20:5174/api/bridge/exchange --token shipos_bridge_…',
    '',
    'Run this on the Windows computer playing Space Engineers. Generate the URL and',
    'one-time key in ShipOS Settings > Remote gaming-PC bridge.',
  ].join('\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = parseArguments(process.argv.slice(2))
    if (config.help) console.log(help())
    else {
      const controller = new AbortController()
      for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => controller.abort())
      await runGameBridge(config, { signal: controller.signal })
    }
  } catch (error) {
    console.error(error.message)
    console.error('Run with --help for usage.')
    process.exitCode = 1
  }
}
