import { spawnSync } from 'node:child_process'
import process from 'node:process'

for (const args of [
  ['scripts/generate-state-schema.mjs'],
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, VITE_SHIPOS_HOSTED: 'true' } })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
