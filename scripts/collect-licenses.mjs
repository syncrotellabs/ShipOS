import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(root, 'runtime', 'licenses')
fs.mkdirSync(target, { recursive: true })
const seen = new Set()
function collect(name, from) {
  const resolver = createRequire(path.join(from, 'package.json'))
  let entry
  try { entry = resolver.resolve(`${name}/package.json`) } catch { entry = resolver.resolve(name) }
  let directory = path.dirname(entry)
  while (!fs.existsSync(path.join(directory, 'package.json'))) directory = path.dirname(directory)
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  const identity = `${pkg.name}-${pkg.version}`
  if (seen.has(identity)) return
  seen.add(identity)
  const licenses = fs.readdirSync(directory).filter(file => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(file))
  if (!licenses.length) throw Error(`Missing license for ${identity}`)
  for (const file of licenses) fs.copyFileSync(path.join(directory, file), path.join(target, identity.replaceAll('/', '-') + '-' + file + '.txt'))
  for (const dependency of Object.keys(pkg.dependencies || {})) collect(dependency, directory)
}
const pkg = require('../package.json')
for (const name of Object.keys(pkg.dependencies)) collect(name, root)
console.log(`Collected license files for ${seen.size} runtime packages.`)
