#!/usr/bin/env ts-node
/**
 * Detects FlashList / BottomSheetFlashList instances missing overrideItemLayout prop.
 * Run: npx ts-node scripts/check-flashlist-sizes.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'

const files = glob.sync('app/**/*.tsx', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true,
})

let found = 0

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  lines.forEach((line, i) => {
    if (!line.includes('<FlashList') && !line.includes('<BottomSheetFlashList')) return

    // Look ahead 15 lines for overrideItemLayout
    const block = lines.slice(i, i + 15).join('\n')
    if (!block.includes('overrideItemLayout')) {
      console.log(`MISSING: ${path.relative(process.cwd(), file)}:${i + 1}`)
      found++
    }
  })
}

if (found === 0) {
  console.log('✅ All FlashList instances have overrideItemLayout')
} else {
  console.log(`\n❌ Found ${found} FlashList instance(s) missing overrideItemLayout`)
  process.exit(1)
}
