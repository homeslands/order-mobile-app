#!/usr/bin/env node
/**
 * Bundle Size Checker — so sánh bundle hiện tại với baseline.
 *
 * Usage:
 *   node scripts/check-bundle-size.js           # check và cảnh báo nếu tăng > 200KB
 *   node scripts/check-bundle-size.js --update  # cập nhật baseline
 */

const fs = require('fs')
const path = require('path')

const BUNDLE_DIR = path.join(
  __dirname,
  '..',
  'dist',
  '_expo',
  'static',
  'js',
  'web',
)
const BASELINE_FILE = path.join(__dirname, '..', '.bundle-baseline.json')
const WARN_THRESHOLD_BYTES = 200 * 1024 // 200KB

const isUpdate = process.argv.includes('--update')

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`
  return `${(bytes / 1024).toFixed(1)}KB`
}

function formatDelta(bytes) {
  const sign = bytes >= 0 ? '+' : ''
  if (Math.abs(bytes) >= 1024 * 1024)
    return `${sign}${(bytes / 1024 / 1024).toFixed(2)}MB`
  return `${sign}${(bytes / 1024).toFixed(1)}KB`
}

function getCurrentSizes() {
  if (!fs.existsSync(BUNDLE_DIR)) {
    console.error('❌  dist/ not found. Run: npm run build')
    process.exit(1)
  }

  const files = fs.readdirSync(BUNDLE_DIR).filter((f) => f.endsWith('.js'))
  if (files.length === 0) {
    console.error('❌  No JS bundles found in dist/. Run: npm run build')
    process.exit(1)
  }

  const sizes = {}
  for (const file of files) {
    sizes[file] = fs.statSync(path.join(BUNDLE_DIR, file)).size
  }
  return sizes
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
}

function saveBaseline(sizes) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ sizes, updatedAt: new Date().toISOString() }, null, 2),
  )
}

const current = getCurrentSizes()
const baseline = loadBaseline()

if (isUpdate || !baseline) {
  saveBaseline(current)
  console['log']('✅  Bundle baseline updated:')
  for (const [file, size] of Object.entries(current)) {
    console['log'](`   ${file}: ${formatSize(size)}`)
  }
  console['log'](`\n   Saved to: .bundle-baseline.json`)
  process.exit(0)
}

// Compare mode
console['log']('\n📦  Bundle Size Check\n')

let hasWarning = false
let hasError = false

for (const [file, size] of Object.entries(current)) {
  const prev = baseline.sizes?.[file]
  if (!prev) {
    console['log'](`   🆕  ${file}: ${formatSize(size)} (new file)`)
    continue
  }

  const delta = size - prev
  const deltaStr = formatDelta(delta)
  const sizeStr = formatSize(size)

  if (delta > WARN_THRESHOLD_BYTES) {
    console['log'](`   🔴  ${file}: ${sizeStr} (${deltaStr}) ← EXCEEDED threshold`)
    hasError = true
  } else if (delta > 0) {
    console['log'](`   🟡  ${file}: ${sizeStr} (${deltaStr})`)
    hasWarning = true
  } else if (delta < 0) {
    console['log'](`   🟢  ${file}: ${sizeStr} (${deltaStr}) ← reduced`)
  } else {
    console['log'](`   ✅  ${file}: ${sizeStr} (no change)`)
  }
}

// Report files removed from baseline
for (const file of Object.keys(baseline.sizes ?? {})) {
  if (!current[file]) {
    console['log'](`   🗑️   ${file}: removed`)
  }
}

console['log'](`\n   Baseline from: ${baseline.updatedAt ?? 'unknown'}`)
console['log'](`   Warn threshold: ${formatSize(WARN_THRESHOLD_BYTES)}\n`)

if (hasError) {
  console.error(
    '❌  Bundle size exceeded threshold. Run: npm run analyze:web to investigate.',
  )
  console.error('   To update baseline: npm run update-bundle-baseline\n')
  process.exit(1)
} else if (hasWarning) {
  console['log']('⚠️   Bundle size increased but within threshold.\n')
} else {
  console['log']('✅  Bundle size OK.\n')
}
