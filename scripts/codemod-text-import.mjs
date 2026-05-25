import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SKIP = ['components/ui/text.tsx', 'lib/fonts/be-vietnam-pro.tsx']

// Find candidate files
const raw = execSync(
  `grep -rl "from 'react-native'" "${ROOT}" --include="*.tsx" --include="*.ts"`,
  { encoding: 'utf-8' },
).trim()

const files = raw
  .split('\n')
  .filter(Boolean)
  .filter((f) => {
    const rel = path.relative(ROOT, f)
    return (
      !SKIP.some((s) => rel.includes(s)) &&
      !rel.startsWith('node_modules') &&
      !rel.startsWith('.expo') &&
      !rel.startsWith('android') &&
      !rel.startsWith('ios')
    )
  })

let changed = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8')

  // Match import { ..., Text, ... } from 'react-native' (single or multi-line)
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/gs

  let hasText = false

  const next = content.replace(importRegex, (match, imports) => {
    const names = imports
      .split(',')
      .map((s) => s.trim().replace(/\n/g, '').replace(/\s+/g, ' '))
      .filter(Boolean)
    if (!names.includes('Text')) return match
    hasText = true
    const remaining = names.filter((n) => n !== 'Text')
    if (remaining.length === 0) return ''
    return `import { ${remaining.join(', ')} } from 'react-native'`
  })

  if (!hasText) continue

  // Insert custom Text import after the last import line
  const lines = next.split('\n')
  let lastImportLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImportLine = i
  }

  const textImport = "import { Text } from '@/components/ui/text'"
  if (!next.includes(textImport)) {
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, textImport)
    } else {
      lines.unshift(textImport)
    }
  }

  const result = lines.join('\n')
  fs.writeFileSync(file, result)
  console.log('Updated:', path.relative(ROOT, file))
  changed++
}

console.log(`\nDone. Updated ${changed} files.`)
