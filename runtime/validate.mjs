import { readFileSync } from 'node:fs'
const schemas = JSON.parse(readFileSync(new URL('./state-schema.json', import.meta.url), 'utf8'))
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function matches(value, schema, depth = 0) {
  if (depth > 25) return false
  if ('literal' in schema) return value === schema.literal
  if (schema.any) return schema.any.some(option => matches(value, option, depth + 1))
  if (schema.all) return schema.all.every(option => matches(value, option, depth + 1))
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (schema.type === 'string') return typeof value === 'string' && value.length <= 3_000_000
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'array') return Array.isArray(value) && value.length <= 10000 && value.every(item => matches(item, schema.item, depth + 1))
  if (!object(value) || Object.keys(value).some(key => ['__proto__','constructor','prototype'].includes(key))) return false
  if (schema.type === 'map') return Object.keys(value).length <= 10000 && Object.values(value).every(item => matches(item, schema.item, depth + 1))
  if (schema.type === 'object') return Object.entries(schema.fields).every(([key, field]) => (!(key in value) && (field.optional || schema.partial)) || matches(value[key], field, depth + 1))
  return false
}
export function validStateField(key, value) { return Boolean(schemas[key]) && matches(value, schemas[key]) }
