// Generate runtime validation from the actual persistent TypeScript record types.
import ts from 'typescript'
import fs from 'node:fs'
const source = fs.readFileSync(new URL('../src/ShipOSPage.tsx', import.meta.url), 'utf8')
const tree = ts.createSourceFile('ShipOSPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const aliases = new Map()
for (const statement of tree.statements) if (ts.isTypeAliasDeclaration(statement)) aliases.set(statement.name.text, statement.type)
function schema(node, depth = 0) {
  if (!node || depth > 20) throw Error('Cannot resolve persistent state type.')
  if (node.kind === ts.SyntaxKind.StringKeyword) return { type: 'string' }
  if (node.kind === ts.SyntaxKind.NumberKeyword) return { type: 'number' }
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return { type: 'boolean' }
  if (ts.isLiteralTypeNode(node)) return { literal: node.literal.kind === ts.SyntaxKind.NullKeyword ? null : node.literal.kind === ts.SyntaxKind.TrueKeyword ? true : node.literal.kind === ts.SyntaxKind.FalseKeyword ? false : ts.isNumericLiteral(node.literal) ? Number(node.literal.text) : node.literal.text }
  if (ts.isArrayTypeNode(node)) return { type: 'array', item: schema(node.elementType, depth + 1) }
  if (ts.isUnionTypeNode(node)) return { any: node.types.map(type => schema(type, depth + 1)) }
  if (ts.isIntersectionTypeNode(node)) return { all: node.types.map(type => schema(type, depth + 1)) }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText(tree)
    if (name === 'Record') return { type: 'map', item: schema(node.typeArguments[1], depth + 1) }
    if (name === 'Array') return { type: 'array', item: schema(node.typeArguments[0], depth + 1) }
    if (name === 'Partial') return { ...schema(node.typeArguments[0], depth + 1), partial: true }
    if (name === 'Exclude') return schema(node.typeArguments[0], depth + 1)
    return schema(aliases.get(name), depth + 1)
  }
  if (ts.isTypeLiteralNode(node)) return { type: 'object', fields: Object.fromEntries(node.members.filter(ts.isPropertySignature).map(member => [member.name.getText(tree).replace(/^['"]|['"]$/g, ''), { ...schema(member.type, depth + 1), optional: Boolean(member.questionToken) }])) }
  if (ts.isParenthesizedTypeNode(node)) return schema(node.type, depth + 1)
  throw Error('Unsupported persistent type: ' + node.getText(tree))
}
const state = {}
function walk(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'usePersistentState' && ts.isStringLiteral(node.arguments[0])) state[node.arguments[0].text] = schema(node.typeArguments?.[0])
  ts.forEachChild(node, walk)
}
walk(tree)
state['shipos-mission'] = { type: 'object', fields: { title: { type: 'string' }, goal: { type: 'string' }, startedAt: { type: 'string' } } }
fs.writeFileSync(new URL('../runtime/state-schema.json', import.meta.url), JSON.stringify(state, null, 2) + '\n')
console.log(`Generated ${Object.keys(state).length} state schemas.`)
